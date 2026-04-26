"""
convert_model.py
----------------
Loads custom_face_model.keras and re-exports it as a pure-inference model
saved in .h5 format by rebuilding the architecture (no augmentation layers).

The augmentation layers (RandomFlip, RandomRotation, etc.) are training-only
and not needed for inference. We strip them and save weights only.

Run this ONCE locally, then commit + push custom_face_model_v2.h5.
"""
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np
import json
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2

BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
KERAS_PATH      = os.path.join(BASE_DIR, "custom_face_model.keras")
OUTPUT_PATH     = os.path.join(BASE_DIR, "custom_face_model_v2.h5")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")

print(f"TF {tf.__version__} | Keras {tf.keras.__version__}")

# ── 1. Load original model to extract weights ────────────────────────────────
print(f"\nLoading original model: {KERAS_PATH}")
original = tf.keras.models.load_model(KERAS_PATH)
print(f"  Output shape: {original.output_shape}")

with open(CLASS_NAMES_PATH) as f:
    class_names = json.load(f)
num_classes = len(class_names)
print(f"  Classes ({num_classes}): {class_names}")

# ── 2. Rebuild inference-only model (no augmentation) ────────────────────────
print("\nRebuilding inference-only model (no augmentation layers)...")
IMG_SIZE = 160

base = MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights=None,  # we'll copy weights from original
)

inputs  = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="input_image")
x       = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
x       = base(x, training=False)
x       = layers.GlobalAveragePooling2D()(x)
x       = layers.Dense(256, activation="relu")(x)
x       = layers.Dropout(0.4)(x)
outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

inference_model = tf.keras.Model(inputs, outputs, name="face_recognition_inference")
inference_model.compile(
    optimizer="adam",
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

# ── 3. Copy weights from the original model ──────────────────────────────────
print("\nCopying weights from original model...")

# Map layer names: skip augmentation + preprocess layers in original
# Original graph: input -> augmentation -> preprocess -> mobilenetv2 -> gap -> dense -> dropout -> dense
# New graph:      input -> preprocess -> mobilenetv2 -> gap -> dense -> dropout -> dense

orig_layers_by_name = {l.name: l for l in original.layers}

def copy_layer_weights(src_layer, dst_layer):
    if src_layer.get_weights():
        try:
            dst_layer.set_weights(src_layer.get_weights())
            print(f"  Copied: {src_layer.name} -> {dst_layer.name}")
        except Exception as e:
            print(f"  SKIP {src_layer.name}: {e}")

# Copy MobileNetV2 base weights
orig_base = orig_layers_by_name.get("mobilenetv2_1.00_160")
if orig_base:
    copy_layer_weights(orig_base, base)
else:
    print("  WARNING: Could not find mobilenetv2 base layer by name, trying index...")
    # Find mobilenetv2 layer in original by type
    for l in original.layers:
        if "mobilenetv2" in l.name.lower():
            copy_layer_weights(l, base)
            break

# Copy dense + output layers by matching weights shape
inf_dense_layers  = [l for l in inference_model.layers if isinstance(l, layers.Dense)]
orig_dense_layers = [l for l in original.layers    if isinstance(l, layers.Dense)]
for src, dst in zip(orig_dense_layers, inf_dense_layers):
    copy_layer_weights(src, dst)

# ── 4. Verify with dummy input ───────────────────────────────────────────────
print("\nVerifying with dummy inference...")
dummy  = np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
result = inference_model.predict(dummy, verbose=0)
print(f"  Output shape: {result.shape}  sum={result.sum():.4f} (should be ~1.0)")

# ── 5. Save ──────────────────────────────────────────────────────────────────
print(f"\nSaving to: {OUTPUT_PATH}")
inference_model.save(OUTPUT_PATH)
print(f"Saved! File size: {os.path.getsize(OUTPUT_PATH) / 1e6:.1f} MB")
print("\nDone! Update app.py to use custom_face_model_v2.h5 then commit + push.")
