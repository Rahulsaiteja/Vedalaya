import cv2
import os
import argparse

def main():
    parser = argparse.ArgumentParser(description="Collect face data for a specific person.")
    parser.add_argument("--name", type=str, required=True, help="Name of the person (will be the folder name and class name).")
    parser.add_argument("--count", type=int, default=100, help="Number of images to capture.")
    args = parser.parse_args()

    name = args.name
    total_images = args.count
    output_dir = os.path.join("dataset", name)
    os.makedirs(output_dir, exist_ok=True)

    # Initialize webcam and Haarcascade for face detection
    cap = cv2.VideoCapture(0)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    count = 0
    print(f"Starting data collection for {name}. Look at the camera...")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame. Exiting.")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

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
