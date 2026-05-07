import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import chatbotRoute from './routes/chatbot.js';

import { connectDb } from './utils/connectDb.js';
import { env } from './utils/env.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import { loadFlashcardModel } from './utils/mlFlashcardGenerator.js';

import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quizzes.js';
import attemptRoutes from './routes/attempts.js';
import generatorRoutes from './routes/generate.js';
import flashcardRoutes from './routes/flashcards.js';
import lectureRoutes from './routes/lectures.js';
import doubtRoutes from './routes/doubts.js';
import trainingRoutes from './routes/training.js';
import scholarshipRoutes from './routes/scholarships.js';
import attendanceRoutes from './routes/attendance.js';
import classRoutes from './routes/classes.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
// PRD-compatible aliases:
app.use('/api', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/generate', generatorRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoute);

app.use(notFoundHandler);
app.use(errorHandler);

// Initialize
await connectDb(env.MONGODB_URI);

// Load ML model (non-blocking, will use fallback if fails)
loadFlashcardModel().catch(err => {
  console.log('⚠️  ML model not available, using rule-based fallback');
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});

