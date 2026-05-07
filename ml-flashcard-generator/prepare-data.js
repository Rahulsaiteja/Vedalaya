/**
 * Data Preparation Script
 * Creates training data for flashcard generation
 */

import fs from 'fs';
import path from 'path';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';
import { largeTrainingDataset } from './training-data-large.js';

// Use the large dataset
const trainingExamples = largeTrainingDataset;

// Extract features from text
function extractFeatures(text) {
  const doc = nlp(text);
  
  // Extract entities
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const organizations = doc.organizations().out('array');
  
  // Extract sentences
  const sentences = doc.sentences().out('array');
  
  // Extract nouns and verbs
  const nouns = doc.nouns().out('array');
  const verbs = doc.verbs().out('array');
  
  // Extract dates manually (compromise dates() not available in all versions)
  const dates = text.match(/\b\d{4}\b/g) || []; // Find years
  
  // Extract definitions (X is Y pattern)
  const definitions = [];
  sentences.forEach(sentence => {
    const match = sentence.match(/(.+?)\s+is\s+(.+)/i);
    if (match) {
      definitions.push({ subject: match[1].trim(), definition: match[2].trim() });
    }
  });
  
  // Keywords (remove stopwords)
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const keywords = removeStopwords(words);
  
  return {
    people,
    places,
    dates,
    organizations,
    sentences,
    nouns,
    verbs,
    definitions,
    keywords,
    wordCount: words.length,
    sentenceCount: sentences.length
  };
}

// Create vocabulary
function buildVocabulary(examples) {
  const vocab = new Set();
  
  examples.forEach(example => {
    const words = example.text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
    words.forEach(word => vocab.add(word));
    
    example.flashcards.forEach(card => {
      const frontWords = card.front.toLowerCase().split(/\W+/).filter(w => w.length > 0);
      const backWords = card.back.toLowerCase().split(/\W+/).filter(w => w.length > 0);
      frontWords.forEach(word => vocab.add(word));
      backWords.forEach(word => vocab.add(word));
    });
  });
  
  const vocabArray = Array.from(vocab).sort();
  const wordToIndex = {};
  const indexToWord = {};
  
  vocabArray.forEach((word, idx) => {
    wordToIndex[word] = idx;
    indexToWord[idx] = word;
  });
  
  return { wordToIndex, indexToWord, size: vocabArray.length };
}

// Encode text to vector
function encodeText(text, wordToIndex, maxLength = 50) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const encoded = new Array(maxLength).fill(0);
  
  words.slice(0, maxLength).forEach((word, idx) => {
    if (wordToIndex[word] !== undefined) {
      encoded[idx] = wordToIndex[word];
    }
  });
  
  return encoded;
}

// Prepare training data
function prepareTrainingData(examples, wordToIndex) {
  const data = [];
  
  examples.forEach(example => {
    const features = extractFeatures(example.text);
    const textEncoded = encodeText(example.text, wordToIndex);
    
    example.flashcards.forEach(card => {
      const frontEncoded = encodeText(card.front, wordToIndex, 20);
      const backEncoded = encodeText(card.back, wordToIndex, 30);
      
      data.push({
        input: {
          text: textEncoded,
          features: [
            features.wordCount,
            features.sentenceCount,
            features.definitions.length,
            features.people.length,
            features.places.length,
            features.dates.length
          ]
        },
        output: {
          front: frontEncoded,
          back: backEncoded
        },
        metadata: {
          originalText: example.text,
          front: card.front,
          back: card.back
        }
      });
    });
  });
  
  return data;
}

// Main execution
console.log('🚀 Preparing training data for flashcard generation...\n');

console.log('📚 Building vocabulary...');
const vocabulary = buildVocabulary(trainingExamples);
console.log(`✅ Vocabulary size: ${vocabulary.size} words\n`);

console.log('🔧 Extracting features and encoding data...');
const trainingData = prepareTrainingData(trainingExamples, vocabulary.wordToIndex);
console.log(`✅ Generated ${trainingData.length} training examples\n`);

// Save data
const outputDir = './data';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('💾 Saving data...');
fs.writeFileSync(
  path.join(outputDir, 'vocabulary.json'),
  JSON.stringify(vocabulary, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'training-data.json'),
  JSON.stringify(trainingData, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'raw-examples.json'),
  JSON.stringify(trainingExamples, null, 2)
);

console.log('✅ Data saved to ./data/\n');

console.log('📊 Summary:');
console.log(`   - Vocabulary size: ${vocabulary.size}`);
console.log(`   - Training examples: ${trainingData.length}`);
console.log(`   - Source texts: ${trainingExamples.length}`);
console.log('\n✨ Data preparation complete! Run "npm run train" to train the model.\n');
