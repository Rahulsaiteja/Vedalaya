import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  GMAIL_USER: z.string().email(),
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_REFRESH_TOKEN: z.string().min(1),
  OLLAMA_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  ML_SERVICE_URL: z.string().default('http://localhost:5001'),
  GEMINI_API_KEY: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(8).optional(),
  // AWS S3 for lecture video storage
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('eu-north-1'),
  AWS_S3_BUCKET: z.string().optional(),
});

export const env = envSchema.parse(process.env);

