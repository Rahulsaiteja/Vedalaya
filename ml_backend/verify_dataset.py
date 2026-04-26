"""
verify_dataset.py
-----------------
Checks the dataset folder and:
  1. Lists every person folder with image counts
  2. Runs face detection on every image (using OpenCV Haar cascade)
  3. Flags images with NO face detected
  4. Shows a 5x4 sample grid for each person so you can visually inspect
  5. Prints a final pass/fail summary
"""

import os
import cv2
import numpy as np

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_DIR = os.path.join(BASE_DIR, "dataset")
SAMPLE_COLS  = 5   # images per row in the preview grid
SAMPLE_ROWS  = 4   # rows in the preview grid
THUMB_SIZE   = 120 # px per thumbnail

# Haar cascade bundled with OpenCV
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)


def load_images_for_person(person_dir):
    """Return list of (filename, img_bgr) for all valid images in folder."""
    images = []
    for fname in sorted(os.listdir(person_dir)):
        if fname.lower().endswith(('.png', '.jpg', '.jpeg')):
            path = os.path.join(person_dir, fname)
            img  = cv2.imread(path)
            if img is not None:
                images.append((fname, img))
    return images


def detect_face(img_bgr):
    """Return True if at least one face is found."""
    gray  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1,
                                          minNeighbors=5, minSize=(30, 30))
    return len(faces) > 0


def make_sample_grid(images, cols=SAMPLE_COLS, rows=SAMPLE_ROWS, thumb=THUMB_SIZE):
    """Build an OpenCV image grid from the first cols*rows images."""
    subset = images[:cols * rows]
    # pad with black tiles if fewer images
    blank  = np.zeros((thumb, thumb, 3), dtype=np.uint8)
    tiles  = []
    for _, img in subset:
        tile = cv2.resize(img, (thumb, thumb))
        tiles.append(tile)
    while len(tiles) < cols * rows:
        tiles.append(blank.copy())

    rows_imgs = []
    for r in range(rows):
        row_tiles = tiles[r * cols:(r + 1) * cols]
        rows_imgs.append(np.hstack(row_tiles))
    grid = np.vstack(rows_imgs)
    return grid


def verify():
    print("=" * 60)
    print("  Dataset Verification Report")
    print("=" * 60)

    if not os.path.exists(DATASET_DIR):
        print(f"[ERROR] Dataset folder '{DATASET_DIR}' not found.")
        return

    people = sorted([
        p for p in os.listdir(DATASET_DIR)
        if os.path.isdir(os.path.join(DATASET_DIR, p))
    ])

    if not people:
        print("[ERROR] No person folders found inside 'dataset/'.")
        return

    print(f"\nFound {len(people)} people: {people}\n")

    summary = []

    for person in people:
        person_dir = os.path.join(DATASET_DIR, person)
        images     = load_images_for_person(person_dir)

        total      = len(images)
        no_face    = []

        print(f"--- {person} ({total} images) ---")

        for fname, img in images:
            if not detect_face(img):
                no_face.append(fname)

        face_count = total - len(no_face)
        pct        = (face_count / total * 100) if total > 0 else 0

        status = "PASS" if pct >= 70 and total >= 50 else "WARN"
        if total == 0:
            status = "FAIL"

        print(f"  Images with face detected : {face_count}/{total} ({pct:.1f}%)")
        if no_face:
            print(f"  [WARN] {len(no_face)} images had NO face detected:")
            for f in no_face[:10]:   # show max 10
                print(f"         - {f}")
            if len(no_face) > 10:
                print(f"         ... and {len(no_face) - 10} more")

        if total < 50:
            print(f"  [WARN] Only {total} images — recommend at least 50.")
        if "actual name" in person.lower() or "student" in person.lower():
            print(f"  [WARN] Folder name '{person}' looks like a placeholder."
                  f" Rename it to the real person's name.")

        print(f"  Status: {status}")
        summary.append((person, total, face_count, pct, status))

        # Show grid preview
        if images:
            grid = make_sample_grid(images)
            win  = f"Sample: {person}  (press any key for next)"
            cv2.imshow(win, grid)
            print(f"  [Preview] Close the window / press any key to continue...")
            cv2.waitKey(0)
            cv2.destroyAllWindows()

        print()

    # Final summary table
    print("=" * 60)
    print("  Summary")
    print("=" * 60)
    print(f"  {'Person':<20} {'Images':>7} {'Faces':>7} {'Face%':>7} {'Status':>6}")
    print(f"  {'-'*20} {'-'*7} {'-'*7} {'-'*7} {'-'*6}")
    all_pass = True
    for person, total, faces, pct, status in summary:
        flag = "" if status == "PASS" else " <--"
        print(f"  {person:<20} {total:>7} {faces:>7} {pct:>6.1f}% {status:>6}{flag}")
        if status != "PASS":
            all_pass = False

    print()
    if all_pass:
        print("  [RESULT] All checks passed! Ready to train.")
    else:
        print("  [RESULT] Fix the warnings above, then re-run train_model.py.")
    print("=" * 60)


if __name__ == "__main__":
    verify()
