import cv2
import os
import argparse
import numpy as np
import urllib.request

DNN_PROTOTXT   = "deploy.prototxt"
DNN_CAFFEMODEL = "res10_300x300_ssd_iter_140000.caffemodel"
_PROTOTXT_URL  = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
_CAFFEMODEL_URL = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

def _download_dnn_files():
    for path, url in [(DNN_PROTOTXT, _PROTOTXT_URL), (DNN_CAFFEMODEL, _CAFFEMODEL_URL)]:
        if not os.path.exists(path):
            print(f"Downloading {path} ...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  ✓ {path} downloaded.")
            except Exception as e:
                print(f"  ✗ Failed to download {path}: {e}")

def detect_faces(img, dnn_net, face_cascade, conf_threshold=0.5):
    """DNN detector with Haar fallback. Returns list of (x, y, w, h)."""
    if dnn_net is not None:
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
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

def main():
    parser = argparse.ArgumentParser(description="Collect face data for a specific person.")
    parser.add_argument("--name", type=str, required=True, help="Name of the person (will be the folder name and class name).")
    parser.add_argument("--count", type=int, default=100, help="Number of images to capture.")
    args = parser.parse_args()

    name = args.name
    total_images = args.count
    output_dir = os.path.join("dataset", name)
    os.makedirs(output_dir, exist_ok=True)

    # Initialize DNN detector (download if needed) with Haar fallback
    _download_dnn_files()
    dnn_net = None
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if os.path.exists(DNN_PROTOTXT) and os.path.exists(DNN_CAFFEMODEL):
        dnn_net = cv2.dnn.readNetFromCaffe(DNN_PROTOTXT, DNN_CAFFEMODEL)
        print("Using DNN face detector.")
    else:
        print("Using Haar cascade face detector.")

    # Initialize webcam
    cap = cv2.VideoCapture(0)

    count = 0
    print(f"Starting data collection for {name}. Look at the camera...")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame. Exiting.")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = detect_faces(frame, dnn_net, face_cascade)

        for (x, y, w, h) in faces:
            # We add a slight margin to crop the whole face plus a bit of context
            margin = int(w * 0.2)
            x1 = max(0, x - margin)
            y1 = max(0, y - margin)
            x2 = min(frame.shape[1], x + w + margin)
            y2 = min(frame.shape[0], y + h + margin)

            face_img = frame[y1:y2, x1:x2]
            
            # Save the cropped face image
            file_name = os.path.join(output_dir, f"{count}.jpg")
            
            if face_img.shape[0] > 0 and face_img.shape[1] > 0:
                # We no longer explicitly resize so DeepFace can use highest resolution 
                cv2.imwrite(file_name, face_img)
                count += 1

            # Draw a rectangle around the face on the preview screen
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(frame, f"Captured: {count}/{total_images}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow("Data Collection window", frame)

        # Break early if 'q' is pressed or if enough images are captured
        if cv2.waitKey(1) & 0xFF == ord('q') or count >= total_images:
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"Done! Captured {count} images and saved to {output_dir}")

if __name__ == "__main__":
    main()
