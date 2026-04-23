import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../utils/env.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeExt(originalName) {
  const ext = path.extname(originalName || '').slice(0, 12).toLowerCase();
  if (!ext || ext.includes(path.sep)) return '';
  return ext;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomBytes(16).toString('hex');
    cb(null, `${id}${safeExt(file.originalname)}`);
  },
});

export const uploadLecture = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

