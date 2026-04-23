import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User.js';

import fs from 'fs';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const u = await User.findOne({email: 'testuser2@example.com'});
  if (u) {
    fs.writeFileSync('otp_output.json', JSON.stringify({ user: u, now: new Date() }, null, 2));
  } else {
    console.log('User not found');
  }
  process.exit(0);
}).catch(console.error);
