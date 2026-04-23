import mongoose from 'mongoose';

const doubtMessageSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    contextSources: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const DoubtMessage = mongoose.model('DoubtMessage', doubtMessageSchema);

