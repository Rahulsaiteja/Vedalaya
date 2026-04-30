---
title: Vedalaya ML Service
emoji: 🎓
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# Vedalaya ML Service

Face recognition microservice for the Vedalaya educational platform.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Model status & trained classes |
| POST | `/predict` | Recognize a face (multipart `image`) |
| POST | `/register-face` | Register new student face images |
| POST | `/retrain` | Manually trigger retraining |
| POST | `/reload-model` | Reload model from Cloudinary |

## Environment Variables (Space Secrets)

Set these in the Space Settings → Variables and Secrets:

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NODE_API_URL=https://your-backend.onrender.com
WEBHOOK_SECRET=your_shared_secret
```

## Architecture

- Face images stored on **Cloudinary** (persistent)
- Trained model stored on **Cloudinary** (persistent)
- On new student registration (≥30 images): auto-retrains using MobileNetV2
- Training takes ~5–10 minutes, then model is reloaded automatically
