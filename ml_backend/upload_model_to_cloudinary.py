"""
Run this locally after training to upload the model to Cloudinary.
The deployed ML service will download it on startup.

Usage:
    cd ml_backend
    python train_model.py          # train locally first
    python upload_model_to_cloudinary.py
"""

import os
import json
import cloudinary
import cloudinary.uploader
import storage
from dotenv import load_dotenv

# Load credentials from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True,
)

BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH       = os.path.join(BASE_DIR, 'custom_face_model_v2.keras')
CLASS_NAMES_PATH = os.path.join(BASE_DIR, 'class_names.json')

def main():
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at {MODEL_PATH}")
        print("Run: python train_model.py first")
        return

    if not os.path.exists(CLASS_NAMES_PATH):
        print(f"class_names.json not found at {CLASS_NAMES_PATH}")
        return

    with open(CLASS_NAMES_PATH) as f:
        classes = json.load(f)
    print(f"Classes: {classes}")

    print("Uploading model and class names to Cloudinary in chunks...")
    success = storage.upload_model(MODEL_PATH, classes)
    if success:
        print("[OK] Model and class names uploaded successfully.")
    else:
        print("[ERROR] Failed to upload model.")
    print("\nDone! The deployed ML service will download this model on next startup.")
    print("Trigger a redeploy on Render or hit POST /reload-model to load it now.")

if __name__ == "__main__":
    main()
