import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { TrainingExample } from '../models/TrainingExample.js';
import { DoubtMessage } from '../models/DoubtMessage.js';

const router = express.Router();

const createSchema = z.object({
  prompt: z.string().min(5),
  response: z.string().min(3),
  tags: z.array(z.string()).optional().default([]),
});

router.post('/examples', requireAuth, requireRole('teacher'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const example = await TrainingExample.create({
      prompt: data.prompt,
      response: data.response,
      tags: data.tags,
      source: 'manual',
      approved: true,
      createdBy: req.user.sub,
    });
    res.status(201).json({ example });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.get('/examples', requireAuth, requireRole('teacher'), async (req, res) => {
  const examples = await TrainingExample.find().sort({ createdAt: -1 }).limit(500).lean();
  res.json({ examples });
});

router.delete('/examples/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  await TrainingExample.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Promote an existing doubt answer into fine-tuning dataset.
router.post('/examples/from-doubt/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const msg = await DoubtMessage.findById(req.params.id).lean();
  if (!msg) return res.status(404).json({ error: { message: 'Doubt message not found' } });

  const example = await TrainingExample.create({
    prompt: msg.question,
    response: msg.answer,
    source: 'doubt',
    approved: true,
    createdBy: req.user.sub,
    tags: ['from-doubt'],
  });
  res.status(201).json({ example });
});

export default router;

