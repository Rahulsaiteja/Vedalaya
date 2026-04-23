import express from 'express';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';
import ClassGroup from '../models/ClassGroup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

// ── Overview stats ─────────────────────────────────────────────────────
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalStudents, totalTeachers, pendingTeachers, totalClasses, totalAttendance] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher', isApproved: true }),
      User.countDocuments({ role: 'teacher', isApproved: false }),
      ClassGroup.countDocuments(),
      Attendance.countDocuments(),
    ]);

    const presentCount = await Attendance.countDocuments({ status: 'Present' });
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    res.json({ totalUsers, totalStudents, totalTeachers, pendingTeachers, totalClasses, totalAttendance, attendanceRate });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── List all users ─────────────────────────────────────────────────────
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, isApproved, isActive, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];

    const users = await User.find(query, '-passwordHash -otp -otpExpiry').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Update user (role, isApproved, isActive) ───────────────────────────
router.patch('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const { role, isApproved, isActive, name } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Prevent admin from changing own role or deactivating themselves
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'Cannot modify your own account via admin panel.' });
    }

    if (role !== undefined) user.role = role;
    if (isApproved !== undefined) user.isApproved = isApproved;
    if (isActive !== undefined) user.isActive = isActive;
    if (name !== undefined) user.name = name.trim();
    await user.save();

    const updated = user.toObject();
    delete updated.passwordHash;
    delete updated.otp;
    delete updated.otpExpiry;
    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Delete user ────────────────────────────────────────────────────────
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── List ALL classes (all teachers) ───────────────────────────────────
router.get('/classes', ...adminOnly, async (req, res) => {
  try {
    const classes = await ClassGroup.find()
      .populate('teacher', 'name email')
      .populate('students', 'name email _id')
      .sort({ createdAt: -1 });
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Update class (name, section, reassign teacher) ─────────────────────
router.patch('/classes/:id', ...adminOnly, async (req, res) => {
  try {
    const { name, section, teacherId } = req.body;
    const classGroup = await ClassGroup.findById(req.params.id);
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });

    if (name?.trim()) classGroup.name = name.trim();
    if (section !== undefined) classGroup.section = section.trim();
    if (teacherId) {
      const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
      if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
      classGroup.teacher = teacherId;
    }
    await classGroup.save();

    const updated = await ClassGroup.findById(classGroup._id)
      .populate('teacher', 'name email')
      .populate('students', 'name email _id');
    res.json({ classGroup: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Delete class ───────────────────────────────────────────────────────
router.delete('/classes/:id', ...adminOnly, async (req, res) => {
  try {
    const classGroup = await ClassGroup.findByIdAndDelete(req.params.id);
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
    res.json({ message: 'Class deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Attendance: all records with full filters ──────────────────────────
router.get('/attendance', ...adminOnly, async (req, res) => {
  try {
    const { studentId, classGroupId, from, to, limit = 200 } = req.query;
    const query = {};
    if (studentId) query.user = studentId;
    if (classGroupId) query.classGroup = classGroupId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    const records = await Attendance.find(query)
      .populate('user', 'name email')
      .populate('classGroup', 'name section')
      .sort({ date: -1 })
      .limit(Number(limit));
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Attendance: manual correction ─────────────────────────────────────
router.patch('/attendance/:id', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Present or Absent.' });
    }
    const record = await Attendance.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('user', 'name email')
      .populate('classGroup', 'name section');
    if (!record) return res.status(404).json({ error: 'Record not found.' });
    res.json({ record });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Attendance: delete record ──────────────────────────────────────────
router.delete('/attendance/:id', ...adminOnly, async (req, res) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found.' });
    res.json({ message: 'Record deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
