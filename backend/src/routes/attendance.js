import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';
import ClassGroup from '../models/ClassGroup.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTrainingCompleteEmail } from '../utils/email.js';
import { env } from '../utils/env.js';
import { markAbsentees } from '../utils/attendanceScheduler.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const ML_URL = () => env.ML_SERVICE_URL;

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
      if (apiErr.response) {
        // If the ML service responded with an error (e.g., 404, 503, 500)
        const mlError = apiErr.response.data?.error || 'ML service returned an error.';
        return res.status(apiErr.response.status).json({ error: mlError });
      }
      // If the ML service couldn't be reached at all (e.g., wrong URL, network error)
      return res.status(500).json({ error: 'ML service could not be reached. Please check ML_SERVICE_URL.', details: apiErr.message });
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
    const records = await Attendance.find({ user: req.user.sub })
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
    const records = await Attendance.find({ user: req.user.sub });
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

// ── Teacher: proxy face registration to ML service ────────────────────
// Keeps the ML service URL server-side; browser never calls ML directly
router.post('/register-face', requireAuth, requireRole('teacher'), upload.fields([{ name: 'images' }]), async (req, res) => {
  try {
    const { name, teacherEmail } = req.body;
    if (!name) return res.status(400).json({ error: 'Student name is required.' });

    const files = req.files?.images;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No images uploaded.' });

    const formData = new FormData();
    formData.append('name', name);
    if (teacherEmail) formData.append('teacherEmail', teacherEmail);
    for (const file of files) {
      formData.append('images', file.buffer, { filename: 'frame.jpg', contentType: file.mimetype || 'image/jpeg' });
    }

    const mlRes = await axios.post(`${ML_URL()}/register-face`, formData, {
      headers: { ...formData.getHeaders() },
      maxBodyLength: Infinity,
    });
    return res.status(mlRes.status).json(mlRes.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data?.error || 'ML service error.' });
  }
});

// ── Teacher: get ML service status ─────────────────────────────────────
router.get('/ml-status', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const mlRes = await axios.get(`${ML_URL()}/status`);
    res.json(mlRes.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ML status', details: error.message });
  }
});

// ── Webhook: ML service notifies that training is complete ─────────────
// Protected by a shared secret to prevent abuse
router.post('/notify-training', async (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'];
    if (env.WEBHOOK_SECRET && (!secret || secret !== env.WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
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

// ── Trigger ML model retrain (admin only) ────────────────────────────
router.post('/retrain', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL()}/retrain`, {}, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    const msg = err?.response?.data?.error || err.message || 'Failed to trigger retrain.';
    res.status(500).json({ error: msg });
  }
});

// ── Teacher: manually mark a student as absent ────────────────────────
router.post('/mark-absent', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId, date, classGroupId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required.' });

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Use provided date or today
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Check if a record already exists for this student on this date
    const query = { user: studentId, date: { $gte: targetDate, $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) } };
    if (classGroupId) query.classGroup = classGroupId;

    const existing = await Attendance.findOne(query);
    if (existing) {
      if (existing.status === 'Absent') {
        return res.status(200).json({ message: 'Already marked absent.', alreadyMarked: true });
      }
      // Update Present → Absent
      existing.status = 'Absent';
      await existing.save();
      return res.status(200).json({ message: `${student.name} updated to Absent.`, record: existing });
    }

    // Create new Absent record
    const record = await Attendance.create({
      user: studentId,
      classGroup: classGroupId || null,
      date: targetDate,
      status: 'Absent',
    });

    return res.status(201).json({ message: `${student.name} marked as Absent.`, record });
  } catch (error) {
    console.error('Error in /mark-absent:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Admin: manually trigger auto-absent job ───────────────────────────
// Useful for testing or if the scheduler missed a day
router.post('/mark-absentees', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await markAbsentees();
    res.json({ message: 'Auto-absent job completed. Check server logs for details.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
