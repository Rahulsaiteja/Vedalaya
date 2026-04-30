import os
import cv2
import numpy as np
import urllib.request

import os

import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.applications import MobileNetV2
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import json

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))

# DATA_DIR points to Render persistent disk in production (/app/data)
# Falls back to the app directory for local development
DATA_DIR  = os.environ.get('DATA_DIR', BASE_DIR)

DATASET_DIR = os.path.join(DATA_DIR, "dataset")
IMG_SIZE    = 160
BATCH_SIZE  = 32
EPOCHS      = 30

# Ensure data dir exists
os.makedirs(DATASET_DIR, exist_ok=True)

# ── DNN Face Detector ────────────────────────────────────────────────────────
DNN_PROTOTXT   = os.path.join(BASE_DIR, "deploy.prototxt")
DNN_CAFFEMODEL = os.path.join(BASE_DIR, "res10_300x300_ssd_iter_140000.caffemodel")
_PROTOTXT_URL  = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
_CAFFEMODEL_URL = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

# Haar cascade kept as fallback
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

def _download_dnn_files():
    for path, url in [(DNN_PROTOTXT, _PROTOTXT_URL), (DNN_CAFFEMODEL, _CAFFEMODEL_URL)]:
        if not os.path.exists(path):
            print(f"Downloading {path} ...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  ✓ {path} downloaded.")
            except Exception as e:
                print(f"  ✗ Failed to download {path}: {e}")

_download_dnn_files()
dnn_net = None
if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
    dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
    print("DNN face detector loaded for training.")
else:
    print("DNN files missing — using Haar cascade for training.")


def crop_face(img_bgr, padding=0.25):
    """Detect the largest face using DNN detector (Haar fallback). Returns padded crop or None."""
    h, w = img_bgr.shape[:2]

    if dnn_net is not None:
        blob = cv2.dnn.blobFromImage(cv2.resize(img_bgr, (300, 300)), 1.0,
                                      (300, 300), (104.0, 177.0, 123.0))
        dnn_net.setInput(blob)
        detections = dnn_net.forward()

        best_conf, best_box = 0, None
        for i in range(detections.shape[2]):
            conf = detections[0, 0, i, 2]
            if conf > best_conf:
                best_conf = conf
                best_box  = detections[0, 0, i, 3:7]

        if best_box is None or best_conf < 0.5:
            return None

        box = best_box * np.array([w, h, w, h])
        x1, y1, x2, y2 = box.astype(int)
    else:
        # Haar fallback
        gray  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        if len(faces) == 0:
            return None
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        x1, y1, x2, y2 = x, y, x + fw, y + fh

    pad_x = int((x2 - x1) * padding)
    pad_y = int((y2 - y1) * padding)
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)
    return img_bgr[y1:y2, x1:x2]


def load_data():
    X, y, classes = [], [], []

    if not os.path.exists(DATASET_DIR):
        print(f"Dataset directory '{DATASET_DIR}' not found.")
        return np.array(X), np.array(y), classes

    for idx, person_name in enumerate(sorted(os.listdir(DATASET_DIR))):
        person_dir = os.path.join(DATASET_DIR, person_name)
        if not os.path.isdir(person_dir):
            continue

        classes.append(person_name)
        loaded = skipped = 0

        for img_name in os.listdir(person_dir):
            if not img_name.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue
            img_bgr = cv2.imread(os.path.join(person_dir, img_name))
            if img_bgr is None:
                continue

            face = crop_face(img_bgr)
            if face is None:
                skipped += 1
                continue

            face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
            face_rgb = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE))
            X.append(face_rgb)
            y.append(idx)
            loaded += 1

        print(f"  {person_name:<20}: {loaded} loaded, {skipped} skipped (no face)")

    return np.array(X), np.array(y), classes


def build_augmentation():
    return models.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.15),        # more rotation variety
        layers.RandomZoom(0.15),            # more zoom variety
        layers.RandomBrightness(0.3),       # handle lighting changes
        layers.RandomContrast(0.3),         # handle contrast changes
        layers.RandomTranslation(0.1, 0.1), # slight position shifts
    ], name="augmentation")


def build_model(num_classes):
    """
    MobileNetV2 Transfer Learning:
      - Base: MobileNetV2 pretrained on ImageNet (frozen initially)
      - Top:  Custom classifier head for our people
      - Fine-tune: Unfreeze top 30 layers of base after initial training
    """
    # Pretrained base — no top classifier, frozen weights
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet"
    )
    base.trainable = False   # freeze all base layers first

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = build_augmentation()(inputs)

    # Preprocessing is now done OUTSIDE the model (before prediction)
    # so the model can be loaded on any TF version without TrueDivide errors
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.4)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)

    model = tf.keras.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        # Label smoothing forces the model to be more confident and
        # discriminative — reduces overconfident wrong predictions
        loss=tf.keras.losses.CategoricalCrossentropy(
            from_logits=False, label_smoothing=0.1
        ),
        metrics=['accuracy']
    )
    return model, base


def main():
    print("=" * 55)
    print("  Face Recognition  —  MobileNetV2 Transfer Learning")
    print("=" * 55)

    # [1] Load
    print("\n[1/5] Loading dataset and cropping faces...")
    X, y, classes = load_data()

    if len(X) == 0:
        print("No face crops found. Check your dataset folder.")
        return

    print(f"\n  Total face crops : {len(X)}")
    print(f"  People ({len(classes)})       : {classes}")

    with open(os.path.join(DATA_DIR, 'class_names.json'), 'w') as f:
        json.dump(classes, f)
    print("  class_names.json saved.")

    # [2] Split
    print("\n[2/5] Splitting 80/20 train/val...")
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train)} | Val: {len(X_val)}")

    # [3] Build
    print("\n[3/5] Building MobileNetV2 model...")
    model, base = build_model(len(classes))
    model.summary()

    # [4a] Phase 1 — train only the new head (base frozen)
    print("\n[4/5] Phase 1: Training classifier head (base frozen)...")
    cb_phase1 = [
        callbacks.ModelCheckpoint(
            os.path.join(DATA_DIR, "custom_face_model_v2.h5"),
            monitor="val_accuracy", save_best_only=True, verbose=1
        ),
        callbacks.EarlyStopping(
            monitor="val_accuracy", patience=6, verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=3,
            min_lr=1e-6, verbose=1
        ),
    ]

    # One-hot encode for label smoothing loss
    y_train_oh = tf.keras.utils.to_categorical(y_train, num_classes=len(classes))
    y_val_oh   = tf.keras.utils.to_categorical(y_val,   num_classes=len(classes))

    history1 = model.fit(
        X_train, y_train_oh,
        epochs=15,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val_oh),
        callbacks=cb_phase1
    )

    # [4b] Phase 2 — unfreeze top 30 layers and fine-tune
    print("\n[5/5] Phase 2: Fine-tuning top layers of MobileNetV2...")
    base.trainable = True
    # Unfreeze top 50 layers for better fine-grained face feature learning
    for layer in base.layers[:-50]:
        layer.trainable = False

    # Recompile with a much lower LR for fine-tuning
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss=tf.keras.losses.CategoricalCrossentropy(
            from_logits=False, label_smoothing=0.1
        ),
        metrics=['accuracy']
    )

    cb_phase2 = [
        callbacks.ModelCheckpoint(
            os.path.join(DATA_DIR, "custom_face_model_v2.h5"),
            monitor="val_accuracy", save_best_only=True, verbose=1
        ),
        callbacks.EarlyStopping(
            monitor="val_accuracy", patience=8, verbose=1
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=4,
            min_lr=1e-7, verbose=1
        ),
    ]

    history2 = model.fit(
        X_train, y_train_oh,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val_oh),
        callbacks=cb_phase2
    )

    # Combine histories for final best accuracy
    all_val_acc = (
        history1.history['val_accuracy'] +
        history2.history['val_accuracy']
    )

    # Report
    print("\n" + "=" * 55)
    print("  Per-Person Accuracy Report")
    print("=" * 55)
    model  = tf.keras.models.load_model(os.path.join(DATA_DIR, "custom_face_model_v2.h5"))
    y_pred = np.argmax(model.predict(X_val), axis=1)
    y_val_labels = np.argmax(y_val_oh, axis=1)
    print(classification_report(y_val_labels, y_pred,
                                 target_names=classes, zero_division=0))

    best_acc = max(all_val_acc) * 100
    print(f"\n[OK] Best Validation Accuracy : {best_acc:.2f}%")
    print("[OK] Best model saved         : custom_face_model.keras")
    print("[OK] Class names saved        : class_names.json")


if __name__ == "__main__":
    main()
