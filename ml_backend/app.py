from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import json
import numpy as np
import threading
import subprocess
import requests

# Prevent GPU memory allocation and minimize TF logs
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf

tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

app = Flask(__name__)
CORS(app)

BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR    = os.path.join(BASE_DIR, "dataset")
MODEL_PATH     = os.path.join(BASE_DIR, "custom_face_model_v2.h5")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")
IMG_SIZE       = 160
CONFIDENCE_THRESHOLD = 0.85

# ── Model state ───────────────────────────────────────────────────────────────
custom_model     = None
class_names      = []
model_load_error = "Model not loaded yet."
_model_lock      = threading.Lock()   # prevents race condition on concurrent requests
is_training      = False

# ── DNN Face Detector ─────────────────────────────────────────────────────────
DNN_PROTOTXT   = os.path.join(BASE_DIR, "deploy.prototxt")
DNN_CAFFEMODEL = os.path.join(BASE_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

dnn_net      = None
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def load_dnn_detector():
    global dnn_net
    if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
        dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
        print("DNN face detector loaded.")
    else:
        print("DNN detector files missing — falling back to Haar cascade.")

def detect_faces_dnn(img, conf_threshold=0.5):
    """Returns list of (x, y, w, h). Uses DNN detector, falls back to Haar."""
    if dnn_net is None:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(img, (300, 300)), 1.0,
                                  (300, 300), (104.0, 177.0, 123.0))
    dnn_net.setInput(blob)
    detections = dnn_net.forward()

    boxes = []
    for i in range(detections.shape[2]):
        conf = detections[0, 0, i, 2]
        if conf < conf_threshold:
            continue
        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
        x1, y1, x2, y2 = box.astype(int)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        boxes.append((x1, y1, x2 - x1, y2 - y1))
    return boxes

# ── Model loading ─────────────────────────────────────────────────────────────
def load_custom_model():
    global custom_model, class_names, model_load_error
    with _model_lock:
        # Double-check inside lock to avoid loading twice
        if custom_model is not None:
            return
        print("Loading ML model...")
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
                custom_model = tf.keras.models.load_model(MODEL_PATH)
                with open(CLASS_NAMES_PATH, "r") as f:
                    class_names = json.load(f)
                model_load_error = None
                print(f"Model loaded. Classes: {class_names}")
            else:
                model_load_error = (
                    f"Model file not found at {MODEL_PATH}. "
                    "Register students to trigger training."
                )
                print(model_load_error)
        except Exception as e:
            model_load_error = f"Load error: {str(e)}"
            print(f"CRITICAL ERROR LOADING MODEL: {e}")

def background_train(name=None, teacher_email=None):
    global is_training, custom_model
    try:
        is_training = True
        print(f"Background training started for: {name}")
        subprocess.run(
            ["python", os.path.join(BASE_DIR, "train_model.py")],
            cwd=BASE_DIR, check=True
        )
        print("Training done. Reloading model...")
        # Reset so load_custom_model reloads fresh
        with _model_lock:
            custom_model = None
        load_custom_model()

        # Notify Node backend
        node_url      = os.environ.get('NODE_API_URL', 'http://localhost:5000')
        webhook_secret = os.environ.get('WEBHOOK_SECRET', '')
        if name and teacher_email:
            try:
                requests.post(
                    f"{node_url}/api/attendance/notify-training",
                    json={"name": name, "email": teacher_email},
                    headers={"x-webhook-secret": webhook_secret},
                    timeout=10
                )
            except Exception as e:
                print(f"Webhook failed: {e}")
    except Exception as e:
        print(f"Training error: {e}")
    finally:
        is_training = False

# ── Load detector at startup (files pre-downloaded in Docker build) ───────────
load_dnn_detector()

# ── Load model at startup in background so health check passes immediately ────
threading.Thread(target=load_custom_model, daemon=True).start()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

@app.route('/status', methods=['GET'])
def get_status():
    classes = []
    if os.path.isdir(DATASET_DIR):
        classes = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    return jsonify({
        "status": "Running",
        "classes": classes,
        "model_status": "Loaded" if custom_model is not None else "Not Ready",
        "trained_classes": class_names,
        "is_training": is_training,
        "model_error": model_load_error,
    })

@app.route('/predict', methods=['POST'])
def predict():
    if custom_model is None:
        msg = "Model is still loading, please wait." if _model_lock.locked() else model_load_error
        return jsonify({"error": msg}), 503

    if 'image' not in request.files:
        return jsonify({"error": "No image in request."}), 400

    file = request.files['image']
    temp_path = os.path.join(BASE_DIR, "temp_incoming_face.jpg")
    try:
        file.save(temp_path)
        img = cv2.imread(temp_path)
        if img is None:
            return jsonify({"error": "Invalid image file."}), 400

        faces = detect_faces_dnn(img)
        if len(faces) == 0:
            return jsonify({"error": "No face detected in the image."}), 404

        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        margin = int(w * 0.2)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(img.shape[1], x + w + margin)
        y2 = min(img.shape[0], y + h + margin)

        face_img = img[y1:y2, x1:x2]
        face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_img = cv2.resize(face_img, (IMG_SIZE, IMG_SIZE))

        # MobileNetV2 preprocessing: scale pixels to [-1, 1]
        input_data = np.expand_dims(face_img, axis=0).astype(np.float32)
        input_data = (input_data / 127.5) - 1.0

        predictions = custom_model.predict(input_data, verbose=0)
        best_idx    = np.argmax(predictions[0])
        confidence  = float(predictions[0][best_idx])
        name        = class_names[best_idx]

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "error": "Face not recognized with sufficient confidence.",
                "confidence": confidence
            }), 404

        return jsonify({
            "match": name,
            "confidence": confidence,
            "distance": 1.0 - confidence
        })

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/register-face', methods=['POST'])
def register_face():
    name          = request.form.get('name', '').strip()
    teacher_email = request.form.get('teacherEmail', '').strip()
    if not name:
        return jsonify({'error': 'Student name is required.'}), 400

    files = request.files.getlist('images')
    if not files:
        return jsonify({'error': 'No images uploaded.'}), 400

    save_dir = os.path.join(DATASET_DIR, name)
    os.makedirs(save_dir, exist_ok=True)

    saved = skipped = 0
    for file in files:
        try:
            img_array = np.frombuffer(file.read(), np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                skipped += 1
                continue

            faces = detect_faces_dnn(img)
            if len(faces) == 0:
                skipped += 1
                continue

            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            margin = int(w * 0.25)
            x1 = max(0, x - margin)
            y1 = max(0, y - margin)
            x2 = min(img.shape[1], x + w + margin)
            y2 = min(img.shape[0], y + h + margin)
            face_crop = img[y1:y2, x1:x2]

            existing = len(os.listdir(save_dir))
            cv2.imwrite(os.path.join(save_dir, f'frame_{existing:04d}.jpg'), face_crop)
            saved += 1
        except Exception as e:
            print(f'Image processing error: {e}')
            skipped += 1

    total = len(os.listdir(save_dir))
    training_started = False
    if not is_training and total >= 30:
        threading.Thread(target=background_train, args=(name, teacher_email), daemon=True).start()
        training_started = True

    return jsonify({
        'message': f'Saved {saved} face images for "{name}".',
        'saved': saved,
        'skipped': skipped,
        'total_in_folder': total,
        'name': name,
        'is_training': training_started,
    })

@app.route('/reload-model', methods=['POST'])
def reload_model():
    global custom_model
    with _model_lock:
        custom_model = None
    load_custom_model()
    if custom_model is not None:
        return jsonify({"status": "Model reloaded successfully."})
    return jsonify({"error": model_load_error}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
