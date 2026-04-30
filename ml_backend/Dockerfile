FROM python:3.10-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download DNN face detector files at build time
RUN wget -q -O deploy.prototxt \
    "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt" && \
    wget -q -O res10_300x300_ssd_iter_140000.caffemodel \
    "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

# Hugging Face Spaces requires a non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# HF Spaces always uses port 7860
ENV PORT=7860
CMD gunicorn -w 1 --threads 4 -b 0.0.0.0:7860 --timeout 300 app:app
