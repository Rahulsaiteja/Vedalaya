import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema(
  {
    front: { type: String, required: true, trim: true },
    back: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const flashcardSetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topic: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cards: { type: [flashcardSchema], default: [] },
  },
  { timestamps: true },
);

export const FlashcardSet = mongoose.model('FlashcardSet', flashcardSetSchema);

