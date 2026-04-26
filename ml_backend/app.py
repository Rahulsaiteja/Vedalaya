from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import json
import numpy as np
import threading
import subprocess
import requests
import urllib.request

# Prevent GPU memory allocation and minimize TF logs
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# We import tensorflow and keras to load the custom model
import tensorflow as tf

# Limit threads to save memory on Render Free tier
tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

app = Flask(__name__)
# Enable CORS so the React frontend or Node backend can call this API
CORS(app)

# Dataset directory where faces are stored
DATASET_DIR = "dataset"
MODEL_PATH = "custom_face_model.keras"
CLASS_NAMES_PATH = "class_names.json"
IMG_SIZE = 160   # MobileNetV2 input size

# Confidence threshold — softmax always sums to 1.0 so keep this high
CONFIDENCE_THRESHOLD = 0.85

# Load global variables for the model
custom_model = None
class_names = []

# ── DNN Face Detector ────────────────────────────────────────────────────────
DNN_PROTOTXT  = "deploy.prototxt"
DNN_CAFFEMODEL = "res10_300x300_ssd_iter_140000.caffemodel"
_PROTOTXT_URL  = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
_CAFFEMODEL_URL = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

dnn_net = None  # OpenCV DNN face detector
# Haar cascade kept as fallback in case DNN files can't be downloaded
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def _download_dnn_files():
    """Download DNN detector weights if not already present."""
    for path, url in [(DNN_PROTOTXT, _PROTOTXT_URL), (DNN_CAFFEMODEL, _CAFFEMODEL_URL)]:
        if not os.path.exists(path):
            print(f"Downloading {path} ...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  ✓ {path} downloaded.")
            except Exception as e:
                print(f"  ✗ Failed to download {path}: {e}")

def load_dnn_detector():
    global dnn_net
    _download_dnn_files()
    if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
        dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
        print("DNN face detector loaded.")
    else:
        print("DNN detector files missing — falling back to Haar cascade.")

def detect_faces_dnn(img, conf_threshold=0.5):
    """
    Returns list of (x, y, w, h) bounding boxes using the SSD DNN detector.
    Falls back to Haar cascade if DNN is unavailable.
    """
    if dnn_net is None:
        gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(img, (300, 300)), 1.0,
                                  (300, 300), (104.0, 177.0, 123.0))
    dnn_net.setInput(blob)
    detections = dnn_net.forward()

    boxes = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence < conf_threshold:
            continue
        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
        x1, y1, x2, y2 = box.astype(int)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        boxes.append((x1, y1, x2 - x1, y2 - y1))
    return boxes

# Initialise DNN detector at startup
load_dnn_detector()

is_loading_model = False

def load_custom_model():
    global custom_model, class_names, is_loading_model
    is_loading_model = True
    print("Loading custom trained model (lazy load)...")
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
            custom_model = tf.keras.models.load_model(MODEL_PATH)
            with open(CLASS_NAMES_PATH, "r") as f:
                class_names = json.load(f)
            print(f"Model loaded with classes: {class_names}")
        else:
            print("Custom model not found on disk.")
    except Exception as e:
        print(f"\nCRITICAL ERROR LOADING MODEL: {e}\n")
    finally:
        is_loading_model = False


def auto_train_if_needed():
    """
    If no trained model exists (e.g. fresh Render deployment),
    run train_model.py synchronously so the service is ready immediately.
    This is the free-tier solution — no shell access needed.
    """
    if not os.path.exists(MODEL_PATH):
        dataset_has_data = (
            os.path.isdir(DATASET_DIR) and
            any(
                os.path.isdir(os.path.join(DATASET_DIR, d))
                for d in os.listdir(DATASET_DIR)
            )
        )
        if dataset_has_data:
            print("="*55)
            print("  No model found — auto-training from dataset...")
            print("  This runs once on first deployment. Please wait.")
            print("="*55)
            try:
                result = subprocess.run(
                    ["python", "train_model.py"],
                    check=True,
                    timeout=1800  # 30 min max
                )
                print("Auto-training completed. Loading model...")
                load_custom_model()
            except subprocess.TimeoutExpired:
                print("Auto-training timed out after 30 minutes.")
            except subprocess.CalledProcessError as e:
                print(f"Auto-training failed with exit code {e.returncode}.")
            except Exception as e:
                print(f"Auto-training error: {e}")
        else:
            print("No dataset found — skipping auto-training.")
    else:
        pass

# We do NOT load the model at startup anymore.
# This ensures the Flask app boots instantly and passes Render's health check.
# The model will be loaded automatically on the first request.

is_training = False

def background_train(name=None, teacher_email=None):
    global is_training
    try:
        is_training = True
        print(f"Starting background training for {name}...")
        subprocess.run(["python", "train_model.py"], check=True)
        print("Training completed. Reloading model...")
        load_custom_model()
        
        # Notify Node.js backend
        if name and teacher_email:
            node_url = os.environ.get('NODE_API_URL', 'http://localhost:5000')
            webhook_secret = os.environ.get('WEBHOOK_SECRET', '')
            try:
                print(f"Sending notification webhook to {node_url} for {teacher_email}")
                requests.post(f"{node_url}/api/attendance/notify-training", json={
                    "name": name,
                    "email": teacher_email
                }, headers={"x-webhook-secret": webhook_secret}, timeout=10)
            except Exception as e:
                print(f"Failed to send notification webhook: {e}")
                
    except Exception as e:
        print(f"Error during background training: {e}")
    finally:
        is_training = False

@app.route('/status', methods=['GET'])
def get_status():
    if not os.path.exists(DATASET_DIR):
        return jsonify({"status": "Dataset directory not found."}), 503
        
    if is_loading_model:
        model_status = "Loading (starting up...)"
    elif custom_model is not None:
        model_status = "Loaded"
    else:
        model_status = "Not Trained"
    
    # Get all subdirectories in dataset
    classes = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    return jsonify({
        "status": "Running", 
        "classes": classes,
        "model_status": model_status,
        "trained_classes": class_names,
        "is_training": is_training
    })

@app.route('/predict', methods=['POST'])
def predict():
    global custom_model
    
    # Lazy load the model on the first request
    if custom_model is None and not is_loading_model:
        load_custom_model()
        
    if is_loading_model:
        return jsonify({"error": "Service is warming up and loading the ML model. This takes about 45 seconds. Please try again."}), 503

    if custom_model is None:
        return jsonify({"error": "Failed to load custom model. Model files missing."}), 500

    if 'image' not in request.files:
        return jsonify({"error": "No image part in the request"}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if custom_model is None:
        return jsonify({"error": "Custom model is not trained yet. Please run train_model.py."}), 500

    try:
        # Save the uploaded file temporarily
        temp_filename = "temp_incoming_face.jpg"
        file.save(temp_filename)

        # Read the image with OpenCV
        img = cv2.imread(temp_filename)
        if img is None:
            return jsonify({"error": "Invalid image file."}), 400
            
        # Detect faces using DNN detector (falls back to Haar if unavailable)
        faces = detect_faces_dnn(img)
        
        if len(faces) == 0:
            if os.path.exists(temp_filename): os.remove(temp_filename)
            return jsonify({"error": "No face detected in the image."}), 404
            
        # If multiple faces, pick the largest one assuming it's the target
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        x, y, w, h = faces[0]
        
        margin = int(w * 0.2)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(img.shape[1], x + w + margin)
        y2 = min(img.shape[0], y + h + margin)

        # Crop and preprocess face for MobileNetV2
        face_img = img[y1:y2, x1:x2]
        face_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        face_img = cv2.resize(face_img, (IMG_SIZE, IMG_SIZE))

        # Expand dims -> (1, 160, 160, 3)
        input_data = np.expand_dims(face_img, axis=0).astype(np.float32)
        
        # Make a prediction with our custom CNN model!
        predictions = custom_model.predict(input_data)
        best_match_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][best_match_idx])
        predicted_class_name = class_names[best_match_idx]
        
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        # Threshold for recognition — 85% to avoid false positives with softmax
        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "error": "No confident match found. Face unrecognized.",
                "confidence": confidence
            }), 404

        return jsonify({
            "match": predicted_class_name,
            "confidence": confidence,
            # We add a fake distance just to keep frontend compatibility if it expects distance
            "distance": 1.0 - confidence 
        })

    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        if os.path.exists("temp_incoming_face.jpg"):
            os.remove("temp_incoming_face.jpg")
        return jsonify({"error": str(e)}), 500

@app.route('/reload-model', methods=['POST'])
def reload_model():
    """Endpoint to reload the custom trained model after running train_model.py"""
    load_custom_model()
    if custom_model is not None:
        return jsonify({"status": "Model reloaded successfully."})
    return jsonify({"error": "Failed to load custom model. Ensure train_model.py was executed."}), 500

@app.route('/register-face', methods=['POST'])
def register_face():
    """
    Accepts: multipart/form-data with:
      - name: str  (student's name — used as folder name)
      - images: one or more image files
    Saves face crops to dataset/<name>/ and returns count saved.
    """
    name = request.form.get('name', '').strip()
    teacher_email = request.form.get('teacherEmail', '').strip()
    if not name:
        return jsonify({'error': 'Student name is required.'}), 400

    files = request.files.getlist('images')
    if not files:
        return jsonify({'error': 'No images uploaded.'}), 400

    save_dir = os.path.join(DATASET_DIR, name)
    os.makedirs(save_dir, exist_ok=True)

    saved = 0
    skipped = 0

    for file in files:
        try:
            img_array = np.frombuffer(file.read(), np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                skipped += 1
                continue

            # Detect face using DNN detector
            faces = detect_faces_dnn(img)
            if len(faces) == 0:
                skipped += 1
                continue

            # Crop the largest face with padding
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            margin = int(w * 0.25)
            x1 = max(0, x - margin)
            y1 = max(0, y - margin)
            x2 = min(img.shape[1], x + w + margin)
            y2 = min(img.shape[0], y + h + margin)
            face_crop = img[y1:y2, x1:x2]

            # Save with sequential filename
            existing = len(os.listdir(save_dir))
            filename = os.path.join(save_dir, f'frame_{existing:04d}.jpg')
            cv2.imwrite(filename, face_crop)
            saved += 1
        except Exception as e:
            print(f'Error processing image: {e}')
            skipped += 1

    total_in_folder = len(os.listdir(save_dir))
    
    # Trigger background training automatically
    if not is_training and total_in_folder >= 30:
        threading.Thread(target=background_train, args=(name, teacher_email)).start()
        
    return jsonify({
        'message': f'Saved {saved} face images for "{name}".',
        'saved': saved,
        'skipped': skipped,
        'total_in_folder': total_in_folder,
        'name': name,
        'is_training': not is_training and total_in_folder >= 30
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)

