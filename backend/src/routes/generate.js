import express from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateQuizFromText } from '../utils/simpleGenerators.js';

const router = express.Router();

// Simple local flashcard generator as fallback
function generateFlashcardsLocally(text, maxCards = 12) {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200);
  
  const cards = [];
  const keywords = ['what', 'who', 'when', 'where', 'why', 'how', 'define', 'explain'];
  
  for (let i = 0; i < Math.min(sentences.length, maxCards); i++) {
    const sentence = sentences[i];
    const words = sentence.split(' ');
    
    if (words.length < 5) continue;
    
    // Extract key concept (usually a noun or important term)
    const importantWords = words.filter(w => 
      w.length > 4 && 
      /^[A-Z]/.test(w) && 
      !['The', 'This', 'That', 'These', 'Those'].includes(w)
    );
    
    if (importantWords.length > 0) {
      const concept = importantWords[0];
      cards.push({
        front: `What is ${concept}?`,
        back: sentence
      });
    } else {
      // Generic question
      const keyword = keywords[i % keywords.length];
      cards.push({
        front: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - ${words.slice(0, 5).join(' ')}...?`,
        back: sentence
      });
    }
    
    if (cards.length >= maxCards) break;
  }
  
  // If we couldn't generate enough cards, create some basic ones
  if (cards.length === 0) {
    const chunks = text.match(/.{1,150}/g) || [];
    for (let i = 0; i < Math.min(chunks.length, maxCards); i++) {
      cards.push({
        front: `Key Point ${i + 1}`,
        back: chunks[i].trim()
      });
    }
  }
  
  return cards;
}

const quizGenSchema = z.object({
  text: z.string().min(20),
  numQuestions: z.number().int().min(1).max(30).optional(),
});

router.post('/quiz', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const data = quizGenSchema.parse(req.body);
    const questions = generateQuizFromText({ text: data.text, numQuestions: data.numQuestions ?? 8 });
    return res.json({ questions });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const flashGenSchema = z.object({
  text: z.string().min(20),
  maxCards: z.number().int().min(1).max(50).optional(),
});

router.post('/flashcards', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const data = flashGenSchema.parse(req.body);
    const maxCards = data.maxCards ?? 12;

    let cards = [];
    let source = 'local';

    // Try Gemini first (with lighter, cheaper model)
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" }); // Cheaper model
        
        const prompt = `You are a helpful educational assistant. Based on the provided text, generate up to ${maxCards} flashcards. 
Extract the most important concepts, facts, or definitions. 
Return the output STRICTLY in a valid JSON array format, where each object has "front" (the question or prompt) and "back" (the answer or explanation). Do NOT output any markdown blocks like \`\`\`json. Only output the raw JSON array.
Example: [{"front": "What is the capital of France?", "back": "Paris"}]

Text:
${data.text}
`;

        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();
        
        try {
          const cleanedText = responseText.replace(/```json\n?|```/gi, '').trim();
          cards = JSON.parse(cleanedText);
          source = 'gemini';
        } catch (e) {
          console.error("Failed to parse Gemini response, using local fallback");
          cards = generateFlashcardsLocally(data.text, maxCards);
        }
      } catch (error) {
        const isQuotaError = 
          error?.status === 429 ||
          /quota|rate limit|too many requests/i.test(error?.message || '');
        
        if (isQuotaError) {
          console.log("Gemini quota exceeded, using local generation");
        } else {
          console.error("Gemini error:", error.message);
        }
        
        // Use local fallback
        cards = generateFlashcardsLocally(data.text, maxCards);
      }
    } else {
      // No API key, use local generation
      cards = generateFlashcardsLocally(data.text, maxCards);
    }

    // Ensure we have valid cards
    if (!Array.isArray(cards) || cards.length === 0) {
      cards = generateFlashcardsLocally(data.text, maxCards);
    }

    return res.json({ cards, source });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

export default router;

