/**
 * seed-admin.js
 * Run once to create the first admin account.
 * Usage: node scripts/seed-admin.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: String,
  isVerified: Boolean,
  isApproved: Boolean,
  isActive: Boolean,
  otp: String,
  otpExpiry: Date,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@vedalaya.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Admin';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.isVerified = true;
      existing.isApproved = true;
      existing.isActive = true;
      await existing.save();
      console.log(`✅ Upgraded existing user "${ADMIN_EMAIL}" to admin.`);
    } else {
      console.log(`ℹ️  Admin "${ADMIN_EMAIL}" already exists. Nothing to do.`);
    }
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    isVerified: true,
    isApproved: true,
    isActive: true,
  });

  console.log(`✅ Admin account created!`);
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠️  Change this password after first login!`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
