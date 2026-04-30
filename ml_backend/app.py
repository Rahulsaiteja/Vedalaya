from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import json
import numpy as np
import threading
import subprocess
import requests as http_requests

# Prevent GPU memory allocation and minimize TF logs
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf

tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

import storage  # Cloudinary persistence layer

app = Flask(__name__)
CORS(app)

BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
DATA_DIR         = os.environ.get('DATA_DIR', BASE_DIR)
DATASET_DIR      = os.path.join(DATA_DIR, "dataset")
MODEL_PATH       = os.path.join(DATA_DIR, "custom_face_model_v2.h5")
CLASS_NAMES_PATH = os.path.join(DATA_DIR, "class_names.json")
IMG_SIZE         = 160
CONFIDENCE_THRESHOLD = 0.85

os.makedirs(DATASET_DIR, exist_ok=True)

# ── Model state ───────────────────────────────────────────────────────────────
custom_model     = None
class_names      = []
model_load_error = "Model not loaded yet."
_model_lock      = threading.Lock()
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
        if custom_model is not None:
            return
        print("Loading ML model...")

        # Try to download from Cloudinary if not on disk
        if not os.path.exists(MODEL_PATH) or not os.path.exists(CLASS_NAMES_PATH):
            print("Model not on disk — downloading from Cloudinary...")
            storage.download_model(MODEL_PATH, CLASS_NAMES_PATH)

        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
                custom_model = tf.keras.models.load_model(MODEL_PATH)
                with open(CLASS_NAMES_PATH, "r") as f:
                    class_names = json.load(f)
                model_load_error = None
                print(f"Model loaded. Classes: {class_names}")
            else:
                model_load_error = (
                    "No trained model found. Register students to trigger training."
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

        # Download all face images from Cloudinary before training
        print("Syncing dataset from Cloudinary...")
        storage.download_all_faces(DATASET_DIR)

        subprocess.run(
            ["python", os.path.join(BASE_DIR, "train_model.py")],
            cwd=BASE_DIR, check=True,
            env={**os.environ, "DATA_DIR": DATA_DIR}
        )
        print("Training done. Uploading model to Cloudinary...")

        # Upload trained model to Cloudinary for persistence
        with open(CLASS_NAMES_PATH, "r") as f:
            trained_classes = json.load(f)
        storage.upload_model(MODEL_PATH, trained_classes)

        # Reload model in memory
        with _model_lock:
            custom_model = None
        load_custom_model()

        # Notify Node backend
        node_url       = os.environ.get('NODE_API_URL', 'http://localhost:5000')
        webhook_secret = os.environ.get('WEBHOOK_SECRET', '')
        if name and teacher_email:
            try:
                http_requests.post(
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

# ── Startup ───────────────────────────────────────────────────────────────────
load_dnn_detector()

def startup_sequence():
    """
    On startup:
    1. Try to download trained model from Cloudinary
    2. If no model but faces exist on Cloudinary → sync faces + auto-train
    """
    global is_training

    # Step 1: try to load existing model from Cloudinary
    load_custom_model()

    # Step 2: if still no model, sync dataset and trigger training
    if custom_model is None:
        print("No model found — syncing dataset from Cloudinary...")
        downloaded = storage.download_all_faces(DATASET_DIR)
        if downloaded > 0:
            print(f"Downloaded {downloaded} face images. Starting auto-training...")
            is_training = True
            try:
                result = subprocess.run(
                    ["python", os.path.join(BASE_DIR, "train_model.py")],
                    cwd=BASE_DIR, check=True,
                    env={**os.environ, "DATA_DIR": DATA_DIR},
                    capture_output=True, text=True
                )
                print("Training stdout:", result.stdout[-3000:] if result.stdout else "")
                print("Training stderr:", result.stderr[-1000:] if result.stderr else "")

                if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
                    with open(CLASS_NAMES_PATH, "r") as f:
                        trained_classes = json.load(f)
                    storage.upload_model(MODEL_PATH, trained_classes)
                    # Reset so load_custom_model reloads fresh
                    global custom_model
                    custom_model = None
                    load_custom_model()
                else:
                    print("ERROR: Training completed but model file not found!")
            except subprocess.CalledProcessError as e:
                print(f"Training process failed (exit {e.returncode})")
                print("stdout:", e.stdout[-3000:] if e.stdout else "")
                print("stderr:", e.stderr[-1000:] if e.stderr else "")
            except Exception as e:
                print(f"Auto-training error: {e}")
            finally:
                is_training = False
        else:
            print("No faces on Cloudinary yet — waiting for student registration.")

threading.Thread(target=startup_sequence, daemon=True).start()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

@app.route('/status', methods=['GET'])
def get_status():
    # Show local classes (populated after sync) or fall back to Cloudinary count
    local_classes = []
    if os.path.isdir(DATASET_DIR):
        local_classes = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    return jsonify({
        "status": "Running",
        "classes": local_classes,
        "model_status": "Loaded" if custom_model is not None else ("Training..." if is_training else "Not Ready"),
        "trained_classes": class_names,
        "is_training": is_training,
        "model_error": model_load_error,
        "cloudinary": storage.is_configured(),
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

    # Get current count from Cloudinary (source of truth) + local
    cloudinary_count = storage.count_faces_for_student(name)
    local_count      = len([f for f in os.listdir(save_dir) if f.endswith('.jpg')])
    start_index      = max(cloudinary_count, local_count)

    saved = skipped = 0
    for i, file in enumerate(files):
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

            # Save locally
            local_path = os.path.join(save_dir, f'frame_{start_index + saved:04d}.jpg')
            cv2.imwrite(local_path, face_crop)

            # Upload to Cloudinary for persistence
            with open(local_path, 'rb') as f_img:
                storage.upload_face_image(f_img.read(), name, start_index + saved)

            saved += 1
        except Exception as e:
            print(f'Image processing error: {e}')
            skipped += 1

    total = start_index + saved
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


@app.route('/retrain', methods=['POST'])
def retrain():
    """Manually trigger retraining — syncs from Cloudinary and retrains."""
    global is_training
    if is_training:
        return jsonify({"error": "Training already in progress."}), 409

    def do_retrain():
        global is_training, custom_model
        is_training = True
        try:
            print("Manual retrain triggered — syncing dataset from Cloudinary...")
            storage.download_all_faces(DATASET_DIR)
            result = subprocess.run(
                ["python", os.path.join(BASE_DIR, "train_model.py")],
                cwd=BASE_DIR, check=True,
                env={**os.environ, "DATA_DIR": DATA_DIR},
                capture_output=True, text=True
            )
            print("Training stdout:", result.stdout[-3000:] if result.stdout else "")
            if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
                with open(CLASS_NAMES_PATH, "r") as f:
                    trained_classes = json.load(f)
                storage.upload_model(MODEL_PATH, trained_classes)
                custom_model = None
                load_custom_model()
                print("Retrain complete. Model loaded.")
            else:
                print("ERROR: Retrain finished but model file missing.")
        except Exception as e:
            print(f"Retrain error: {e}")
        finally:
            is_training = False

    threading.Thread(target=do_retrain, daemon=True).start()
    return jsonify({"status": "Retraining started. Check /status for progress."})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
