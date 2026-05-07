import express from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateQuizFromText } from '../utils/simpleGenerators.js';
import { generateFlashcards, isMLModelAvailable } from '../utils/mlFlashcardGenerator.js';

const router = express.Router();

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
    let source = 'hf-space';

    // Try Hugging Face Space first (best quality, free, no limits)
    if (process.env.HF_FLASHCARD_SPACE_URL) {
      try {
        console.log('🤗 Using Hugging Face Space for flashcard generation');
        const response = await axios.post(
          `${process.env.HF_FLASHCARD_SPACE_URL}/api/predict`,
          {
            data: [data.text, maxCards]
          },
          { timeout: 30000 } // 30 second timeout
        );
        
        if (response.data?.data?.[1]?.cards) {
          cards = response.data.data[1].cards;
          source = 'hf-space';
        } else {
          throw new Error('Invalid response from HF Space');
        }
      } catch (hfError) {
        console.error('HF Space error:', hfError.message);
        
        // Fallback to ML model if available
        try {
          cards = await generateFlashcards(data.text, maxCards, true);
          source = isMLModelAvailable() ? 'ml' : 'rule-based';
        } catch (mlError) {
          console.error('ML generation also failed:', mlError.message);
          
          // Final fallback to Gemini API
          if (process.env.GEMINI_API_KEY) {
            try {
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
              const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
              
              const prompt = `You are a helpful educational assistant. Based on the provided text, generate up to ${maxCards} flashcards. 
Extract the most important concepts, facts, or definitions. 
Return the output STRICTLY in a valid JSON array format, where each object has "front" (the question or prompt) and "back" (the answer or explanation). Do NOT output any markdown blocks like \`\`\`json. Only output the raw JSON array.
Example: [{"front": "What is the capital of France?", "back": "Paris"}]

Text:
${data.text}
`;

              const result = await model.generateContent(prompt);
              const responseText = await result.response.text();
              
              const cleanedText = responseText.replace(/```json\n?|```/gi, '').trim();
              cards = JSON.parse(cleanedText);
              source = 'gemini';
            } catch (geminiError) {
              console.error('All methods failed, using rule-based fallback');
              cards = await generateFlashcards(data.text, maxCards, false);
              source = 'rule-based-fallback';
            }
          } else {
            cards = await generateFlashcards(data.text, maxCards, false);
            source = 'rule-based-fallback';
          }
        }
      }
    } else {
      // No HF Space URL, try ML model
      try {
        cards = await generateFlashcards(data.text, maxCards, true);
        source = isMLModelAvailable() ? 'ml' : 'rule-based';
      } catch (error) {
        console.error('ML generation failed:', error.message);
        cards = await generateFlashcards(data.text, maxCards, false);
        source = 'rule-based';
      }
    }

    // Ensure we have valid cards
    if (!Array.isArray(cards) || cards.length === 0) {
      cards = await generateFlashcards(data.text, maxCards, false);
      source = 'rule-based-emergency';
    }

    return res.json({ 
      cards, 
      source, 
      mlAvailable: isMLModelAvailable(),
      hfSpaceAvailable: !!process.env.HF_FLASHCARD_SPACE_URL
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

export default router;

