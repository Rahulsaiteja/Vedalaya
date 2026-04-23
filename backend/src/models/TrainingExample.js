import mongoose from 'mongoose';

const trainingExampleSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    response: { type: String, required: true, trim: true },
    source: { type: String, default: 'manual', trim: true }, // manual | doubt
    tags: { type: [String], default: [] },
    approved: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const TrainingExample = mongoose.model('TrainingExample', trainingExampleSchema);

