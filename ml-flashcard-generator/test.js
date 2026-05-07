/**
 * Model Testing Script
 * Tests the trained flashcard generation model
 */

import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';

// Load model and data
console.log('📂 Loading model and vocabulary...\n');

const vocabulary = JSON.parse(fs.readFileSync('./data/vocabulary.json', 'utf8'));
const config = JSON.parse(fs.readFileSync('./models/flashcard-generator/config.json', 'utf8'));
const model = await tf.loadLayersModel('file://./models/flashcard-generator/model.json');

console.log('✅ Model loaded successfully\n');

// Helper functions
function extractFeatures(text) {
  const doc = nlp(text);
  
  const sentences = doc.sentences().out('array');
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const dates = doc.dates().out('array');
  
  const definitions = [];
  sentences.forEach(sentence => {
    const match = sentence.match(/(.+?)\s+is\s+(.+)/i);
    if (match) {
      definitions.push({ subject: match[1].trim(), definition: match[2].trim() });
    }
  });
  
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    definitions: definitions.length,
    people: people.length,
    places: places.length,
    dates: dates.length
  };
}

function encodeText(text, maxLength = 50) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const encoded = new Array(maxLength).fill(0);
  
  words.slice(0, maxLength).forEach((word, idx) => {
    if (vocabulary.wordToIndex[word] !== undefined) {
      encoded[idx] = vocabulary.wordToIndex[word];
    }
  });
  
  return encoded;
}

function decodeSequence(encoded, maxLength) {
  const words = [];
  for (let i = 0; i < maxLength; i++) {
    let maxProb = 0;
    let maxIdx = 0;
    
    for (let j = 0; j < vocabulary.size; j++) {
      const prob = encoded[i * vocabulary.size + j];
      if (prob > maxProb) {
        maxProb = prob;
        maxIdx = j;
      }
    }
    
    if (maxIdx > 0 && vocabulary.indexToWord[maxIdx]) {
      words.push(vocabulary.indexToWord[maxIdx]);
    }
  }
  
  return words.join(' ').trim();
}

// Generate flashcards
async function generateFlashcards(text, numCards = 3) {
  console.log(`📝 Input text: "${text}"\n`);
  
  const features = extractFeatures(text);
  const textEncoded = encodeText(text, config.textMaxLength);
  
  const featuresArray = [
    features.wordCount,
    features.sentenceCount,
    features.definitions,
    features.people,
    features.places,
    features.dates
  ];
  
  // Create tensors
  const textTensor = tf.tensor2d([textEncoded]);
  const featuresTensor = tf.tensor2d([featuresArray]);
  
  // Predict
  const predictions = model.predict([textTensor, featuresTensor]);
  const frontPred = await predictions[0].data();
  const backPred = await predictions[1].data();
  
  // Decode
  const front = decodeSequence(Array.from(frontPred), config.frontMaxLength);
  const back = decodeSequence(Array.from(backPred), config.backMaxLength);
  
  // Cleanup
  textTensor.dispose();
  featuresTensor.dispose();
  predictions[0].dispose();
  predictions[1].dispose();
  
  const card = {
    front: front || "What is the main concept?",
    back: back || text.split('.')[0]
  };
  
  console.log('🎴 Generated Flashcard:');
  console.log(`   Front: ${card.front}`);
  console.log(`   Back: ${card.back}\n`);
  
  return [card];
}

// Test cases
const testCases = [
  "The Earth revolves around the Sun. This takes approximately 365 days.",
  "JavaScript is a programming language used for web development. It runs in browsers.",
  "The Amazon rainforest is the largest tropical rainforest in the world.",
  "Albert Einstein developed the theory of relativity in 1905.",
  "Water boils at 100 degrees Celsius at sea level."
];

console.log('🧪 Testing model with sample texts...\n');
console.log('='.repeat(60));
console.log('\n');

for (const testText of testCases) {
  await generateFlashcards(testText);
  console.log('-'.repeat(60));
  console.log('\n');
}

console.log('✅ Testing complete!\n');
console.log('📊 Model Performance Notes:');
console.log('   - The model is trained on limited data (10 examples)');
console.log('   - For production, train on 1000+ examples');
console.log('   - Consider fine-tuning with domain-specific data');
console.log('   - Current model serves as a proof-of-concept\n');

process.exit(0);
