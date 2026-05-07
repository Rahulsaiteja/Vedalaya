import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import cv2
import numpy as np
import urllib.request
import shutil
import json

import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.applications import EfficientNetB0
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_class_weight

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.environ.get("DATA_DIR", BASE_DIR)
DATASET_DIR = os.path.join(DATA_DIR, "dataset")
IMG_SIZE    = 224
BATCH_SIZE  = 16   # smaller batch = more gradient updates per epoch, better for small datasets
EPOCHS      = 50

os.makedirs(DATASET_DIR, exist_ok=True)

# ── DNN Face Detector ─────────────────────────────────────────────────────────
DNN_PROTOTXT    = os.path.join(BASE_DIR, "deploy.prototxt")
DNN_CAFFEMODEL  = os.path.join(BASE_DIR, "res10_300x300_ssd_iter_140000.caffemodel")
_PROTOTXT_URL   = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
_CAFFEMODEL_URL = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"
face_cascade    = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def _download_dnn_files():
    for path, url in [(DNN_PROTOTXT, _PROTOTXT_URL), (DNN_CAFFEMODEL, _CAFFEMODEL_URL)]:
        if not os.path.exists(path):
            print(f"Downloading {path} ...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  ✓ Downloaded.")
            except Exception as e:
                print(f"  ✗ Failed: {e}")

_download_dnn_files()
dnn_net = None
if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
    dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
    print("DNN face detector loaded.")
else:
    print("DNN files missing — using Haar cascade.")


# ── Face alignment using eye landmarks ───────────────────────────────────────
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

def align_face(face_bgr):
    """
    Align face by rotating so eyes are horizontal.
    Returns aligned face or original if eyes not detected.
    """
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20))
    if len(eyes) < 2:
        return face_bgr  # can't align, return as-is

    # Sort eyes left to right
    eyes = sorted(eyes, key=lambda e: e[0])
    (x1, y1, w1, h1) = eyes[0]
    (x2, y2, w2, h2) = eyes[1]

    # Center of each eye
    eye1_center = (x1 + w1 // 2, y1 + h1 // 2)
    eye2_center = (x2 + w2 // 2, y2 + h2 // 2)

    # Angle between eyes
    dy = eye2_center[1] - eye1_center[1]
    dx = eye2_center[0] - eye1_center[0]
    angle = np.degrees(np.arctan2(dy, dx))

    # Rotate around midpoint between eyes
    mid = (float((eye1_center[0] + eye2_center[0]) // 2),
           float((eye1_center[1] + eye2_center[1]) // 2))
    h, w = face_bgr.shape[:2]
    M = cv2.getRotationMatrix2D(mid, angle, 1.0)
    aligned = cv2.warpAffine(face_bgr, M, (w, h), flags=cv2.INTER_CUBIC)
    return aligned


def apply_clahe(img_bgr):
    """Apply CLAHE to normalize lighting — must be applied consistently at train AND predict time."""
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def preprocess_face(img_bgr):
    """
    Full preprocessing pipeline — must match app.py predict() exactly:
    1. CLAHE lighting normalization
    2. Face alignment
    3. Resize to IMG_SIZE
    4. Convert to RGB float32
    """
    img_bgr = apply_clahe(img_bgr)
    img_bgr = align_face(img_bgr)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_rgb = cv2.resize(img_rgb, (IMG_SIZE, IMG_SIZE))
    return img_rgb.astype(np.float32)


def load_data():
    """
    Load face images from dataset directory.
    Images are already face crops saved by /register-face.
    Apply full preprocessing pipeline consistently.
    """
    X, y, classes = [], [], []

    if not os.path.exists(DATASET_DIR):
        print(f"Dataset directory '{DATASET_DIR}' not found.")
        return np.array(X), np.array(y), classes

    person_dirs = sorted([
        d for d in os.listdir(DATASET_DIR)
        if os.path.isdir(os.path.join(DATASET_DIR, d))
    ])

    for idx, person_name in enumerate(person_dirs):
        person_dir = os.path.join(DATASET_DIR, person_name)
        classes.append(person_name)
        loaded = skipped = 0

        for img_name in os.listdir(person_dir):
            if not img_name.lower().endswith((".png", ".jpg", ".jpeg")):
                continue
            img_bgr = cv2.imread(os.path.join(person_dir, img_name))
            if img_bgr is None:
                skipped += 1
                continue

            try:
                face = preprocess_face(img_bgr)
                X.append(face)
                y.append(idx)
                loaded += 1
            except Exception as e:
                skipped += 1

        print(f"  {person_name:<25}: {loaded} loaded, {skipped} skipped")

    return np.array(X), np.array(y), classes


def build_augmentation():
    """
    Augmentation without RandomBrightness — that layer internally uses a
    Normalization sublayer which saves without weights and crashes on reload.
    Brightness variation is handled instead by RandomContrast which is safe.
    """
    return models.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.1),
        layers.RandomZoom(0.15),
        layers.RandomContrast(0.4),
        layers.RandomTranslation(0.1, 0.1),
    ], name="augmentation")


def build_model(num_classes):
    base_model = EfficientNetB0(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = build_augmentation()(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)          # stabilizes training
    x = layers.Dense(512, activation="relu")(x) # larger head for more capacity
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=["accuracy"],
    )
    return model, base_model


def main():
    print("=" * 60)
    print("  Face Recognition — EfficientNetB0 Transfer Learning")
    print("=" * 60)

    print("\n[1/5] Loading and preprocessing dataset...")
    X, y, classes = load_data()

    if len(X) == 0:
        print("No images found. Check dataset folder.")
        return

    num_classes = len(classes)
    print(f"\n  Total images  : {len(X)}")
    print(f"  People ({num_classes})    : {classes}")

    if num_classes < 2:
        print("Need at least 2 people to train. Register more students.")
        return

    # Check minimum images per person
    for i, name in enumerate(classes):
        count = np.sum(np.array(y) == i)
        if count < 30:
            print(f"  WARNING: {name} has only {count} images. Recommend 50+.")

    with open(os.path.join(DATA_DIR, "class_names.json"), "w") as f:
        json.dump(classes, f)
    print("  class_names.json saved.")

    print("\n[2/5] Splitting 80/20 train/val (stratified)...")
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train)} | Val: {len(X_val)}")

    X_train = X_train.astype(np.float32)
    X_val   = X_val.astype(np.float32)

    class_weights_arr = compute_class_weight(
        class_weight="balanced", classes=np.unique(y_train), y=y_train
    )
    class_weight_dict = dict(enumerate(class_weights_arr))
    print(f"  Class weights: { {classes[i]: round(w, 2) for i, w in class_weight_dict.items()} }")

    y_train_oh = tf.keras.utils.to_categorical(y_train, num_classes=num_classes)
    y_val_oh   = tf.keras.utils.to_categorical(y_val,   num_classes=num_classes)

    print("\n[3/5] Building EfficientNetB0 model...")
    model, base = build_model(num_classes)

    best_model_path = os.path.join(DATA_DIR, "custom_face_model_v2.keras")
    p2_temp_path    = os.path.join(DATA_DIR, "custom_face_model_v2_p2temp.keras")

    # ── Phase 1: Train head only ──────────────────────────────────────────────
    print("\n[4/5] Phase 1: Training classifier head (base frozen)...")
    cb_phase1 = [
        callbacks.ModelCheckpoint(
            best_model_path, monitor="val_accuracy",
            save_best_only=True, verbose=1
        ),
        callbacks.EarlyStopping(
            monitor="val_accuracy", patience=8,
            restore_best_weights=True, verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=4,
            min_lr=1e-6, verbose=1
        ),
    ]

    history1 = model.fit(
        X_train, y_train_oh,
        epochs=25,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val_oh),
        class_weight=class_weight_dict,
        callbacks=cb_phase1,
    )
    best_p1_acc = max(history1.history["val_accuracy"])
    print(f"\n  Phase 1 best val_accuracy: {best_p1_acc:.4f}")

    # ── Phase 2: Fine-tune top layers ─────────────────────────────────────────
    print("\n[5/5] Phase 2: Fine-tuning top 80 layers of EfficientNetB0...")
    base.trainable = True
    for layer in base.layers[:-80]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-6),  # very low LR
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=["accuracy"],
    )

    cb_phase2 = [
        callbacks.ModelCheckpoint(
            p2_temp_path, monitor="val_accuracy",
            save_best_only=True, verbose=1
        ),
        callbacks.EarlyStopping(
            monitor="val_accuracy", patience=10,
            restore_best_weights=True, verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5,
            min_lr=1e-8, verbose=1
        ),
    ]

    history2 = model.fit(
        X_train, y_train_oh,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val_oh),
        class_weight=class_weight_dict,
        callbacks=cb_phase2,
    )
    best_p2_acc = max(history2.history["val_accuracy"]) if history2.history["val_accuracy"] else 0
    print(f"\n  Phase 2 best val_accuracy: {best_p2_acc:.4f}")

    if best_p2_acc > best_p1_acc:
        print(f"  Phase 2 improved — using Phase 2 model.")
        shutil.copy2(p2_temp_path, best_model_path)
    else:
        print(f"  Phase 2 did not improve — keeping Phase 1 model.")
    if os.path.exists(p2_temp_path):
        os.remove(p2_temp_path)

    # ── Final report ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  Per-Person Accuracy Report")
    print("=" * 60)
    final_model = tf.keras.models.load_model(best_model_path)
    y_pred      = np.argmax(final_model.predict(X_val, verbose=0), axis=1)
    y_true      = np.argmax(y_val_oh, axis=1)
    print(classification_report(y_true, y_pred, target_names=classes, zero_division=0))

    # ── Save inference-only model (no augmentation layers) ───────────────────
    # Augmentation layers (RandomBrightness etc.) contain Normalization sublayers
    # that require adapted weights. Stripping them avoids load errors at inference time.
    print("\n  Building inference-only model (augmentation stripped)...")
    try:
        # Find the layer after augmentation (first non-augmentation layer)
        aug_layer_names = {"augmentation", "random_flip", "random_rotation",
                           "random_zoom", "random_brightness", "random_contrast",
                           "random_translation"}
        # Build inference model: Input → skip augmentation → rest of layers
        inf_input = final_model.input
        # Get the augmentation layer output to find what comes after it
        aug_layer = None
        for layer in final_model.layers:
            if layer.name == "augmentation" or any(n in layer.name for n in aug_layer_names):
                if hasattr(layer, 'layers'):  # it's a Sequential augmentation block
                    aug_layer = layer
                    break

        if aug_layer is not None:
            # Reconnect: pass input directly to the layer after augmentation
            x = inf_input
            skip_aug = True
            for layer in final_model.layers[1:]:  # skip Input layer
                if layer == aug_layer:
                    skip_aug = False
                    continue
                if skip_aug:
                    continue
                x = layer(x)
            inference_model = tf.keras.Model(inputs=inf_input, outputs=x)
            inference_model.save(best_model_path)
            print("  Inference-only model saved (augmentation stripped).")
        else:
            print("  No augmentation layer found — model saved as-is.")
    except Exception as strip_err:
        print(f"  Could not strip augmentation ({strip_err}) — model saved with augmentation.")

    best_acc = max(
        history1.history["val_accuracy"] + history2.history["val_accuracy"]
    ) * 100
    print(f"\n[OK] Best Validation Accuracy : {best_acc:.2f}%")
    print(f"[OK] Model saved              : {best_model_path}")
    print("[OK] Class names saved        : class_names.json")


if __name__ == "__main__":
    main()
