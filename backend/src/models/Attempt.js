import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedIndex: { type: Number, required: true, min: -1 },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false },
);

const attemptSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    submittedAt: { type: Date, default: Date.now },
    score: { type: Number, required: true, min: 0, max: 100 },
    totalQuestions: { type: Number, required: true, min: 0 },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true },
);

export const Attempt = mongoose.model('Attempt', attemptSchema);

