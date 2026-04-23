import ffmpeg from 'fluent-ffmpeg';
import installer from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { Lecture } from '../models/Lecture.js';

ffmpeg.setFfmpegPath(installer.path);

export async function processVideoVariants(lectureId, originalFilePath, originalFileName, uploadDir) {
  try {
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) return;

    lecture.processingStatus = 'processing';
    await lecture.save();

    const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;

    // We generate 480p version for rural environments
    const variantsToGenerate = [
      { resolution: 480, label: '480p' }
    ];
    
    const newVariants = [];

    // Include original as highest quality fallback
    newVariants.push({
      quality: 'original',
      storedName: originalFileName,
      mimeType: String(lecture.file.mimeType),
      size: Number(lecture.file.size)
    });

    for (const v of variantsToGenerate) {
      const storedName = `${nameWithoutExt}_${v.label}.mp4`;
      const outputPath = path.join(uploadDir, storedName);

      console.log(`Processing ${v.label} for ${originalFileName}...`);
      await new Promise((resolve, reject) => {
        ffmpeg(originalFilePath)
          .outputOptions([
            '-c:v libx264',
            '-crf 28',
            '-preset veryfast', // faster CPU preset
            '-c:a aac',
            '-b:a 128k'
          ])
          .size(`?x${v.resolution}`)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const stat = fs.statSync(outputPath);
      newVariants.push({
        quality: v.label,
        storedName: storedName,
        mimeType: 'video/mp4',
        size: stat.size
      });
    }

    lecture.variants = newVariants;
    lecture.processingStatus = 'completed';
    await lecture.save();
    console.log(`Finished processing variants for ${lectureId}`);
  } catch (error) {
    console.error(`Error processing video for lecture ${lectureId}:`, error);
    const lec = await Lecture.findById(lectureId);
    if (lec) {
      lec.processingStatus = 'failed';
      await lec.save();
    }
  }
}
