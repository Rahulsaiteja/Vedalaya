"""
One-time script to upload your existing local dataset to Cloudinary.
Run this locally: python upload_existing_dataset.py

It reads from ml_backend/dataset/ and uploads all face images to Cloudinary
so the deployed ML service can use them for training.
"""

import os
import sys
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

# Load from backend/.env since that's where your credentials are
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True,
)

DATASET_DIR  = os.path.join(os.path.dirname(__file__), 'dataset')
FACES_FOLDER = "vedalaya_faces"

def upload_dataset():
    if not os.path.isdir(DATASET_DIR):
        print(f"Dataset directory not found: {DATASET_DIR}")
        sys.exit(1)

    students = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    if not students:
        print("No student folders found in dataset/")
        sys.exit(1)

    print(f"Found {len(students)} students: {students}\n")
    total_uploaded = 0
    total_skipped  = 0

    for student in students:
        student_dir = os.path.join(DATASET_DIR, student)
        images = [f for f in os.listdir(student_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        print(f"Uploading {len(images)} images for '{student}'...")

        for i, img_file in enumerate(sorted(images)):
            img_path   = os.path.join(student_dir, img_file)
            public_id  = f"{FACES_FOLDER}/{student}/frame_{i:04d}"

            try:
                cloudinary.uploader.upload(
                    img_path,
                    public_id=public_id,
                    resource_type="image",
                    overwrite=False,  # skip if already uploaded
                )
                total_uploaded += 1
                if (i + 1) % 10 == 0:
                    print(f"  {i + 1}/{len(images)} uploaded...")
            except Exception as e:
                print(f"  Skipped {img_file}: {e}")
                total_skipped += 1

        print(f"  ✓ Done: {student}\n")

    print(f"Upload complete: {total_uploaded} uploaded, {total_skipped} skipped.")
    print("\nNow trigger retraining by registering any student via the UI,")
    print("or hit POST /reload-model on your ML service after training.")

if __name__ == "__main__":
    upload_dataset()
