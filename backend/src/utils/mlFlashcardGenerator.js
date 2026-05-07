/**
 * ML-based Flashcard Generator
 * Uses TensorFlow.js model to generate flashcards from text
 */

import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';

let model = null;
let vocabulary = null;
let config = null;
let isModelLoaded = false;

// Load model on startup
export async function loadFlashcardModel() {
  try {
    const modelPath = path.resolve(process.cwd(), 'ml-models', 'flashcard-generator');
    const vocabPath = path.join(modelPath, 'vocabulary.json');
    const configPath = path.join(modelPath, 'config.json');
    const modelJsonPath = path.join(modelPath, 'model.json');
    
    // Check if model exists
    if (!fs.existsSync(modelJsonPath)) {
      console.log('⚠️  ML model not found. Using rule-based fallback.');
      return false;
    }
    
    console.log('📂 Loading ML flashcard model...');
    
    vocabulary = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    model = await tf.loadLayersModel(`file://${modelJsonPath}`);
    
    isModelLoaded = true;
    console.log('✅ ML flashcard model loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load ML model:', error.message);
    console.log('   Using rule-based fallback instead');
    return false;
  }
}

// Extract features from text
function extractFeatures(text) {
  const doc = nlp(text);
  
  const sentences = doc.sentences().out('array');
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  // compromise requires a plugin for .dates() — extract year patterns manually instead
  const dateMatches = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [];
  const dates = [...new Set(dateMatches)];
  
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

// Encode text to vector
function encodeText(text, maxLength = 50) {
  if (!vocabulary) return new Array(maxLength).fill(0);
  
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const encoded = new Array(maxLength).fill(0);
  
  words.slice(0, maxLength).forEach((word, idx) => {
    if (vocabulary.wordToIndex[word] !== undefined) {
      encoded[idx] = vocabulary.wordToIndex[word];
    }
  });
  
  return encoded;
}

// Decode sequence from model output
function decodeSequence(encoded, maxLength) {
  if (!vocabulary) return '';
  
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

// Generate flashcards using ML model
export async function generateFlashcardsML(text, maxCards = 10) {
  if (!isModelLoaded || !model) {
    throw new Error('ML model not loaded');
  }
  
  const cards = [];
  const features = extractFeatures(text);
  
  // Split text into chunks if too long
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const chunks = [];
  
  for (let i = 0; i < Math.min(sentences.length, maxCards); i++) {
    chunks.push(sentences[i].trim());
  }
  
  // Generate cards for each chunk
  for (const chunk of chunks) {
    try {
      const textEncoded = encodeText(chunk, config.textMaxLength);
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
      
      // Add card if valid
      if (front && back) {
        cards.push({
          front: front.charAt(0).toUpperCase() + front.slice(1) + '?',
          back: back.charAt(0).toUpperCase() + back.slice(1)
        });
      } else {
        // Fallback to simple card
        cards.push({
          front: `What is the main point of: "${chunk.slice(0, 30)}..."?`,
          back: chunk
        });
      }
      
      if (cards.length >= maxCards) break;
    } catch (error) {
      console.error('Error generating card:', error.message);
    }
  }
  
  return cards;
}

// Rule-based fallback (improved version)
export function generateFlashcardsRuleBased(text, maxCards = 10) {
  const doc = nlp(text);
  const cards = [];
  
  // Extract definitions (X is Y pattern)
  const sentences = doc.sentences().out('array');
  sentences.forEach(sentence => {
    const match = sentence.match(/(.+?)\s+is\s+(.+)/i);
    if (match && cards.length < maxCards) {
      const subject = match[1].trim();
      const definition = match[2].trim();
      cards.push({
        front: `What is ${subject}?`,
        back: definition.charAt(0).toUpperCase() + definition.slice(1)
      });
    }
  });
  
  // Extract people
  const people = doc.people().out('array');
  people.forEach(person => {
    if (cards.length < maxCards) {
      const context = doc.match(person).sentences().out('text');
      cards.push({
        front: `Who is ${person}?`,
        back: context || `A person mentioned in the text`
      });
    }
  });
  
  // Extract dates and events (year patterns)
  const dateMatches = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [];
  const dates = [...new Set(dateMatches)];
  dates.forEach(date => {
    if (cards.length < maxCards) {
      const context = doc.match(date).sentences().out('text');
      cards.push({
        front: `What happened in ${date}?`,
        back: context || `An event mentioned in the text`
      });
    }
  });
  
  // Extract key concepts (nouns)
  const nouns = doc.nouns().out('array').filter(n => n.length > 4);
  const uniqueNouns = [...new Set(nouns)].slice(0, maxCards - cards.length);
  
  uniqueNouns.forEach(noun => {
    if (cards.length < maxCards) {
      const context = doc.match(noun).sentences().out('text');
      if (context) {
        cards.push({
          front: `Explain: ${noun}`,
          back: context
        });
      }
    }
  });
  
  // If still not enough cards, create from sentences
  if (cards.length < maxCards) {
    const remainingSentences = sentences.slice(0, maxCards - cards.length);
    remainingSentences.forEach((sentence, idx) => {
      if (sentence.length > 20 && sentence.length < 200) {
        cards.push({
          front: `Key Point ${cards.length + 1}`,
          back: sentence
        });
      }
    });
  }
  
  return cards.slice(0, maxCards);
}

// Main generation function with fallback
export async function generateFlashcards(text, maxCards = 10, preferML = true) {
  try {
    if (preferML && isModelLoaded) {
      console.log('🤖 Using ML model for flashcard generation');
      return await generateFlashcardsML(text, maxCards);
    }
  } catch (error) {
    console.error('ML generation failed, using rule-based fallback:', error.message);
  }
  
  console.log('📝 Using rule-based flashcard generation');
  return generateFlashcardsRuleBased(text, maxCards);
}

// Check if model is available
export function isMLModelAvailable() {
  return isModelLoaded;
}
