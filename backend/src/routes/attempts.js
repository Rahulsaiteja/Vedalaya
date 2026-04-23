import express from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';

const router = express.Router();

const submitSchema = z.object({
  quizId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedIndex: z.number().int().min(0),
      }),
    )
    .default([]),
});

router.post('/submit', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const data = submitSchema.parse(req.body);
    if (!mongoose.isValidObjectId(data.quizId)) return res.status(400).json({ error: { message: 'Invalid quizId' } });

    const quiz = await Quiz.findById(data.quizId);
    if (!quiz || quiz.status !== 'published') return res.status(404).json({ error: { message: 'Quiz not found' } });

    const existingAttempt = await Attempt.findOne({ studentId: req.user.sub, quizId: quiz._id });
    if (existingAttempt) return res.status(400).json({ error: { message: 'Quiz already attempted' } });

    const answerMap = new Map(data.answers.map((a) => [a.questionId, a.selectedIndex]));
    let correct = 0;
    const computed = quiz.questions.map((q) => {
      const selectedIndex = answerMap.get(q._id.toString());
      const selected = typeof selectedIndex === 'number' ? selectedIndex : -1;
      const isCorrect = selected >= 0 && selected === q.correctOptionIndex;
      if (isCorrect) correct += 1;
      return { questionId: q._id, selectedIndex: selected, isCorrect };
    });

    const total = quiz.questions.length;
    const score = total === 0 ? 0 : Math.round((correct / total) * 100);

    const attempt = await Attempt.create({
      studentId: req.user.sub,
      quizId: quiz._id,
      score,
      totalQuestions: total,
      answers: computed,
    });

    return res.status(201).json({ attemptId: attempt._id, score, totalQuestions: total });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  const attempts = await Attempt.find({ studentId: req.user.sub })
    .sort({ createdAt: -1 })
    .populate('quizId', 'title')
    .lean();

  return res.json({
    attempts: attempts.map((a) => ({
      id: a._id,
      quiz: a.quizId ? { id: a.quizId._id, title: a.quizId.title } : null,
      score: a.score,
      totalQuestions: a.totalQuestions,
      submittedAt: a.submittedAt,
    })),
  });
});

router.get('/:attemptId', requireAuth, requireRole('student'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.attemptId)) {
    return res.status(400).json({ error: { message: 'Invalid attemptId' } });
  }

  const attempt = await Attempt.findOne({ _id: req.params.attemptId, studentId: req.user.sub }).lean();
  if (!attempt) return res.status(404).json({ error: { message: 'Attempt not found' } });

  const quiz = await Quiz.findById(attempt.quizId).lean();
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });

  const answerMap = new Map((attempt.answers || []).map((a) => [a.questionId.toString(), a]));
  const review = (quiz.questions || []).map((q) => {
    const a = answerMap.get(q._id.toString());
    return {
      questionId: q._id,
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      selectedIndex: a ? a.selectedIndex : -1,
      isCorrect: a ? a.isCorrect : false,
    };
  });

  return res.json({
    attempt: {
      id: attempt._id,
      quizId: attempt.quizId,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      submittedAt: attempt.submittedAt,
      review,
    },
  });
});

router.get('/quiz/:quizId', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ error: { message: 'Invalid quizId' } });
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });
  if (quiz.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

  const attempts = await Attempt.find({ quizId: quiz._id }).sort({ createdAt: -1 }).populate('studentId', 'name email').lean();
  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0;

  return res.json({
    quiz: { id: quiz._id, title: quiz.title },
    analytics: { attempts: attempts.length, averageScore: avg },
    attempts: attempts.map((a) => ({
      id: a._id,
      student: a.studentId ? { id: a.studentId._id, name: a.studentId.name, email: a.studentId.email } : null,
      score: a.score,
      submittedAt: a.submittedAt,
    })),
  });
});

export default router;

