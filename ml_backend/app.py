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
os.environ['TF_USE_LEGACY_KERAS'] = '1'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import tensorflow as tf

# ── Monkey-patch Normalization BEFORE any model loading ───────────────────────
# The .keras format validates normalization weights during file parsing.
# This patch makes Normalization silently skip missing weights instead of crashing.
try:
    _OrigNorm = tf.keras.layers.Normalization

    class _PatchedNorm(_OrigNorm):
        def _set_hyper(self, name, value):
            try:
                super()._set_hyper(name, value)
            except Exception:
                pass

        def set_weights(self, weights):
            try:
                super().set_weights(weights)
            except Exception:
                # Adapt with zeros so the layer has valid state
                try:
                    dummy = np.zeros((1, 1), dtype=np.float32)
                    self.adapt(dummy)
                except Exception:
                    pass

        def from_config(cls, config):
            config.pop('mean', None)
            config.pop('variance', None)
            obj = cls(**{k: v for k, v in config.items()
                         if k not in ('name', 'trainable', 'dtype')})
            return obj

    tf.keras.layers.Normalization = _PatchedNorm
    # Also patch in the layers module namespace
    import tensorflow.keras.layers as _kl
    _kl.Normalization = _PatchedNorm
    print("✅ Normalization layer patched for safe loading")
except Exception as _patch_err:
    print(f"⚠️  Could not patch Normalization: {_patch_err}")

tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(1)

import storage  # Cloudinary persistence layer

app = Flask(__name__)
CORS(app)

BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
DATA_DIR         = os.environ.get('DATA_DIR', BASE_DIR)
DATASET_DIR      = os.path.join(DATA_DIR, "dataset")
MODEL_PATH       = os.path.join(DATA_DIR, "custom_face_model_v2.keras")
H5_MODEL_PATH    = os.path.join(DATA_DIR, "custom_face_model_deploy.h5")
CLASS_NAMES_PATH = os.path.join(DATA_DIR, "class_names.json")
IMG_SIZE         = 224
CONFIDENCE_THRESHOLD = 0.22  # 9-class model; devi/Devi split reduces per-class probability

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
eye_cascade  = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

def apply_clahe(img_bgr):
    """Normalize lighting — applied consistently at both train and predict time."""
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def align_face(face_bgr):
    """Align face by rotating so eyes are horizontal."""
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20))
    if len(eyes) < 2:
        return face_bgr
    eyes = sorted(eyes, key=lambda e: e[0])
    (x1, y1, w1, h1) = eyes[0]
    (x2, y2, w2, h2) = eyes[1]
    eye1_center = (x1 + w1 // 2, y1 + h1 // 2)
    eye2_center = (x2 + w2 // 2, y2 + h2 // 2)
    dy = eye2_center[1] - eye1_center[1]
    dx = eye2_center[0] - eye1_center[0]
    angle = np.degrees(np.arctan2(dy, dx))
    mid = (float((eye1_center[0] + eye2_center[0]) // 2),
           float((eye1_center[1] + eye2_center[1]) // 2))
    h, w = face_bgr.shape[:2]
    M = cv2.getRotationMatrix2D(mid, angle, 1.0)
    return cv2.warpAffine(face_bgr, M, (w, h), flags=cv2.INTER_CUBIC)


def preprocess_face_for_predict(face_bgr):
    """Full preprocessing pipeline — must match train_model.py exactly."""
    face_bgr = apply_clahe(face_bgr)
    face_bgr = align_face(face_bgr)
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    face_rgb = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE))
    return face_rgb.astype(np.float32)


def predict_with_tta(model, face_bgr):
    """
    Test-Time Augmentation: run 5 slightly varied versions of the face
    through the model and average predictions. Improves accuracy on
    borderline cases (different lighting, slight angle).
    """
    base = preprocess_face_for_predict(face_bgr)

    # Generate TTA variants
    variants = [base]

    # Slight brightness variations
    bright = np.clip(base * 1.15, 0, 255).astype(np.float32)
    dark   = np.clip(base * 0.85, 0, 255).astype(np.float32)
    variants.extend([bright, dark])

    # Horizontal flip
    flipped = base[:, ::-1, :].copy()
    variants.append(flipped)

    # Slight zoom (center crop + resize back)
    h, w = base.shape[:2]
    margin = int(h * 0.05)
    zoomed = base[margin:h-margin, margin:w-margin, :]
    zoomed = cv2.resize(zoomed, (IMG_SIZE, IMG_SIZE)).astype(np.float32)
    variants.append(zoomed)

    batch = np.stack(variants, axis=0)  # (5, H, W, 3)
    preds = model.predict(batch, verbose=0)  # (5, num_classes)
    avg_pred = np.mean(preds, axis=0)
    return avg_pred

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

def load_dnn_detector():
    global dnn_net
    if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
        dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
        print("DNN face detector loaded.")
    else:
        print("DNN detector files missing — falling back to Haar cascade.")
def load_custom_model():
    global custom_model, class_names, model_load_error
    with _model_lock:
        if custom_model is not None:
            return
        print("Loading ML model...")

        try:
            # Prefer clean .h5 (no normalization issues ever)
            load_path = H5_MODEL_PATH if os.path.exists(H5_MODEL_PATH) else MODEL_PATH

            if os.path.exists(load_path) and os.path.exists(CLASS_NAMES_PATH):
                print(f"Loading from: {load_path}")
                # Normalization is globally patched at startup — plain load works
                custom_model = tf.keras.models.load_model(
                    load_path,
                    compile=False,
                    safe_mode=False,
                )
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
    """
    Runs on HF Spaces (16GB RAM) — performs full training:
      1. Download all face images from Cloudinary
      2. Run train_model.py
      3. Upload new model to Cloudinary
      4. Reload model in memory
      5. Notify Node backend via webhook
    """
    global is_training, custom_model
    is_training = True
    node_url       = os.environ.get('NODE_API_URL', 'http://localhost:5000')
    webhook_secret = os.environ.get('WEBHOOK_SECRET', '')
    try:
        print("[Train] Syncing dataset from Cloudinary...")
        storage.download_all_faces(DATASET_DIR)

        print("[Train] Starting train_model.py...")
        result = subprocess.run(
            ["python", os.path.join(BASE_DIR, "train_model.py")],
            cwd=BASE_DIR,
            check=True,
            env={**os.environ, "DATA_DIR": DATA_DIR},
            capture_output=True,
            text=True
        )
        print("[Train] stdout:", result.stdout[-3000:] if result.stdout else "(none)")

        if os.path.exists(MODEL_PATH) and os.path.exists(CLASS_NAMES_PATH):
            with open(CLASS_NAMES_PATH, "r") as f:
                trained_classes = json.load(f)
            storage.upload_model(MODEL_PATH, trained_classes)
            custom_model = None
            load_custom_model()
            print("[Train] Complete — model reloaded.")
            train_status = "complete"
        else:
            print("[Train] ERROR: Model file missing after training.")
            train_status = "failed"

        # Notify Node backend
        if name and teacher_email:
            try:
                http_requests.post(
                    f"{node_url}/api/attendance/notify-training",
                    json={"name": name, "email": teacher_email, "status": train_status},
                    headers={"x-webhook-secret": webhook_secret},
                    timeout=10
                )
            except Exception as e:
                print(f"[Train] Webhook failed: {e}")

    except subprocess.CalledProcessError as e:
        print(f"[Train] Subprocess error: {e}")
        print(f"[Train] stderr: {e.stderr[-2000:] if e.stderr else ''}")
    except Exception as e:
        print(f"[Train] Unexpected error: {e}")
    finally:
        is_training = False

# ── Startup ───────────────────────────────────────────────────────────────────
load_dnn_detector()

# ── SafeNormalization (shared — used by load and heal) ────────────────────────
class SafeNormalization(tf.keras.layers.Layer):
    """Pass-through replacement for broken Normalization layers saved without weights."""
    def __init__(self, axis=-1, mean=None, variance=None, **kwargs):
        super().__init__(**kwargs)
        self.axis = axis
    def call(self, inputs, training=None):
        return inputs
    def get_config(self):
        cfg = super().get_config()
        cfg.update({"axis": self.axis})
        return cfg

def heal_model_if_needed():
    """
    Self-healing: download the .keras model, load it with SafeNormalization,
    strip augmentation, save as .h5 (which never has normalization weight issues),
    and re-upload to Cloudinary as the new canonical model.
    Runs once on startup if the .h5 version doesn't exist yet.
    """
    # If clean .h5 already exists, nothing to do
    if os.path.exists(H5_MODEL_PATH):
        print("[Heal] Clean .h5 model already exists — skipping heal.")
        return True

    # Need the .keras file to convert from
    if not os.path.exists(MODEL_PATH):
        print("[Heal] No .keras model on disk — skipping heal.")
        return False

    print("[Heal] Converting .keras → .h5 to fix normalization issue...")
    try:
        # Load with global Normalization patch (no custom_object_scope needed)
        broken = tf.keras.models.load_model(
            MODEL_PATH, compile=False, safe_mode=False
        )
        print(f"[Heal] Loaded .keras model ({len(broken.layers)} layers)")

        # Strip augmentation Sequential block
        aug_layer = None
        for layer in broken.layers:
            if isinstance(layer, tf.keras.Sequential):
                aug_types = (
                    tf.keras.layers.RandomFlip,
                    tf.keras.layers.RandomRotation,
                    tf.keras.layers.RandomBrightness,
                    tf.keras.layers.RandomZoom,
                    tf.keras.layers.RandomContrast,
                    tf.keras.layers.RandomTranslation,
                )
                if layer.name == "augmentation" or any(
                    isinstance(l, aug_types) for l in layer.layers
                ):
                    aug_layer = layer
                    break

        if aug_layer is not None:
            print(f"[Heal] Stripping augmentation block: '{aug_layer.name}'")
            inp = broken.input
            x = inp
            skip = True
            for layer in broken.layers[1:]:
                if layer is aug_layer:
                    skip = False
                    continue
                if skip:
                    continue
                x = layer(x)
            clean = tf.keras.Model(inputs=inp, outputs=x)
        else:
            print("[Heal] No augmentation block found — using model as-is")
            clean = broken

        # Verify
        dummy = np.zeros((1, IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
        clean.predict(dummy, verbose=0)
        print("[Heal] Model verified ✅")

        # Save as .h5 — this format never has normalization weight issues
        clean.save(H5_MODEL_PATH)
        print(f"[Heal] Saved clean .h5 → {H5_MODEL_PATH}")

        # Re-upload .h5 to Cloudinary as the new canonical model
        if os.path.exists(CLASS_NAMES_PATH):
            with open(CLASS_NAMES_PATH, "r") as f:
                names = json.load(f)
            try:
                storage.upload_model(H5_MODEL_PATH, names)
                print("[Heal] Clean .h5 uploaded to Cloudinary ✅")
            except Exception as up_err:
                print(f"[Heal] Cloudinary upload failed (non-fatal): {up_err}")

        del broken, clean
        return True

    except Exception as e:
        print(f"[Heal] Failed: {e}")
        return False


def startup_sequence():
    """
    On startup:
    1. Try to download and load the model from Cloudinary
    2. If model is broken (normalization error), delete it and retrain from face images
    3. New training uses fixed train_model.py (no RandomBrightness = no normalization issue)
    """
    global custom_model

    # Download model from Cloudinary
    if not os.path.exists(H5_MODEL_PATH) and not os.path.exists(MODEL_PATH):
        print("[Startup] Downloading model from Cloudinary...")
        storage.download_model(MODEL_PATH, CLASS_NAMES_PATH)

    # Try loading — if it fails with normalization error, retrain
    load_custom_model()

    if custom_model is None and model_load_error and "normalization" in model_load_error.lower():
        print("[Startup] Broken model detected — deleting and retraining from face images...")

        # Delete broken model files
        for p in [MODEL_PATH, H5_MODEL_PATH]:
            if os.path.exists(p):
                os.remove(p)
                print(f"[Startup] Deleted broken model: {p}")

        # Download face images from Cloudinary
        print("[Startup] Syncing face dataset from Cloudinary...")
        storage.download_all_faces(DATASET_DIR)

        # Check we have enough data to retrain
        person_dirs = [d for d in os.listdir(DATASET_DIR)
                       if os.path.isdir(os.path.join(DATASET_DIR, d))] if os.path.exists(DATASET_DIR) else []

        if len(person_dirs) >= 2:
            print(f"[Startup] Found {len(person_dirs)} people — starting retrain...")
            # Run train_model.py (fixed version without RandomBrightness)
            try:
                result = subprocess.run(
                    ["python", os.path.join(BASE_DIR, "train_model.py")],
                    cwd=BASE_DIR,
                    env={**os.environ, "DATA_DIR": DATA_DIR},
                    capture_output=True,
                    text=True,
                    timeout=3600  # 1 hour max
                )
                print("[Startup] Training stdout:", result.stdout[-2000:] if result.stdout else "")
                if result.returncode == 0 and os.path.exists(MODEL_PATH):
                    # Upload new clean model
                    with open(CLASS_NAMES_PATH, "r") as f:
                        trained_classes = json.load(f)
                    storage.upload_model(MODEL_PATH, trained_classes)
                    print("[Startup] New clean model uploaded to Cloudinary ✅")
                    # Load it
                    load_custom_model()
                else:
                    print(f"[Startup] Retrain failed. stderr: {result.stderr[-1000:] if result.stderr else ''}")
            except Exception as e:
                print(f"[Startup] Retrain error: {e}")
        else:
            print(f"[Startup] Not enough people to retrain ({len(person_dirs)} found, need 2+).")
            print("[Startup] Register students again to rebuild the model.")

    if custom_model is None:
        print("[Startup] No model loaded.")
    else:
        print(f"[Startup] Ready. Classes: {class_names}")

threading.Thread(target=startup_sequence, daemon=True).start()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/force-retrain', methods=['POST', 'GET'])
def force_retrain():
    """
    Force delete broken model and retrain from Cloudinary face images.
    Call this once to fix the normalization error permanently.
    """
    global is_training, custom_model, model_load_error

    if is_training:
        return jsonify({"status": "Already training — check /status"}), 409

    def do_force_retrain():
        global is_training, custom_model, model_load_error
        is_training = True
        try:
            # Delete broken model files
            for p in [MODEL_PATH, H5_MODEL_PATH]:
                if os.path.exists(p):
                    os.remove(p)
                    print(f"[ForceRetrain] Deleted: {p}")

            # Sync face images from Cloudinary
            print("[ForceRetrain] Downloading face dataset from Cloudinary...")
            storage.download_all_faces(DATASET_DIR)

            person_dirs = [d for d in os.listdir(DATASET_DIR)
                           if os.path.isdir(os.path.join(DATASET_DIR, d))] if os.path.exists(DATASET_DIR) else []
            print(f"[ForceRetrain] People found: {person_dirs}")

            if len(person_dirs) < 2:
                model_load_error = f"Need 2+ people, found {len(person_dirs)}: {person_dirs}"
                print(f"[ForceRetrain] {model_load_error}")
                return

            # Run train_model.py (fixed — no RandomBrightness)
            print("[ForceRetrain] Starting training...")
            result = subprocess.run(
                ["python", os.path.join(BASE_DIR, "train_model.py")],
                cwd=BASE_DIR,
                env={**os.environ, "DATA_DIR": DATA_DIR},
                capture_output=True,
                text=True,
                timeout=3600
            )
            print("[ForceRetrain] stdout:", result.stdout[-3000:] if result.stdout else "")
            if result.stderr:
                print("[ForceRetrain] stderr:", result.stderr[-1000:])

            if result.returncode == 0 and os.path.exists(MODEL_PATH):
                with open(CLASS_NAMES_PATH, "r") as f:
                    trained_classes = json.load(f)
                storage.upload_model(MODEL_PATH, trained_classes)
                print("[ForceRetrain] Uploaded clean model to Cloudinary ✅")
                custom_model = None
                model_load_error = None
                load_custom_model()
                print(f"[ForceRetrain] Done. Classes: {class_names}")
            else:
                model_load_error = f"Training failed (exit {result.returncode})"
                print(f"[ForceRetrain] {model_load_error}")
        except Exception as e:
            model_load_error = f"ForceRetrain error: {e}"
            print(f"[ForceRetrain] Exception: {e}")
        finally:
            is_training = False

    threading.Thread(target=do_force_retrain, daemon=True).start()
    return jsonify({
        "status": "Retrain started — check /status every 2 minutes",
        "people": [d for d in os.listdir(DATASET_DIR)
                   if os.path.isdir(os.path.join(DATASET_DIR, d))] if os.path.exists(DATASET_DIR) else []
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200


@app.route('/debug-cloudinary', methods=['GET'])
def debug_cloudinary():
    """Check what's actually stored on Cloudinary."""
    if not storage.is_configured():
        return jsonify({"error": "Cloudinary not configured"}), 500
    try:
        import cloudinary.api
        # Check faces
        faces_result = cloudinary.api.resources(
            type="upload",
            prefix="vedalaya_faces/",
            resource_type="image",
            max_results=10,
        )
        # Check model
        try:
            import cloudinary.api as capi
            model_result = capi.resource("vedalaya_model/custom_face_model_v2", resource_type="raw")
            model_exists = True
            model_size = model_result.get("bytes", 0)
        except Exception:
            model_exists = False
            model_size = 0

        return jsonify({
            "faces_found": len(faces_result.get("resources", [])),
            "sample_faces": [r["public_id"] for r in faces_result.get("resources", [])[:5]],
            "model_exists": model_exists,
            "model_size_bytes": model_size,
            "local_dataset_dir": DATASET_DIR,
            "local_model_path": MODEL_PATH,
            "local_model_exists": os.path.exists(MODEL_PATH),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        margin = int(w * 0.25)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(img.shape[1], x + w + margin)
        y2 = min(img.shape[0], y + h + margin)
        face_crop = img[y1:y2, x1:x2]

        # Use TTA (test-time augmentation) for more robust prediction
        avg_pred   = predict_with_tta(custom_model, face_crop)
        best_idx   = int(np.argmax(avg_pred))
        confidence = float(avg_pred[best_idx])
        name       = class_names[best_idx]

        if confidence < CONFIDENCE_THRESHOLD:
            return jsonify({
                "error": f"Face not recognized. (confidence: {confidence:.2f}, threshold: {CONFIDENCE_THRESHOLD})"
            }), 404

        return jsonify({"match": name})

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
    if not is_training and total >= 100:
        training_started = True
        threading.Thread(target=background_train, args=(name, teacher_email), daemon=True).start()

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
                model_load_error = f"Model missing! STDOUT: {result.stdout[-1000:] if result.stdout else 'None'}"
        except subprocess.CalledProcessError as e:
            err_msg = f"Training crashed! Exit {e.returncode}. STDERR: {e.stderr[-1000:] if e.stderr else 'None'} STDOUT: {e.stdout[-1000:] if e.stdout else 'None'}"
            print(err_msg)
            model_load_error = err_msg
        except Exception as e:
            print(f"Retrain error: {e}")
            model_load_error = f"Retrain error: {e}"
        finally:
            is_training = False

    threading.Thread(target=do_retrain, daemon=True).start()
    return jsonify({"status": "Retraining started. Check /status for progress."})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
