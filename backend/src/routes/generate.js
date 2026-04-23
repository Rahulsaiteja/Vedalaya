import express from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateQuizFromText } from '../utils/simpleGenerators.js';

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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not configured.' } });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are a helpful educational assistant. Based on the provided text, generate up to ${maxCards} flashcards. 
Extract the most important concepts, facts, or definitions. 
Return the output STRICTLY in a valid JSON array format, where each object has "front" (the question or prompt) and "back" (the answer or explanation). Do NOT output any markdown blocks like \`\`\`json. Only output the raw JSON array.
Example: [{"front": "What is the capital of France?", "back": "Paris"}]

Text:
${data.text}
`;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    
    let cards = [];
    try {
      const cleanedText = responseText.replace(/```json\n?|```/gi, '').trim();
      cards = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse Gemini response:", responseText);
      return res.status(500).json({ error: { message: "Failed to generate valid flashcards from text." } });
    }

    return res.json({ cards });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

export default router;

