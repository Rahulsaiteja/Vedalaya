# TensorFlow Flashcard System - Deployment Checklist

## 📋 Pre-Deployment Steps

### 1. Train the ML Model

```bash
cd ml-flashcard-generator
npm install
npm run prepare-data
npm run train
npm run test
```

**Expected time:** 10-15 minutes

**Verify:**
- [ ] `models/flashcard-generator/model.json` exists
- [ ] `models/flashcard-generator/weights.bin` exists
- [ ] `models/flashcard-generator/config.json` exists
- [ ] `models/flashcard-generator/vocabulary.json` exists
- [ ] Test script shows generated flashcards

### 2. Copy Model to Backend

**Windows:**
```bash
xcopy models\flashcard-generator ..\backend\ml-models\flashcard-generator\ /E /I
```

**Linux/Mac:**
```bash
cp -r models/flashcard-generator ../backend/ml-models/
```

**Verify:**
- [ ] `backend/ml-models/flashcard-generator/model.json` exists
- [ ] `backend/ml-models/flashcard-generator/weights.bin` exists
- [ ] All 4 files copied successfully

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

**Verify:**
- [ ] `@tensorflow/tfjs-node` installed
- [ ] `compromise` installed
- [ ] `natural` installed
- [ ] `stopword` installed
- [ ] No installation errors

### 4. Test Locally

```bash
npm start
```

**Verify:**
- [ ] Server starts without errors
- [ ] See: "📂 Loading ML flashcard model..."
- [ ] See: "✅ ML flashcard model loaded successfully"
- [ ] Server running on port 5000

### 5. Test API Endpoint

```bash
# In another terminal
curl -X POST http://localhost:5000/api/generate/flashcards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "The Earth revolves around the Sun.", "maxCards": 3}'
```

**Verify:**
- [ ] Returns flashcards
- [ ] `source: "ml"` in response
- [ ] `mlAvailable: true` in response
- [ ] Cards have `front` and `back` fields

## 🚀 Deployment Options

### Option A: Deploy WITH ML Model (Recommended)

**Pros:**
- ✅ No API costs
- ✅ Best performance
- ✅ Works offline

**Cons:**
- ❌ Larger deployment (~100MB)
- ❌ More RAM needed (~512MB)

**Steps:**
1. [ ] Ensure `backend/ml-models/` folder exists
2. [ ] Include in deployment
3. [ ] Set RAM to 512MB minimum
4. [ ] Deploy to Render/Railway/etc.

**Platforms:**
- Render: ✅ Works (512MB plan)
- Railway: ✅ Works (512MB plan)
- Heroku: ✅ Works (Standard plan)
- DigitalOcean: ✅ Works (any droplet)
- AWS/GCP: ✅ Works (any instance)

### Option B: Deploy WITHOUT ML Model

**Pros:**
- ✅ Smaller deployment (~50MB)
- ✅ Less RAM needed (~256MB)
- ✅ Faster deployment

**Cons:**
- ❌ Uses rule-based fallback
- ❌ Slightly lower quality

**Steps:**
1. [ ] Remove `backend/ml-models/` folder
2. [ ] Deploy normally
3. [ ] System will use rule-based NLP
4. [ ] Still works, just different quality

## 📦 Deployment Files

### Must Include:
- [ ] `backend/src/` - All source code
- [ ] `backend/package.json` - Dependencies
- [ ] `backend/.env` - Environment variables
- [ ] `backend/node_modules/` - Or install on server

### Optional (for ML):
- [ ] `backend/ml-models/flashcard-generator/` - Trained model

### Exclude:
- [ ] `ml-flashcard-generator/` - Training code (not needed in production)
- [ ] `ml-flashcard-generator/node_modules/`
- [ ] `ml-flashcard-generator/data/`
- [ ] `*.log` files
- [ ] `.DS_Store` files

## 🔧 Environment Variables

### Required:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLIENT_ORIGIN=your_frontend_url
```

### Optional (for API fallback):
```env
GEMINI_API_KEY=your_gemini_key  # Only if you want API fallback
```

## 🧪 Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-api.com/api/health
```
**Expected:** `{"ok": true}`

### 2. ML Model Status
Check server logs for:
```
✅ ML flashcard model loaded successfully
```
OR
```
⚠️  ML model not found. Using rule-based fallback.
```

### 3. Generate Flashcards
```bash
curl -X POST https://your-api.com/api/generate/flashcards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test content", "maxCards": 3}'
```

**Verify:**
- [ ] Returns 200 OK
- [ ] Returns flashcards array
- [ ] Check `source` field (ml/rule-based/gemini)
- [ ] Check `mlAvailable` field

### 4. Performance Test
```bash
# Test response time
time curl -X POST https://your-api.com/api/generate/flashcards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test", "maxCards": 5}'
```

**Expected:**
- ML model: 200-500ms
- Rule-based: 50-100ms
- API fallback: 1-3 seconds

## 📊 Monitoring

### Check These Metrics:

1. **Memory Usage**
   - With ML: ~250-300MB
   - Without ML: ~100-150MB

2. **Response Time**
   - ML: 200-500ms
   - Rule-based: 50-100ms

3. **Error Rate**
   - Should be < 1%
   - Check for model loading errors

4. **Source Distribution**
   - Ideally: 90%+ from ML
   - Acceptable: 50%+ from ML
   - If mostly rule-based: Model not loading

## 🐛 Troubleshooting

### Model Not Loading

**Symptom:** Logs show "ML model not found"

**Solutions:**
- [ ] Verify `ml-models/` folder exists
- [ ] Check file permissions
- [ ] Ensure all 4 files present
- [ ] Check deployment includes ml-models/

### Out of Memory

**Symptom:** Server crashes or restarts

**Solutions:**
- [ ] Increase RAM to 512MB
- [ ] Use smaller model
- [ ] Deploy without ML model
- [ ] Enable swap space

### Slow Performance

**Symptom:** Requests take > 1 second

**Solutions:**
- [ ] Check server CPU usage
- [ ] Consider GPU instance
- [ ] Use caching
- [ ] Batch requests

### Low Quality Cards

**Symptom:** Generated cards are poor

**Solutions:**
- [ ] Add more training data
- [ ] Train for more epochs
- [ ] Use API fallback
- [ ] Fine-tune model

## ✅ Final Checklist

### Before Deployment:
- [ ] Model trained successfully
- [ ] Model copied to backend
- [ ] Dependencies installed
- [ ] Tested locally
- [ ] API endpoint works
- [ ] Environment variables set
- [ ] .gitignore updated

### During Deployment:
- [ ] Choose deployment option (with/without ML)
- [ ] Set RAM appropriately
- [ ] Include/exclude ml-models/ folder
- [ ] Deploy to platform
- [ ] Check deployment logs

### After Deployment:
- [ ] Health check passes
- [ ] ML model loaded (if included)
- [ ] API endpoint works
- [ ] Response times acceptable
- [ ] Memory usage normal
- [ ] No errors in logs

## 🎯 Success Criteria

Your deployment is successful if:

✅ Server starts without errors
✅ ML model loads (if included)
✅ API returns flashcards
✅ Response time < 1 second
✅ Memory usage stable
✅ No crashes or restarts
✅ Quality meets expectations

## 📚 Documentation Reference

- **TENSORFLOW_IMPLEMENTATION_SUMMARY.md** - Overview
- **ML_FLASHCARD_GUIDE.md** - Detailed guide
- **API_OPTIMIZATION_GUIDE.md** - API optimization
- **ml-flashcard-generator/README.md** - Training guide

## 🆘 Need Help?

1. Check server logs
2. Verify model files exist
3. Test with simple text
4. Check RAM usage
5. Review documentation
6. Test fallback systems

## 🎉 You're Ready!

Once all checkboxes are complete, your TensorFlow-based flashcard generation system is ready for production!

**No API costs. No rate limits. Complete control.** 🚀
