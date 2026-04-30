"""
Cloudinary-backed persistent storage for the ML service.

All dataset images and the trained model are stored on Cloudinary so they
survive Render free-tier redeploys (ephemeral filesystem).

Folder layout on Cloudinary:
  vedalaya_faces/<student_name>/frame_0001   (raw images, resource_type=image)
  vedalaya_model/custom_face_model_v2        (model .h5, resource_type=raw)
  vedalaya_model/class_names                 (JSON, resource_type=raw)
"""

import os
import json
import tempfile
import requests
import cloudinary
import cloudinary.uploader
import cloudinary.api

# ── Configure from env vars ───────────────────────────────────────────────────
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True,
)

FACES_FOLDER = "vedalaya_faces"
MODEL_FOLDER = "vedalaya_model"
MODEL_PUBLIC_ID = f"{MODEL_FOLDER}/custom_face_model_v2"
CLASSES_PUBLIC_ID = f"{MODEL_FOLDER}/class_names"


def is_configured():
    """Return True if Cloudinary credentials are set."""
    cfg = cloudinary.config()
    return bool(cfg.cloud_name and cfg.api_key and cfg.api_secret)


# ── Face image storage ────────────────────────────────────────────────────────

def upload_face_image(image_bytes, student_name, index):
    """Upload a face crop (bytes) to Cloudinary. Returns public_id or None."""
    if not is_configured():
        return None
    try:
        result = cloudinary.uploader.upload(
            image_bytes,
            public_id=f"{FACES_FOLDER}/{student_name}/frame_{index:04d}",
            resource_type="image",
            overwrite=True,
        )
        return result.get('public_id')
    except Exception as e:
        print(f"Cloudinary upload_face_image error: {e}")
        return None


def download_all_faces(local_dataset_dir):
    """
    Download all face images from Cloudinary into local_dataset_dir.
    Creates dataset/<name>/frame_XXXX.jpg locally.
    Returns total number of images downloaded.
    """
    if not is_configured():
        print("Cloudinary not configured — skipping face download.")
        return 0

    total = 0
    try:
        # List all resources under vedalaya_faces/
        next_cursor = None
        while True:
            kwargs = {
                "type": "upload",
                "prefix": FACES_FOLDER + "/",
                "resource_type": "image",
                "max_results": 500,
            }
            if next_cursor:
                kwargs["next_cursor"] = next_cursor

            result = cloudinary.api.resources(**kwargs)
            resources = result.get("resources", [])

            for r in resources:
                public_id = r["public_id"]
                # public_id = vedalaya_faces/<name>/frame_XXXX
                parts = public_id.split("/")
                if len(parts) < 3:
                    continue
                student_name = parts[1]
                filename = parts[2] + ".jpg"

                save_dir = os.path.join(local_dataset_dir, student_name)
                os.makedirs(save_dir, exist_ok=True)
                local_path = os.path.join(save_dir, filename)

                if not os.path.exists(local_path):
                    url = r["secure_url"]
                    resp = requests.get(url, timeout=30)
                    if resp.status_code == 200:
                        with open(local_path, "wb") as f:
                            f.write(resp.content)
                        total += 1

            next_cursor = result.get("next_cursor")
            if not next_cursor:
                break

    except Exception as e:
        print(f"Cloudinary download_all_faces error: {e}")

    print(f"Downloaded {total} face images from Cloudinary.")
    return total


def count_faces_for_student(student_name):
    """Return number of face images stored on Cloudinary for a student."""
    if not is_configured():
        return 0
    try:
        result = cloudinary.api.resources(
            type="upload",
            prefix=f"{FACES_FOLDER}/{student_name}/",
            resource_type="image",
            max_results=500,
        )
        return len(result.get("resources", []))
    except Exception as e:
        print(f"Cloudinary count_faces error: {e}")
        return 0


# ── Model storage ─────────────────────────────────────────────────────────────

def upload_model(model_path, class_names):
    """Upload trained model .keras (chunked) and class_names list to Cloudinary."""
    if not is_configured():
        print("Cloudinary not configured — model not uploaded.")
        return False
    try:
        # Split model into 9MB chunks to bypass 10MB raw limit
        CHUNK_SIZE = 9 * 1024 * 1024
        with open(model_path, "rb") as f:
            data = f.read()
        
        chunks = [data[i:i + CHUNK_SIZE] for i in range(0, len(data), CHUNK_SIZE)]
        
        for i, chunk in enumerate(chunks):
            cloudinary.uploader.upload(
                chunk,
                public_id=f"{MODEL_PUBLIC_ID}_part{i}",
                resource_type="raw",
                overwrite=True,
            )
            print(f"Model part {i} uploaded to Cloudinary.")

        # Upload class names as JSON raw file
        class_json = json.dumps(class_names).encode("utf-8")
        cloudinary.uploader.upload(
            class_json,
            public_id=CLASSES_PUBLIC_ID,
            resource_type="raw",
            overwrite=True,
        )
        print("Class names uploaded to Cloudinary.")
        return True
    except Exception as e:
        print(f"Cloudinary upload_model error: {e}")
        return False


def download_model(local_model_path, local_classes_path):
    """
    Download model .keras (recombining chunks) and class_names.json from Cloudinary to local paths.
    Returns True if both files were downloaded successfully.
    """
    if not is_configured():
        print("Cloudinary not configured — skipping model download.")
        return False
    try:
        # Recombine model chunks
        model_data = bytearray()
        part = 0
        while True:
            try:
                part_info = cloudinary.api.resource(f"{MODEL_PUBLIC_ID}_part{part}", resource_type="raw")
                resp = requests.get(part_info["secure_url"], timeout=120)
                if resp.status_code == 200:
                    model_data.extend(resp.content)
                    part += 1
                else:
                    break
            except cloudinary.exceptions.NotFound:
                break
        
        if part == 0:
            print("No model parts found on Cloudinary yet — needs training first.")
            return False

        with open(local_model_path, "wb") as f:
            f.write(model_data)
        print(f"Model downloaded (recombined {part} parts) → {local_model_path}")

        # Download class names
        classes_info = cloudinary.api.resource(CLASSES_PUBLIC_ID, resource_type="raw")
        resp = requests.get(classes_info["secure_url"], timeout=30)
        if resp.status_code != 200:
            print(f"Failed to download class names: HTTP {resp.status_code}")
            return False
        with open(local_classes_path, "wb") as f:
            f.write(resp.content)
        print(f"Class names downloaded from Cloudinary → {local_classes_path}")

        return True
    except cloudinary.exceptions.NotFound:
        print("Classes file not found on Cloudinary.")
        return False
    except Exception as e:
        print(f"Cloudinary download_model error: {e}")
        return False
