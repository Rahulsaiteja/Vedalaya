import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    options: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.every((s) => typeof s === 'string' && s.trim()),
        message: 'Options must contain at least 2 non-empty strings',
      },
    },
    correctOptionIndex: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    timeLimitSeconds: { type: Number, default: 300, min: 10 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);

quizSchema.pre('validate', function (next) {
  for (const q of this.questions) {
    if (q.correctOptionIndex >= q.options.length) {
      return next(new Error('correctOptionIndex out of range'));
    }
  }
  return next();
});

export const Quiz = mongoose.model('Quiz', quizSchema);

