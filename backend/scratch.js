import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lecture } from './src/models/Lecture.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const lectures = await Lecture.find({ sourceType: 'file' }).sort({ createdAt: -1 }).limit(1);
  console.log(JSON.stringify(lectures, null, 2));
  mongoose.disconnect();
}
check();
