import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function testUpload() {
  const absolutePath = path.resolve('C:\\Users\\sr0n\\Downloads\\Capstone Project\\backend\\test-upload.js');
  try {
    const result = await cloudinary.uploader.upload_large(absolutePath, {
      resource_type: 'auto',
      folder: 'vedalaya_lectures',
      chunk_size: 6000000
    });
    console.log("SUCCESS:", result.secure_url);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

testUpload();
