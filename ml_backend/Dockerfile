FROM python:3.10-slim

WORKDIR /app

# Using opencv-python-headless so we don't need system libraries

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render injects PORT at runtime. Gunicorn binds to it directly.
# We use a single worker with threads to safely handle background training
CMD gunicorn -w 1 --threads 4 -b 0.0.0.0:$PORT --timeout 1800 app:app
