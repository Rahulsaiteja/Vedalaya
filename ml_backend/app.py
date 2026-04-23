from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import os
import json
import numpy as np
import threading
import subprocess
import requests

# Force TensorFlow to use legacy Keras 2 (required for loading older models with renorm)
os.environ['TF_USE_LEGACY_KERAS'] = '1'
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

# Load global variables for the model
custom_model = None
class_names = []

# Load the cascade classifier for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def load_custom_model():
    global custom_model, class_names
    if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
        print("Loading custom trained model...")
        try:
            custom_model = tf.keras.models.load_model(MODEL_PATH)
            with open(CLASS_NAMES_PATH, "r") as f:
                class_names = json.load(f)
            print(f"Model loaded with classes: {class_names}")
        except Exception as e:
            print(f"\nCRITICAL ERROR LOADING MODEL: {e}\n")
    else:
        print("Custom model not found. Please run train_model.py first.")

# Initial load
load_custom_model()

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
            try:
                print(f"Sending notification webhook to {node_url} for {teacher_email}")
                requests.post(f"{node_url}/api/attendance/notify-training", json={
                    "name": name,
                    "email": teacher_email
                }, timeout=10)
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
        
    model_status = "Loaded" if custom_model is not None else "Not Trained"
    
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
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces in the image
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))
        
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
            
        # Threshold for recognition (e.g., 60% confidence)
        if confidence < 0.6:
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

            # Detect face in the uploaded image
            gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1,
                                                  minNeighbors=5, minSize=(30, 30))
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

