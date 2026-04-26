"""
live_test.py
------------
Real-time face recognition using your trained MobileNetV2 model.
Press 'Q' to quit.
"""

import cv2
import numpy as np
import tensorflow as tf
import json
import time

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH      = os.path.join(BASE_DIR, "custom_face_model.keras")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")
IMG_SIZE        = 160          # must match training
CONFIDENCE_THRESHOLD = 0.75   # show name only if >= 75% confident

# ── Load model & class names ───────────────────────────────────────────
print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH)

with open(CLASS_NAMES_PATH) as f:
    class_names = json.load(f)

print(f"Model ready. Recognizing: {class_names}")
print("Press Q to quit.\n")

# ── Face detector ──────────────────────────────────────────────────────
cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(cascade_path)

# ── Webcam ─────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: Could not open webcam.")
    exit(1)

# FPS tracking
prev_time = time.time()

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # ── Detect faces ───────────────────────────────────────────────────
    gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )

    for (x, y, w, h) in faces:
        # Add padding around detected face
        pad   = int(w * 0.25)
        H, W  = frame.shape[:2]
        x1    = max(0, x - pad)
        y1    = max(0, y - pad)
        x2    = min(W, x + w + pad)
        y2    = min(H, y + h + pad)

        face_crop = frame[y1:y2, x1:x2]

        # ── Preprocess & predict ───────────────────────────────────────
        face_rgb   = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        face_resized = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE))
        input_data = np.expand_dims(face_resized, axis=0).astype(np.float32)

        preds      = model.predict(input_data, verbose=0)[0]
        best_idx   = int(np.argmax(preds))
        confidence = float(preds[best_idx])
        name       = class_names[best_idx]

        # ── Draw bounding box & label ──────────────────────────────────
        if confidence >= CONFIDENCE_THRESHOLD:
            color     = (0, 220, 0)       # green = recognized
            label     = f"{name}  {confidence*100:.1f}%"
        else:
            color     = (0, 60, 220)      # red = unknown
            label     = f"Unknown  {confidence*100:.1f}%"

        # Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Label background pill
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(frame, (x1, y1 - th - 12), (x1 + tw + 8, y1), color, -1)
        cv2.putText(frame, label,
                    (x1 + 4, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # ── FPS counter ────────────────────────────────────────────────────
    curr_time = time.time()
    fps = 1.0 / (curr_time - prev_time + 1e-6)
    prev_time = curr_time
    cv2.putText(frame, f"FPS: {fps:.1f}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 0), 2)

    # ── Show ───────────────────────────────────────────────────────────
    cv2.imshow("Face Recognition  —  Press Q to quit", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Done.")
