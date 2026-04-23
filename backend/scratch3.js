import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';

dotenv.config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testUpload() {
  const absolutePath = path.resolve('C:\\Users\\sr0n\\Downloads\\Capstone Project\\backend\\test-upload.js');
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(absolutePath, {
        resource_type: 'auto',
        folder: 'vedalaya_lectures',
        chunk_size: 6000000
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    console.log("SUCCESS:", result.secure_url);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

testUpload();
