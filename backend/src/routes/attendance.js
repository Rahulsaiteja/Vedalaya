import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';
import ClassGroup from '../models/ClassGroup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTrainingCompleteEmail } from '../utils/email.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:5001';

// ── Mark attendance via face recognition ──────────────────────────────
// classGroupId is optional; if provided, attendance is tied to the class
router.post('/mark', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    const { classGroupId } = req.body;

    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: 'face.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    let mlResponse;
    try {
      mlResponse = await axios.post(`${ML_URL()}/predict`, formData, {
        headers: { ...formData.getHeaders() },
      });
    } catch (apiErr) {
      if (apiErr.response?.status === 404)
        return res.status(404).json({ error: apiErr.response.data.error || 'Face not recognized.' });
      return res.status(500).json({ error: 'ML service unavailable.', details: apiErr.message });
    }

    const recognizedName = mlResponse.data.match;

    const user = await User.findOne({
      $or: [{ name: recognizedName }, { email: recognizedName }],
    });
    if (!user)
      return res.status(404).json({
        error: `Recognized as "${recognizedName}" but not found in database.`,
      });

    // Security check: If a student is marking attendance, the face MUST match their logged-in account
    if (req.user.role === 'student' && user._id.toString() !== req.user.sub) {
      return res.status(403).json({
        error: `Face matched ${user.name}, but you are logged in as ${req.user.name}. Attendance not marked.`,
      });
    }

    // Validate classGroup if provided
    let classGroup = null;
    if (classGroupId) {
      classGroup = await ClassGroup.findById(classGroupId);
      if (!classGroup) return res.status(404).json({ error: 'Class section not found.' });

      // Check if the student belongs to this class
      const isMember = classGroup.students.some(s => s.toString() === user._id.toString());
      if (!isMember) {
        return res.status(403).json({
          error: `${user.name} is not enrolled in this class section.`,
        });
      }
    }

    // Prevent duplicate attendance for same student in same class on the same day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const query = { user: user._id, date: { $gte: today } };
    if (classGroupId) query.classGroup = classGroupId;

    const existing = await Attendance.findOne(query);
    if (existing) {
      return res.status(200).json({
        message: 'Attendance already marked today.',
        alreadyMarked: true,
        user: { name: user.name, email: user.email },
        confidence: mlResponse.data.confidence,
        classGroup: classGroup ? { _id: classGroup._id, name: classGroup.name, section: classGroup.section } : null,
      });
    }

    const record = await Attendance.create({
      user: user._id,
      classGroup: classGroupId || null,
      status: 'Present',
    });

    return res.status(200).json({
      message: 'Attendance marked successfully.',
      user: { name: user.name, email: user.email },
      confidence: mlResponse.data.confidence,
      recordId: record._id,
      classGroup: classGroup ? { _id: classGroup._id, name: classGroup.name, section: classGroup.section } : null,
    });
  } catch (error) {
    console.error('Error in /mark:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Student: get own attendance history ───────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user.id })
      .populate('classGroup', 'name section')
      .sort({ date: -1 })
      .limit(100);
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Student: get own attendance stats ─────────────────────────────────
router.get('/my/stats', requireAuth, async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user.id });
    const total   = records.length;
    const present = records.filter(r => r.status === 'Present').length;
    res.json({ total, present, absent: total - present, percentage: total ? Math.round(present / total * 100) : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Teacher: all records with optional filters ─────────────────────────
router.get('/records', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId, classGroupId, from, to, limit = 200 } = req.query;
    const query = {};
    if (studentId) query.user = studentId;
    if (classGroupId) query.classGroup = classGroupId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to)   query.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
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

// ── Teacher: list of students (for filters/registration) ──────────────
router.get('/students', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name email _id').sort({ name: 1 });
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Teacher: get attendance stats per student ──────────────────────────
router.get('/stats', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { classGroupId } = req.query;
    const studentQuery = { role: 'student' };

    // If classGroupId provided, only show stats for students in that class
    let studentIds;
    if (classGroupId) {
      const classGroup = await ClassGroup.findById(classGroupId);
      if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
      studentIds = classGroup.students;
    }

    const students = await User.find(
      studentIds ? { _id: { $in: studentIds }, role: 'student' } : studentQuery,
      'name email _id'
    );

    const stats = await Promise.all(
      students.map(async (s) => {
        const attQuery = { user: s._id };
        if (classGroupId) attQuery.classGroup = classGroupId;
        const records = await Attendance.find(attQuery);
        const total   = records.length;
        const present = records.filter(r => r.status === 'Present').length;
        return {
          student: { _id: s._id, name: s.name, email: s.email },
          total,
          present,
          absent: total - present,
          percentage: total ? Math.round(present / total * 100) : 0,
        };
      })
    );
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Legacy: all records ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate('user', 'name email')
      .populate('classGroup', 'name section')
      .sort({ date: -1 })
      .limit(50);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Webhook: ML service notifies that training is complete ─────────────
router.post('/notify-training', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required.' });
    }
    
    await sendTrainingCompleteEmail(email, name);
    res.status(200).json({ message: 'Notification sent successfully.' });
  } catch (error) {
    console.error('Error in /notify-training:', error);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

export default router;
