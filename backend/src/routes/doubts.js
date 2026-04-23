import express from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { Quiz } from '../models/Quiz.js';
import { Lecture } from '../models/Lecture.js';
import { FlashcardSet } from '../models/FlashcardSet.js';
import { DoubtMessage } from '../models/DoubtMessage.js';
import { env } from '../utils/env.js';

const router = express.Router();

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreQueryAgainstText(query, text) {
  const q = normalizeText(query).split(' ').filter((w) => w.length > 2);
  const t = normalizeText(text);
  let score = 0;
  for (const token of q) {
    if (t.includes(token)) score += token.length;
  }
  return score;
}

async function buildKnowledgeBase(studentId) {
  const [quizzes, lectures, flashSets] = await Promise.all([
    Quiz.find({ status: 'published' }).select('title description questions').lean(),
    Lecture.find({ status: 'published' }).select('title description mediaType sourceType').lean(),
    FlashcardSet.find({ createdBy: studentId }).select('title topic cards').lean(),
  ]);

  const chunks = [];

  for (const qz of quizzes) {
    chunks.push({
      source: `Quiz: ${qz.title}`,
      text: `${qz.title}. ${qz.description || ''}`,
    });
    for (const q of qz.questions || []) {
      chunks.push({
        source: `Quiz Question: ${qz.title}`,
        text: `${q.prompt} Options: ${(q.options || []).join(', ')}`,
      });
    }
  }

  for (const lec of lectures) {
    chunks.push({
      source: `Lecture: ${lec.title}`,
      text: `${lec.title}. ${lec.description || ''}. Type: ${lec.mediaType || 'document'}.`,
    });
  }

  for (const fs of flashSets) {
    chunks.push({
      source: `Flashcards: ${fs.title}`,
      text: `${fs.title}. ${fs.topic || ''}`,
    });
    for (const c of fs.cards || []) {
      chunks.push({
        source: `Flashcard: ${fs.title}`,
        text: `Q: ${c.front}. A: ${c.back}`,
      });
    }
  }

  return chunks;
}

async function askOllama({ question, context }) {
  const prompt = [
    'You are Vedalaya doubt assistant.',
    'Answer clearly in short steps for students.',
    'If context is insufficient, explicitly say what is missing.',
    '',
    'Context:',
    context,
    '',
    `Student question: ${question}`,
    '',
    'Answer:',
  ].join('\n');

  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed (${response.status})`);
  }

  const data = await response.json();
  return data?.response?.trim() || 'I could not generate an answer right now.';
}

router.get('/history', requireAuth, requireRole('student'), async (req, res) => {
  const messages = await DoubtMessage.find({ studentId: req.user.sub }).sort({ createdAt: -1 }).limit(30).lean();
  res.json({ messages });
});

const askSchema = z.object({
  question: z.string().min(5).max(2000),
});

router.post('/ask', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const data = askSchema.parse(req.body);
    const knowledge = await buildKnowledgeBase(req.user.sub);

    const ranked = knowledge
      .map((k) => ({ ...k, score: scoreQueryAgainstText(data.question, k.text) }))
      .filter((k) => k.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const contextText = ranked.map((r, i) => `[${i + 1}] ${r.source}\n${r.text}`).join('\n\n');

    let answer;
    try {
      answer = await askOllama({
        question: data.question,
        context: contextText || 'No direct context found in current course data.',
      });
    } catch {
      // Local fallback when Ollama is unavailable.
      answer = ranked.length
        ? `I found related study content:\n\n${ranked
            .slice(0, 3)
            .map((r, i) => `${i + 1}. ${r.source}: ${r.text.slice(0, 220)}`)
            .join('\n')}\n\nPlease ask a more specific question and I can narrow it down.`
        : 'I could not find matching study context yet. Add more lecture descriptions, quiz content, or flashcards and ask again.';
    }

    const saved = await DoubtMessage.create({
      studentId: req.user.sub,
      question: data.question,
      answer,
      contextSources: ranked.map((r) => r.source),
    });

    res.status(201).json({
      message: {
        id: saved._id,
        question: saved.question,
        answer: saved.answer,
        contextSources: saved.contextSources,
        createdAt: saved.createdAt,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

export default router;

