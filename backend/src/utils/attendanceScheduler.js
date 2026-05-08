/**
 * Attendance Scheduler
 * 
 * Runs every day at 2:00 PM IST (08:30 UTC) Monday–Saturday.
 * Marks all students who have NOT marked attendance that day as Absent.
 * 
 * Window: 7:00 AM – 2:00 PM IST
 * Days:   Monday (1) – Saturday (6)  [Sunday = 0 is skipped]
 */

import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';

// IST = UTC+5:30
// 2:00 PM IST = 08:30 UTC  → cron: "30 8 * * 1-6"
const CRON_SCHEDULE = '30 8 * * 1-6';

async function markAbsentees() {
  try {
    console.log('[Attendance Scheduler] Running auto-absent job...');

    // Get today's date boundaries in IST
    // IST offset = +330 minutes
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + 330 * 60 * 1000);

    // Start of today in IST (midnight IST = 18:30 UTC previous day)
    const todayISTMidnight = new Date(nowIST);
    todayISTMidnight.setHours(0, 0, 0, 0);
    const todayStartUTC = new Date(todayISTMidnight.getTime() - 330 * 60 * 1000);

    // End of today in IST (2:00 PM IST = 08:30 UTC)
    const todayEndUTC = new Date(todayStartUTC.getTime() + (14 * 60) * 60 * 1000); // +14 hours

    // Get all students
    const students = await User.find({ role: 'student' }, '_id name').lean();
    if (students.length === 0) {
      console.log('[Attendance Scheduler] No students found.');
      return;
    }

    // Get all attendance records for today (Present or Absent already marked)
    const todayRecords = await Attendance.find({
      date: { $gte: todayStartUTC, $lt: todayEndUTC },
    }, 'user').lean();

    const studentsWithRecord = new Set(todayRecords.map(r => r.user.toString()));

    // Find students with no record today
    const absentStudents = students.filter(s => !studentsWithRecord.has(s._id.toString()));

    if (absentStudents.length === 0) {
      console.log('[Attendance Scheduler] All students already have attendance today.');
      return;
    }

    // Bulk insert Absent records
    const absentRecords = absentStudents.map(s => ({
      user: s._id,
      classGroup: null,
      date: todayEndUTC, // mark at 2 PM IST
      status: 'Absent',
    }));

    await Attendance.insertMany(absentRecords, { ordered: false });

    console.log(`[Attendance Scheduler] Marked ${absentStudents.length} student(s) as Absent:`);
    absentStudents.forEach(s => console.log(`  - ${s.name}`));

  } catch (err) {
    console.error('[Attendance Scheduler] Error:', err.message);
  }
}

export function startAttendanceScheduler() {
  // Validate cron expression
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('[Attendance Scheduler] Invalid cron schedule:', CRON_SCHEDULE);
    return;
  }

  cron.schedule(CRON_SCHEDULE, markAbsentees, {
    timezone: 'UTC', // we handle IST conversion manually
  });

  console.log(`[Attendance Scheduler] Started — runs at 2:00 PM IST (Mon–Sat)`);
}

// Export for manual trigger via API
export { markAbsentees };
