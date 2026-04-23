import express from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';

import { Quiz } from '../models/Quiz.js';
import { Attempt } from '../models/Attempt.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  const query = isTeacher ? { createdBy: req.user.sub } : { status: 'published' };
  const quizzes = await Quiz.find(query).sort({ updatedAt: -1 }).select('title description status timeLimitSeconds createdBy updatedAt');
  res.json({ quizzes });
});

router.get('/:id', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });

  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });

  const isOwner = req.user.role === 'teacher' && quiz.createdBy.toString() === req.user.sub;
  const isStudent = req.user.role === 'student';
  if (!isOwner && !(isStudent && quiz.status === 'published')) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const dto = quiz.toObject();
  let attempted = false;
  let attemptId = null;

  if (isStudent) {
    dto.questions = dto.questions.map((q) => ({ _id: q._id, prompt: q.prompt, options: q.options }));
    const existingAttempt = await Attempt.findOne({ studentId: req.user.sub, quizId: quiz._id });
    if (existingAttempt) {
      attempted = true;
      attemptId = existingAttempt._id;
    }
  }
  return res.json({ quiz: { ...dto, attempted, attemptId } });
});

const questionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().int().min(0),
});

const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  timeLimitSeconds: z.number().int().min(10).optional(),
  questions: z.array(questionSchema).optional().default([]),
});

router.post('/', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const data = createQuizSchema.parse(req.body);
    const quiz = await Quiz.create({
      title: data.title,
      description: data.description,
      timeLimitSeconds: data.timeLimitSeconds ?? 300,
      questions: data.questions,
      createdBy: req.user.sub,
      status: 'draft',
    });
    return res.status(201).json({ quiz });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const updateQuizSchema = createQuizSchema.partial();

router.put('/:id', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
    const data = updateQuizSchema.parse(req.body);

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });
    if (quiz.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

    if (data.title !== undefined) quiz.title = data.title;
    if (data.description !== undefined) quiz.description = data.description;
    if (data.timeLimitSeconds !== undefined) quiz.timeLimitSeconds = data.timeLimitSeconds;
    if (data.questions !== undefined) quiz.questions = data.questions;

    await quiz.save();
    return res.json({ quiz });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });
  if (quiz.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

  await Attempt.deleteMany({ quizId: quiz._id });
  await quiz.deleteOne();
  return res.json({ ok: true });
});

router.post('/:id/publish', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });
  if (quiz.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });
  quiz.status = 'published';
  await quiz.save();
  return res.json({ quiz });
});

router.post('/:id/unpublish', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) return res.status(404).json({ error: { message: 'Quiz not found' } });
  if (quiz.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });
  quiz.status = 'draft';
  await quiz.save();
  return res.json({ quiz });
});

export default router;

