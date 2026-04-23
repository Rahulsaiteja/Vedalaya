import express from 'express';
import ClassGroup from '../models/ClassGroup.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ── Create a new class/section ─────────────────────────────────────────
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { name, section } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Class name is required.' });

    const classGroup = await ClassGroup.create({
      name: name.trim(),
      section: section?.trim() || '',
      teacher: req.user.sub,
      students: [],
    });
    res.status(201).json({ classGroup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── List all classes for the logged-in teacher ─────────────────────────
router.get('/', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const classes = await ClassGroup.find({ teacher: req.user.sub })
      .populate('students', 'name email _id')
      .sort({ createdAt: -1 });
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Get a single class (with students) ────────────────────────────────
router.get('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const classGroup = await ClassGroup.findOne({ _id: req.params.id, teacher: req.user.sub })
      .populate('students', 'name email _id');
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
    res.json({ classGroup });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Update class name/section ──────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { name, section } = req.body;
    const classGroup = await ClassGroup.findOne({ _id: req.params.id, teacher: req.user.sub });
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });

    if (name?.trim()) classGroup.name = name.trim();
    if (section !== undefined) classGroup.section = section.trim();
    await classGroup.save();
    res.json({ classGroup });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Add a student to a class ───────────────────────────────────────────
router.post('/:id/students', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required.' });

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const classGroup = await ClassGroup.findOne({ _id: req.params.id, teacher: req.user.sub });
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });

    if (!classGroup.students.includes(studentId)) {
      classGroup.students.push(studentId);
      await classGroup.save();
    }

    const updated = await ClassGroup.findById(classGroup._id).populate('students', 'name email _id');
    res.json({ classGroup: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Remove a student from a class ─────────────────────────────────────
router.delete('/:id/students/:studentId', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const classGroup = await ClassGroup.findOne({ _id: req.params.id, teacher: req.user.sub });
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });

    classGroup.students = classGroup.students.filter(
      (s) => s.toString() !== req.params.studentId,
    );
    await classGroup.save();

    const updated = await ClassGroup.findById(classGroup._id).populate('students', 'name email _id');
    res.json({ classGroup: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Delete a class ─────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const classGroup = await ClassGroup.findOneAndDelete({ _id: req.params.id, teacher: req.user.sub });
    if (!classGroup) return res.status(404).json({ error: 'Class not found.' });
    res.json({ message: 'Class deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── List all students (for adding to classes) ──────────────────────────
router.get('/all/students', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name email _id').sort({ name: 1 });
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
