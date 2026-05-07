---
title: Flashcard Generator
emoji: 🎴
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.9.1
app_file: app.py
pinned: false
license: mit
---

# 🎴 AI Flashcard Generator

Generate educational flashcards from any text using AI transformer models.

## Features

- 🤖 Uses T5-based question generation models
- 📚 Generates multiple flashcards from educational content
- 🔌 REST API for easy integration
- 🎯 Optimized for educational content
- ⚡ Fast inference on Hugging Face infrastructure

## Usage

### Web Interface

1. Visit the Space URL
2. Paste your educational text
3. Choose number of flashcards
4. Click "Generate Flashcards"

### API Integration

```python
import requests

API_URL = "https://YOUR-USERNAME-flashcard-generator.hf.space/api/predict"

response = requests.post(API_URL, json={
    "data": ["Photosynthesis is the process by which plants convert sunlight into energy.", 3]
})

flashcards = response.json()["data"][1]["cards"]
```

### Response Format

```json
{
    "cards": [
        {
            "front": "What is photosynthesis?",
            "back": "The process by which plants convert sunlight into energy"
        }
    ],
    "count": 3,
    "source": "huggingface-space"
}
```

## Models Used

- **valhalla/t5-base-qg-hl** - Question generation
- **t5-small** - Fallback text generation

## Integration with Your App

This Space is designed to work with the Vedalaya education platform. See the backend integration guide for details.

## Local Development

```bash
pip install -r requirements.txt
python app.py
```

## License

MIT License - Free to use and modify
