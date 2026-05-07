/**
 * TensorFlow Model Training Script
 * Trains a neural network to generate flashcards from text
 */

import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';

// Load training data
console.log('📂 Loading training data...\n');
const vocabulary = JSON.parse(fs.readFileSync('./data/vocabulary.json', 'utf8'));
const trainingData = JSON.parse(fs.readFileSync('./data/training-data.json', 'utf8'));

console.log(`✅ Loaded ${trainingData.length} training examples`);
console.log(`✅ Vocabulary size: ${vocabulary.size}\n`);

// Hyperparameters - Optimized for better accuracy
const CONFIG = {
  textMaxLength: 50,
  frontMaxLength: 20,
  backMaxLength: 30,
  embeddingDim: 128,     // Increased for better word representations
  lstmUnits: 256,        // Increased for more capacity
  denseUnits: 128,       // Increased
  batchSize: 8,          // Increased for more stable training
  epochs: 100,           // More epochs for better learning
  learningRate: 0.0005,  // Lower learning rate for stability
  validationSplit: 0.15  // Less validation, more training
};

console.log('⚙️  Model Configuration:');
console.log(JSON.stringify(CONFIG, null, 2));
console.log('');

// Create the model
function createModel() {
  console.log('🏗️  Building neural network architecture...\n');
  
  // Input layers
  const textInput = tf.input({ shape: [CONFIG.textMaxLength], name: 'text_input' });
  const featuresInput = tf.input({ shape: [6], name: 'features_input' });
  
  // Text processing branch
  const embedding = tf.layers.embedding({
    inputDim: vocabulary.size + 1,
    outputDim: CONFIG.embeddingDim,
    maskZero: true,
    name: 'embedding'
  }).apply(textInput);
  
  const lstm1 = tf.layers.lstm({
    units: CONFIG.lstmUnits,
    returnSequences: true,
    name: 'lstm_1'
  }).apply(embedding);
  
  const lstm2 = tf.layers.lstm({
    units: CONFIG.lstmUnits,
    name: 'lstm_2'
  }).apply(lstm1);
  
  // Features processing branch
  const featuresDense = tf.layers.dense({
    units: 32,
    activation: 'relu',
    name: 'features_dense'
  }).apply(featuresInput);
  
  // Concatenate branches
  const concatenated = tf.layers.concatenate({
    name: 'concatenate'
  }).apply([lstm2, featuresDense]);
  
  // Shared dense layers
  const dense1 = tf.layers.dense({
    units: CONFIG.denseUnits,
    activation: 'relu',
    name: 'dense_1'
  }).apply(concatenated);
  
  const dropout = tf.layers.dropout({
    rate: 0.3,
    name: 'dropout'
  }).apply(dense1);
  
  // Output branches for front and back
  const frontOutput = tf.layers.dense({
    units: CONFIG.frontMaxLength * vocabulary.size,
    activation: 'softmax',
    name: 'front_output'
  }).apply(dropout);
  
  const backOutput = tf.layers.dense({
    units: CONFIG.backMaxLength * vocabulary.size,
    activation: 'softmax',
    name: 'back_output'
  }).apply(dropout);
  
  // Create model
  const model = tf.model({
    inputs: [textInput, featuresInput],
    outputs: [frontOutput, backOutput],
    name: 'flashcard_generator'
  });
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(CONFIG.learningRate),
    loss: {
      front_output: 'categoricalCrossentropy',
      back_output: 'categoricalCrossentropy'
    },
    metrics: ['accuracy']
  });
  
  console.log('✅ Model architecture created\n');
  model.summary();
  console.log('');
  
  return model;
}

// Prepare tensors
function prepareDataTensors(data) {
  console.log('🔄 Converting data to tensors...\n');
  
  const textInputs = [];
  const featuresInputs = [];
  const frontOutputs = [];
  const backOutputs = [];
  
  data.forEach(example => {
    textInputs.push(example.input.text);
    featuresInputs.push(example.input.features);
    
    // One-hot encode outputs
    const frontOneHot = new Array(CONFIG.frontMaxLength * vocabulary.size).fill(0);
    const backOneHot = new Array(CONFIG.backMaxLength * vocabulary.size).fill(0);
    
    example.output.front.forEach((wordIdx, pos) => {
      if (wordIdx > 0 && pos < CONFIG.frontMaxLength) {
        frontOneHot[pos * vocabulary.size + wordIdx] = 1;
      }
    });
    
    example.output.back.forEach((wordIdx, pos) => {
      if (wordIdx > 0 && pos < CONFIG.backMaxLength) {
        backOneHot[pos * vocabulary.size + wordIdx] = 1;
      }
    });
    
    frontOutputs.push(frontOneHot);
    backOutputs.push(backOneHot);
  });
  
  const textTensor = tf.tensor2d(textInputs);
  const featuresTensor = tf.tensor2d(featuresInputs);
  const frontTensor = tf.tensor2d(frontOutputs);
  const backTensor = tf.tensor2d(backOutputs);
  
  console.log('✅ Tensors created');
  console.log(`   Text input shape: ${textTensor.shape}`);
  console.log(`   Features input shape: ${featuresTensor.shape}`);
  console.log(`   Front output shape: ${frontTensor.shape}`);
  console.log(`   Back output shape: ${backTensor.shape}\n`);
  
  return {
    inputs: [textTensor, featuresTensor],
    outputs: [frontTensor, backTensor]
  };
}

// Training
async function trainModel() {
  console.log('🎯 Starting training...\n');
  
  const model = createModel();
  const tensors = prepareDataTensors(trainingData);
  
  // Callbacks
  const callbacks = {
    onEpochEnd: (epoch, logs) => {
      const loss = logs?.loss?.toFixed ? logs.loss.toFixed(4) : 'N/A';
      const frontAcc = logs?.front_output_accuracy?.toFixed ? logs.front_output_accuracy.toFixed(4) : 'N/A';
      const backAcc = logs?.back_output_accuracy?.toFixed ? logs.back_output_accuracy.toFixed(4) : 'N/A';
      
      console.log(
        `Epoch ${epoch + 1}/${CONFIG.epochs} - ` +
        `loss: ${loss} - ` +
        `front_output_accuracy: ${frontAcc} - ` +
        `back_output_accuracy: ${backAcc}`
      );
    },
    onTrainEnd: () => {
      console.log('\n✅ Training complete!\n');
    }
  };
  
  // Train
  await model.fit(tensors.inputs, tensors.outputs, {
    batchSize: CONFIG.batchSize,
    epochs: CONFIG.epochs,
    validationSplit: CONFIG.validationSplit,
    callbacks,
    shuffle: true
  });
  
  // Save model using downloads handler (works in browser-based TF.js)
  console.log('💾 Saving model...\n');
  const modelDir = path.resolve('./models/flashcard-generator');
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  // Save model artifacts manually
  const modelJSON = await model.toJSON();
  const weights = await model.getWeights();
  
  // Save model.json
  fs.writeFileSync(
    path.join(modelDir, 'model.json'),
    JSON.stringify(modelJSON, null, 2)
  );
  
  // Save weights as binary
  const weightsData = [];
  for (const weight of weights) {
    const data = await weight.data();
    weightsData.push(Array.from(data));
  }
  
  fs.writeFileSync(
    path.join(modelDir, 'weights.json'),
    JSON.stringify(weightsData, null, 2)
  );
  
  // Save config
  fs.writeFileSync(
    path.join(modelDir, 'config.json'),
    JSON.stringify(CONFIG, null, 2)
  );
  
  console.log('✅ Model saved to ./models/flashcard-generator/\n');
  
  // Cleanup
  tensors.inputs.forEach(t => t.dispose());
  tensors.outputs.forEach(t => t.dispose());
  
  return model;
}

// Run training
trainModel()
  .then(() => {
    console.log('🎉 Training pipeline completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Test the model: npm run test');
    console.log('  2. Integrate into backend: Copy models/ folder to backend/');
    console.log('  3. Use in production!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Training failed:', error);
    process.exit(1);
  });
