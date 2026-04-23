import express from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { FlashcardSet } from '../models/FlashcardSet.js';

const router = express.Router();

const createSetSchema = z.object({
  title: z.string().min(1),
  topic: z.string().optional().default(''),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
});

router.post('/sets', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const data = createSetSchema.parse(req.body);
    const set = await FlashcardSet.create({
      title: data.title,
      topic: data.topic,
      cards: data.cards,
      createdBy: req.user.sub,
    });
    return res.status(201).json({ set });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.get('/sets/me', requireAuth, requireRole('student'), async (req, res) => {
  const sets = await FlashcardSet.find({ createdBy: req.user.sub }).sort({ updatedAt: -1 }).select('title topic updatedAt');
  return res.json({ sets });
});

router.get('/sets/:id', requireAuth, requireRole('student'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const set = await FlashcardSet.findById(req.params.id);
  if (!set) return res.status(404).json({ error: { message: 'Not found' } });
  if (set.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });
  return res.json({ set });
});

const addCardsSchema = z.object({
  cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1),
});

router.post('/sets/:id/cards', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
    const data = addCardsSchema.parse(req.body);
    const set = await FlashcardSet.findById(req.params.id);
    if (!set) return res.status(404).json({ error: { message: 'Not found' } });
    if (set.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

    set.cards.push(...data.cards);
    await set.save();
    return res.json({ set });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.delete('/sets/:id', requireAuth, requireRole('student'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  
  const set = await FlashcardSet.findById(req.params.id);
  if (!set) return res.status(404).json({ error: { message: 'Not found' } });
  if (set.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

  await set.deleteOne();
  return res.json({ ok: true });
});

export default router;

