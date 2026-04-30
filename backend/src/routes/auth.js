import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { User } from '../models/User.js';
import { signAccessToken } from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../utils/email.js';
import { env } from '../utils/env.js';
import crypto from 'crypto';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['student', 'teacher']),
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      if (!existing.isVerified) {
        const passwordHash = await bcrypt.hash(data.password, 10);
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        
        existing.name = data.name;
        existing.passwordHash = passwordHash;
        existing.role = data.role;
        existing.otp = otp;
        existing.otpExpiry = otpExpiry;
        await existing.save();

        await sendOtpEmail(data.email, otp);
        return res.status(201).json({ message: 'OTP sent', email: data.email });
      } else {
        return res.status(409).json({ error: { message: 'Email already in use' } });
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.create({ 
      name: data.name, 
      email: data.email, 
      passwordHash, 
      role: data.role,
      isApproved: data.role === 'teacher' ? false : true, // teachers need admin approval
      otp,
      otpExpiry
    });

    await sendOtpEmail(data.email, otp);

    return res.status(201).json({ message: 'OTP sent', email: data.email });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const data = verifyOtpSchema.parse(req.body);
    const user = await User.findOne({ email: data.email });

    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    if (user.isVerified) return res.status(400).json({ error: { message: 'Already verified' } });

    if (user.otp !== data.otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: { message: 'Invalid or expired OTP' } });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = signAccessToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const resendOtpSchema = z.object({
  email: z.string().email(),
});

router.post('/resend-otp', async (req, res, next) => {
  try {
    const data = resendOtpSchema.parse(req.body);
    const user = await User.findOne({ email: data.email });

    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    if (user.isVerified) return res.status(400).json({ error: { message: 'Already verified' } });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(data.email, otp);

    return res.json({ message: 'OTP resent' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email });
    if (!user) return res.status(401).json({ error: { message: 'Invalid credentials' } });

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: { message: 'Invalid credentials' } });

    if (!user.isVerified) {
      return res.status(403).json({ error: { message: 'Email not verified', needsVerification: true, email: user.email } });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: { message: 'Your account has been deactivated. Please contact admin.' } });
    }

    if (user.role === 'teacher' && !user.isApproved) {
      return res.status(403).json({ error: { message: 'Your teacher account is pending admin approval. You will be notified once approved.' } });
    }

    const token = signAccessToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ email });

    // Do not leak if user exists or not for security, but here we can just say "If an account exists, an email was sent"
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${env.CLIENT_ORIGIN}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: { message: 'Password reset token is invalid or has expired.' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been successfully reset.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: err.message } });
    return next(err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    user: { id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role },
  });
});

export default router;
