/**
 * Data Preparation Script
 * Creates training data for flashcard generation
 */

import fs from 'fs';
import path from 'path';
import nlp from 'compromise';
import { removeStopwords } from 'stopword';

// Sample educational content for training
const trainingExamples = [
  {
    text: "Photosynthesis is the process by which plants convert sunlight into energy. Plants use chlorophyll to capture light energy.",
    flashcards: [
      { front: "What is photosynthesis?", back: "The process by which plants convert sunlight into energy" },
      { front: "What do plants use to capture light energy?", back: "Chlorophyll" }
    ]
  },
  {
    text: "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration.",
    flashcards: [
      { front: "What is the mitochondria?", back: "The powerhouse of the cell" },
      { front: "What does mitochondria produce?", back: "ATP through cellular respiration" }
    ]
  },
  {
    text: "Python is a high-level programming language. It was created by Guido van Rossum in 1991.",
    flashcards: [
      { front: "What is Python?", back: "A high-level programming language" },
      { front: "Who created Python?", back: "Guido van Rossum" },
      { front: "When was Python created?", back: "1991" }
    ]
  },
  {
    text: "The water cycle consists of evaporation, condensation, and precipitation. Water evaporates from oceans and lakes.",
    flashcards: [
      { front: "What are the three stages of the water cycle?", back: "Evaporation, condensation, and precipitation" },
      { front: "Where does water evaporate from?", back: "Oceans and lakes" }
    ]
  },
  {
    text: "DNA stands for Deoxyribonucleic Acid. It contains genetic information and is shaped like a double helix.",
    flashcards: [
      { front: "What does DNA stand for?", back: "Deoxyribonucleic Acid" },
      { front: "What shape is DNA?", back: "Double helix" },
      { front: "What does DNA contain?", back: "Genetic information" }
    ]
  },
  {
    text: "The French Revolution began in 1789. It led to the rise of Napoleon Bonaparte and changed European politics.",
    flashcards: [
      { front: "When did the French Revolution begin?", back: "1789" },
      { front: "Who rose to power after the French Revolution?", back: "Napoleon Bonaparte" }
    ]
  },
  {
    text: "Gravity is a force that attracts objects toward each other. Isaac Newton discovered the law of universal gravitation.",
    flashcards: [
      { front: "What is gravity?", back: "A force that attracts objects toward each other" },
      { front: "Who discovered the law of universal gravitation?", back: "Isaac Newton" }
    ]
  },
  {
    text: "The capital of France is Paris. Paris is known for the Eiffel Tower and the Louvre Museum.",
    flashcards: [
      { front: "What is the capital of France?", back: "Paris" },
      { front: "What is Paris known for?", back: "The Eiffel Tower and the Louvre Museum" }
    ]
  },
  {
    text: "Photosynthesis occurs in chloroplasts. The equation is 6CO2 + 6H2O + light energy → C6H12O6 + 6O2.",
    flashcards: [
      { front: "Where does photosynthesis occur?", back: "In chloroplasts" },
      { front: "What is the photosynthesis equation?", back: "6CO2 + 6H2O + light energy → C6H12O6 + 6O2" }
    ]
  },
  {
    text: "Shakespeare wrote Romeo and Juliet in 1597. It is a tragedy about two young lovers from feuding families.",
    flashcards: [
      { front: "Who wrote Romeo and Juliet?", back: "Shakespeare" },
      { front: "When was Romeo and Juliet written?", back: "1597" },
      { front: "What type of play is Romeo and Juliet?", back: "A tragedy about two young lovers from feuding families" }
    ]
  }
];

// Extract features from text
function extractFeatures(text) {
  const doc = nlp(text);
  
  // Extract entities
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const dates = doc.dates().out('array');
  const organizations = doc.organizations().out('array');
  
  // Extract sentences
  const sentences = doc.sentences().out('array');
  
  // Extract nouns and verbs
  const nouns = doc.nouns().out('array');
  const verbs = doc.verbs().out('array');
  
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
