import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['student', 'teacher', 'admin'] },
    isVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true }, // teachers start false until admin approves
    isActive: { type: Boolean, default: true },   // admin can deactivate accounts
    otp: { type: String },
    otpExpiry: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

