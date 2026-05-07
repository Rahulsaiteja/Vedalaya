# 🤗 Hugging Face Flashcard Generator - Deployment Guide

## Overview

This guide shows you how to deploy the flashcard generator to Hugging Face Spaces (FREE hosting with GPU support!).

## Why Hugging Face Spaces?

- ✅ **FREE hosting** - No credit card required
- ✅ **GPU support** - Fast inference
- ✅ **Auto-scaling** - Handles traffic automatically
- ✅ **REST API** - Easy integration
- ✅ **No rate limits** - Unlimited usage
- ✅ **Better models** - Use transformer models (T5, BART, etc.)
- ✅ **Easy deployment** - Just push to Git

## Step-by-Step Deployment

### Step 1: Create Hugging Face Account

1. Go to https://huggingface.co/join
2. Sign up (free account)
3. Verify your email

### Step 2: Create a New Space

1. Go to https://huggingface.co/new-space
2. Fill in details:
   - **Owner**: Your username
   - **Space name**: `flashcard-generator`
   - **License**: MIT
   - **SDK**: Gradio
   - **Hardware**: CPU basic (free) or GPU (if available)
   - **Visibility**: Public

3. Click "Create Space"

### Step 3: Upload Files

You have two options:

#### Option A: Git Push (Recommended)

```bash
cd hf-flashcard-space

# Initialize git
git init
git add .
git commit -m "Initial commit"

# Add HF remote
git remote add hf https://huggingface.co/spaces/YOUR-USERNAME/flashcard-generator
git push hf main
```

#### Option B: Web Upload

1. Go to your Space page
2. Click "Files" tab
3. Click "Add file" → "Upload files"
4. Upload all files from `hf-flashcard-space/`:
   - `app.py`
   - `requirements.txt`
   - `README.md`
   - `.gitignore`

### Step 4: Wait for Build

1. Space will automatically build (takes 2-5 minutes)
2. Watch the "Logs" tab for progress
3. When done, you'll see "Running" status

### Step 5: Test Your Space

1. Go to your Space URL: `https://huggingface.co/spaces/YOUR-USERNAME/flashcard-generator`
2. Try the web interface:
   - Paste some educational text
   - Click "Generate Flashcards"
   - Verify it works!

### Step 6: Get API URL

Your API endpoint is:
```
https://YOUR-USERNAME-flashcard-generator.hf.space/api/predict
```

### Step 7: Update Backend

1. Open `backend/.env`
2. Add your HF Space URL:

```env
HF_FLASHCARD_SPACE_URL=https://YOUR-USERNAME-flashcard-generator.hf.space
```

3. Restart your backend:

```bash
cd backend
npm start
```

You should see:
```
🤗 Using Hugging Face Space for flashcard generation
```

### Step 8: Test Integration

```bash
curl -X POST http://localhost:5000/api/generate/flashcards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "The Earth revolves around the Sun.", "maxCards": 3}'
```

**Expected response:**
```json
{
  "cards": [
    {
      "front": "What revolves around the Sun?",
      "back": "The Earth revolves around the Sun"
    }
  ],
  "source": "hf-space",
  "hfSpaceAvailable": true
}
```

## 🎯 Architecture

```
User Request
    ↓
Backend API
    ↓
┌─────────────────────────────────┐
│ Try Hugging Face Space (Primary)│ ← T5 Transformer Model
└─────────────────────────────────┘
    ↓ (if fails)
┌─────────────────────────────────┐
│ Try Local ML Model (Fallback 1) │ ← TensorFlow.js
└─────────────────────────────────┘
    ↓ (if fails)
┌─────────────────────────────────┐
│ Try Rule-Based NLP (Fallback 2) │ ← compromise.js
└─────────────────────────────────┘
    ↓ (if fails)
┌─────────────────────────────────┐
│ Try Gemini API (Fallback 3)     │ ← Google Gemini
└─────────────────────────────────┘
    ↓
Return Flashcards
```

## 📊 Quality Comparison

| Method | Quality | Speed | Cost | Deployment |
|--------|---------|-------|------|------------|
| **HF Space (T5)** | 9/10 | Fast | Free | Easy |
| TensorFlow.js | 7/10 | Fast | Free | Complex |
| Rule-Based NLP | 6/10 | Very Fast | Free | Easy |
| Gemini API | 9/10 | Medium | $$ | Easy |

## 🔧 Customization

### Use Different Models

Edit `hf-flashcard-space/app.py`:

```python
# Option 1: Better question generation
qg_tokenizer = AutoTokenizer.from_pretrained("valhalla/t5-large-qg-hl")
qg_model = AutoModelForSeq2SeqLM.from_pretrained("valhalla/t5-large-qg-hl")

# Option 2: Use BART
from transformers import BartForConditionalGeneration, BartTokenizer
model = BartForConditionalGeneration.from_pretrained("facebook/bart-large")
tokenizer = BartTokenizer.from_pretrained("facebook/bart-large")

# Option 3: Use Flan-T5
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")
```

### Enable GPU

1. Go to your Space settings
2. Click "Settings" tab
3. Under "Hardware", select "T4 small" (free GPU)
4. Click "Save"
5. Space will rebuild with GPU support

### Add More Features

```python
# Add summarization
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

# Add keyword extraction
from keybert import KeyBERT
kw_model = KeyBERT()

# Add answer generation
qa_pipeline = pipeline("question-answering")
```

## 🚀 Production Deployment

### Backend Deployment

1. Deploy backend to Render/Railway/Heroku
2. Set environment variable:

```env
HF_FLASHCARD_SPACE_URL=https://YOUR-USERNAME-flashcard-generator.hf.space
```

3. Backend will automatically use HF Space

### Frontend Deployment

No changes needed! Frontend calls backend API, which calls HF Space.

## 📈 Monitoring

### Check Space Status

1. Go to your Space page
2. Click "Logs" tab
3. Monitor requests and errors

### Check Usage

1. Go to Space settings
2. View "Analytics" tab
3. See request count, response times

### Check Costs

- **CPU Basic**: FREE forever
- **GPU T4**: FREE for limited hours/month
- **Persistent storage**: FREE up to 50GB

## 🐛 Troubleshooting

### Space Not Building

**Check logs:**
1. Go to Space page
2. Click "Logs" tab
3. Look for errors

**Common issues:**
- Missing dependencies in `requirements.txt`
- Syntax errors in `app.py`
- Model download failures

**Solutions:**
```bash
# Test locally first
cd hf-flashcard-space
pip install -r requirements.txt
python app.py
```

### API Not Responding

**Check:**
1. Space status (should be "Running")
2. API URL is correct
3. Request format matches docs

**Test directly:**
```bash
curl -X POST https://YOUR-USERNAME-flashcard-generator.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{"data": ["Test text", 3]}'
```

### Low Quality Results

**Solutions:**
1. Use larger model (t5-large instead of t5-small)
2. Enable GPU for faster inference
3. Add more preprocessing
4. Fine-tune model on educational data

### Slow Response Times

**Solutions:**
1. Enable GPU (Settings → Hardware → T4 small)
2. Use smaller model
3. Add caching
4. Reduce max_length in generation

## 🎓 Advanced: Fine-Tuning

### Prepare Training Data

```python
# Create dataset
training_data = [
    {
        "text": "Photosynthesis is...",
        "question": "What is photosynthesis?",
        "answer": "The process by which..."
    },
    # Add 1000+ examples
]

# Save as JSON
import json
with open('training_data.json', 'w') as f:
    json.dump(training_data, f)
```

### Fine-Tune Model

```python
from transformers import Trainer, TrainingArguments

# Load base model
model = AutoModelForSeq2SeqLM.from_pretrained("t5-small")

# Training arguments
training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=3,
    per_device_train_batch_size=8,
    save_steps=1000,
)

# Train
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
)

trainer.train()

# Save fine-tuned model
model.save_pretrained("./fine-tuned-flashcard-model")
```

### Deploy Fine-Tuned Model

```python
# In app.py, use your fine-tuned model
model = AutoModelForSeq2SeqLM.from_pretrained("YOUR-USERNAME/fine-tuned-flashcard-model")
```

## 📚 Resources

- [Hugging Face Spaces Docs](https://huggingface.co/docs/hub/spaces)
- [Gradio Documentation](https://gradio.app/docs/)
- [T5 Model Card](https://huggingface.co/t5-base)
- [Question Generation Models](https://huggingface.co/models?pipeline_tag=text2text-generation&search=question)

## ✅ Deployment Checklist

- [ ] Created HF account
- [ ] Created new Space
- [ ] Uploaded all files
- [ ] Space is running
- [ ] Tested web interface
- [ ] Got API URL
- [ ] Updated backend .env
- [ ] Tested backend integration
- [ ] Verified flashcards quality
- [ ] Checked response times
- [ ] Monitored logs
- [ ] Documented API endpoint

## 🎉 Success!

Once deployed, you have:

✅ FREE flashcard generation
✅ No rate limits
✅ High quality (T5 transformer)
✅ Fast inference (GPU optional)
✅ Easy integration
✅ Auto-scaling
✅ Production-ready

**Your flashcard generator is now live on Hugging Face!** 🚀

## 📞 Support

- **HF Community**: https://discuss.huggingface.co/
- **Gradio Discord**: https://discord.gg/gradio
- **Documentation**: See other guides in this repo

## Next Steps

1. ✅ Deploy to Hugging Face
2. ✅ Test thoroughly
3. ⏭️ Consider fine-tuning on educational data
4. ⏭️ Add more features (summarization, keywords)
5. ⏭️ Monitor usage and optimize

**You're deployment-ready!** 🎓
