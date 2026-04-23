FROM python:3.10-slim

WORKDIR /app

# Using opencv-python-headless so we don't need system libraries

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python && \
    pip install --no-cache-dir opencv-python-headless

COPY . .

# Run with Gunicorn, binding to PORT environment variable with a fallback to 5001
# We use a single worker with threads to safely handle background training
CMD ["sh", "-c", "gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT:-5001} --timeout 120 app:app"]
