# ML Flashcard Generator - Training Pipeline

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Prepare training data
npm run prepare-data

# 3. Train the model
npm run train

# 4. Test the model
npm run test

# 5. Copy to backend
# Windows:
xcopy models\flashcard-generator ..\backend\ml-models\flashcard-generator\ /E /I

# Linux/Mac:
cp -r models/flashcard-generator ../backend/ml-models/
```

## What This Does

This training pipeline creates a TensorFlow.js model that can generate flashcards from educational text without using any external APIs.

## Scripts

### `npm run prepare-data`
- Loads training examples
- Extracts NLP features
- Builds vocabulary
- Encodes data to tensors
- Saves to `./data/`

### `npm run train`
- Builds neural network
- Trains on prepared data
- Saves model to `./models/`
- Takes 5-10 minutes

### `npm run test`
- Loads trained model
- Tests on sample texts
- Shows generated flashcards

## Adding Training Data

Edit `prepare-data.js` and add more examples:

```javascript
const trainingExamples = [
  {
    text: "Your educational content here...",
    flashcards: [
      { 
        front: "What is X?", 
        back: "X is Y" 
      },
      // Add more cards
    ]
  },
  // Add 100+ examples for best results
];
```

## Model Architecture

- **Input**: Text (50 words) + Features (6 values)
- **Embedding**: 128 dimensions
- **LSTM**: 2 layers, 256 units each
- **Output**: Question + Answer sequences
- **Parameters**: ~1.9M trainable parameters

## Requirements

- Node.js 16+
- 2GB RAM minimum
- 5-10 minutes training time
- 50MB disk space for model

## Output

After training, you'll have:
- `models/flashcard-generator/model.json` - Model architecture
- `models/flashcard-generator/weights.bin` - Trained weights
- `models/flashcard-generator/config.json` - Configuration
- `models/flashcard-generator/vocabulary.json` - Word mappings

Copy these to `backend/ml-models/` to use in production!
