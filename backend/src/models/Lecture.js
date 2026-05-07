import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    sourceType: { type: String, enum: ['file', 'youtube'], default: 'file', required: true },
    mediaType: { type: String, enum: ['video', 'audio', 'document'], default: 'document', required: true },
    youtubeUrl: { type: String, default: '' },
    youtubeVideoId: { type: String, default: '' },
    file: {
      storedName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      cloudinaryUrl: { type: String, default: '' },
      cloudinaryPublicId: { type: String, default: '' },
      s3Key: { type: String, default: '' },
      s3Url: { type: String, default: '' },
    },
    variants: [{
      quality: { type: String, default: 'original' },
      storedName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      cloudinaryUrl: { type: String, default: '' },
      cloudinaryPublicId: { type: String, default: '' },
    }],
    processingStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed' },
  },
  { timestamps: true },
);

export const Lecture = mongoose.model('Lecture', lectureSchema);

