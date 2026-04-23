import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  const testFile = 'test.txt';
  fs.writeFileSync(testFile, 'hello world');
  try {
    const result = await cloudinary.uploader.upload(testFile, {
      resource_type: 'auto',
      folder: 'vedalaya_lectures',
    });
    console.log('Upload success:', result.secure_url);
  } catch (err) {
    console.error('Upload error:', err);
  } finally {
    fs.unlinkSync(testFile);
  }
}

testUpload();
