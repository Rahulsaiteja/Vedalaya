import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadLecture } from '../middleware/upload.js';
import { Lecture } from '../models/Lecture.js';
import { env } from '../utils/env.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// S3 client — only initialised if AWS credentials are present
const s3 = env.AWS_ACCESS_KEY_ID && env.AWS_S3_BUCKET
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // avoids virtual-hosted style URL issues
    })
  : null;

const S3_BUCKET = env.AWS_S3_BUCKET || '';

const router = express.Router();

// Generate a presigned S3 URL so the frontend can upload directly to S3
// Falls back to Cloudinary signed upload if S3 is not configured
router.post('/sign-upload', requireAuth, requireRole('teacher'), async (req, res) => {
  // S3 path
  if (s3 && S3_BUCKET) {
    try {
      const { fileName, fileType } = req.body;
      const ext = fileName ? path.extname(fileName) : '.mp4';
      const key = `lectures/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: fileType || 'video/mp4',
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      // Path-style URL: https://s3.eu-north-1.amazonaws.com/bucket/key
      const fileUrl = `https://s3.${env.AWS_REGION}.amazonaws.com/${S3_BUCKET}/${key}`;

      return res.json({
        provider: 's3',
        presignedUrl,   // PUT directly to this URL
        fileUrl,        // public URL after upload
        key,
      });
    } catch (err) {
      console.error('S3 presign error:', err);
      return res.status(500).json({ error: { message: 'Failed to generate upload URL: ' + err.message } });
    }
  }

  // Cloudinary fallback
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'vedalaya_lectures';
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);
  return res.json({
    provider: 'cloudinary',
    signature,
    timestamp,
    folder,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
  });
});

function getYoutubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === 'embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function inferFileMediaType(mimeType) {
  const mt = (mimeType || '').toLowerCase();
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return 'document';
}

router.get('/', requireAuth, async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  const query = isTeacher ? { createdBy: req.user.sub } : { status: 'published' };
  const lectures = await Lecture.find(query)
    .sort({ updatedAt: -1 })
    .select('title description category status createdBy sourceType mediaType youtubeUrl youtubeVideoId file variants processingStatus updatedAt')
    .lean();
  const normalized = lectures.map((l) => ({
    ...l,
    mediaType: l.mediaType || (l.sourceType === 'youtube' ? 'video' : inferFileMediaType(l.file?.mimeType)),
  }));
  res.json({ lectures: normalized });
});

router.post(
  '/',
  requireAuth,
  requireRole('teacher'),
  uploadLecture.single('file'),
  async (req, res) => {
    const bodySchema = z.object({
      title: z.string().min(1),
      description: z.string().optional().default(''),
      category: z.string().optional().default('General'),
      youtubeUrl: z.string().optional().default(''),
      // Direct Cloudinary upload fields (when frontend uploads directly)
      cloudinaryUrl: z.string().optional().default(''),
      cloudinaryPublicId: z.string().optional().default(''),
      // S3 upload fields
      s3Url: z.string().optional().default(''),
      s3Key: z.string().optional().default(''),
      originalName: z.string().optional().default(''),
      mimeType: z.string().optional().default(''),
      fileSize: z.coerce.number().optional().default(0),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: parsed.error.message } });

    const youtubeUrl = parsed.data.youtubeUrl?.trim() || '';
    const youtubeVideoId = youtubeUrl ? getYoutubeVideoId(youtubeUrl) : null;
    const isYoutube = Boolean(youtubeVideoId);

    // Direct upload path — Cloudinary URL provided by frontend
    const isDirectUpload = Boolean(parsed.data.cloudinaryUrl) || Boolean(parsed.data.s3Url);

    if (!isYoutube && !req.file && !isDirectUpload) {
      return res.status(400).json({ error: { message: 'Provide either a file, a Cloudinary upload, an S3 upload, or a valid YouTube URL' } });
    }

    let cloudinaryUrl = parsed.data.cloudinaryUrl || '';
    let cloudinaryPublicId = parsed.data.cloudinaryPublicId || '';
    let s3Url = parsed.data.s3Url || '';
    let s3Key = parsed.data.s3Key || '';
    let fileName = parsed.data.originalName || '';
    let fileMime = parsed.data.mimeType || '';
    let fileSize = parsed.data.fileSize || 0;

    // Use S3 URL as the primary URL if available
    const primaryUrl = s3Url || cloudinaryUrl;

    // Legacy path — file uploaded through Render (small files only)
    if (!isYoutube && req.file && !isDirectUpload) {
      const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, req.file.filename);
      try {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(absolutePath, {
            resource_type: 'auto',
            folder: 'vedalaya_lectures',
            chunk_size: 20000000, // 20MB chunks for better reliability
            timeout: 600000, // 10 minute timeout per chunk
          }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
        cloudinaryUrl = result.secure_url;
        cloudinaryPublicId = result.public_id;
        fileName = req.file.originalname;
        fileMime = req.file.mimetype;
        fileSize = req.file.size;
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        return res.status(500).json({ error: { message: 'Cloudinary upload failed: ' + (err.message || 'Unknown error') } });
      } finally {
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      }
    }

    const lecture = await Lecture.create({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      createdBy: req.user.sub,
      status: 'draft',
      sourceType: isYoutube ? 'youtube' : 'file',
      mediaType: isYoutube ? 'video' : inferFileMediaType(fileMime),
      youtubeUrl: isYoutube ? youtubeUrl : '',
      youtubeVideoId: isYoutube ? youtubeVideoId : '',
      file: {
        storedName: fileName,
        originalName: fileName,
        mimeType: fileMime,
        size: fileSize,
        cloudinaryUrl: primaryUrl,
        cloudinaryPublicId,
        s3Key,
        s3Url,
      },
      variants: isYoutube ? [] : [
        { quality: 'original', storedName: fileName, mimeType: fileMime, size: fileSize, cloudinaryUrl: primaryUrl, cloudinaryPublicId },
        { quality: '720p',     storedName: fileName, mimeType: fileMime, size: fileSize, cloudinaryUrl: primaryUrl, cloudinaryPublicId },
        { quality: '480p',     storedName: fileName, mimeType: fileMime, size: fileSize, cloudinaryUrl: primaryUrl, cloudinaryPublicId },
        { quality: '360p',     storedName: fileName, mimeType: fileMime, size: fileSize, cloudinaryUrl: primaryUrl, cloudinaryPublicId },
      ],
      processingStatus: 'completed',
    });

    res.status(201).json({ lecture });
  },
);

router.post('/:id/publish', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: { message: 'Lecture not found' } });
  if (lecture.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });
  lecture.status = 'published';
  await lecture.save();
  res.json({ lecture });
});

router.post('/:id/unpublish', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: { message: 'Lecture not found' } });
  if (lecture.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });
  lecture.status = 'draft';
  await lecture.save();
  res.json({ lecture });
});

router.get('/:id/download', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: { message: 'Lecture not found' } });

  const isOwner = req.user.role === 'teacher' && lecture.createdBy.toString() === req.user.sub;
  const isStudentAllowed = req.user.role === 'student' && lecture.status === 'published';
  if (!isOwner && !isStudentAllowed) return res.status(403).json({ error: { message: 'Forbidden' } });
  if (lecture.sourceType !== 'file') {
    return res.status(400).json({ error: { message: 'Download is only available for file lectures' } });
  }

  const quality = req.query.quality;
  let targetFile = lecture.file;
  
  if (targetFile.cloudinaryUrl) {
    // Cloudinary download: use fl_attachment flag
    // e.g., https://res.cloudinary.com/cloud_name/video/upload/fl_attachment/v1234/public_id.mp4
    let url = targetFile.cloudinaryUrl;
    if (url.includes('/upload/')) {
      url = url.replace('/upload/', '/upload/fl_attachment/');
    }
    return res.redirect(url);
  }

  // Fallback for older local files
  const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, targetFile.storedName);
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: { message: 'File missing on server' } });

  res.setHeader('Content-Type', targetFile.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${(targetFile.originalName || targetFile.storedName).replace(/"/g, '')}"`);
  return fs.createReadStream(absolutePath).pipe(res);
});

router.get('/:id/stream', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: { message: 'Lecture not found' } });

  const isOwner = req.user.role === 'teacher' && lecture.createdBy.toString() === req.user.sub;
  const isStudentAllowed = req.user.role === 'student' && lecture.status === 'published';
  if (!isOwner && !isStudentAllowed) return res.status(403).json({ error: { message: 'Forbidden' } });
  if (lecture.sourceType !== 'file') {
    return res.status(400).json({ error: { message: 'Streaming is only available for file lectures' } });
  }

  const quality = req.query.quality;
  let targetFile = lecture.file;

  if (targetFile.cloudinaryUrl) {
    let url = targetFile.cloudinaryUrl;
    // Disabling dynamic transcoding because Cloudinary free tier rejects 
    // synchronous transformations for large videos.
    // If you need quality selection, you must pre-generate variants using 'eager' transformations during upload.
    return res.redirect(url);
  }

  // Fallback for older local files
  const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, targetFile.storedName);
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: { message: 'File missing on server' } });

  const stat = fs.statSync(absolutePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const stream = fs.createReadStream(absolutePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': targetFile.mimeType,
    });
    return stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': targetFile.mimeType,
      'Accept-Ranges': 'bytes',
    });
    return fs.createReadStream(absolutePath).pipe(res);
  }
});

router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid id' } });
  const lecture = await Lecture.findById(req.params.id);
  if (!lecture) return res.status(404).json({ error: { message: 'Lecture not found' } });
  if (lecture.createdBy.toString() !== req.user.sub) return res.status(403).json({ error: { message: 'Forbidden' } });

  // Delete from S3 if stored there
  if (lecture.file?.s3Key && s3 && S3_BUCKET) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: lecture.file.s3Key }));
    } catch (e) {
      console.error('Failed to delete from S3:', e);
    }
  }

  // Delete from Cloudinary if stored there (legacy)
  if (lecture.file?.cloudinaryPublicId && !lecture.file?.s3Key) {
    try {
      await cloudinary.uploader.destroy(lecture.file.cloudinaryPublicId, { resource_type: lecture.mediaType === 'video' ? 'video' : 'raw' });
    } catch (e) {
      console.error('Failed to delete from Cloudinary:', e);
    }
  }

  // Delete from local filesystem if it existed locally
  const absolutePath = lecture.file?.storedName && !lecture.file?.cloudinaryUrl
    ? path.resolve(process.cwd(), env.UPLOAD_DIR, lecture.file.storedName)
    : null;
  await lecture.deleteOne();
  try {
    if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch {
    // ignore delete errors
  }

  res.json({ ok: true });
});

export default router;

