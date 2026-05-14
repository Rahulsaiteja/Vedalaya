/**
 * Attendance Scheduler
 *
 * Runs every day at 2:00 PM IST (08:30 UTC) Monday–Saturday.
 * Marks all students who have NOT marked attendance that day as Absent.
 *
 * IST = UTC+5:30
 * 2:00 PM IST = 08:30 UTC  →  cron: "30 8 * * 1-6"
 */

import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';

const CRON_SCHEDULE = '30 8 * * 1-6';

/**
 * Returns the full IST day boundaries for a given UTC Date.
 *   todayStartUTC = midnight IST expressed in UTC
 *   todayEndUTC   = next midnight IST expressed in UTC  (exclusive)
 */
function getISTDayBounds(utcNow) {
  const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30 in ms

  // Shift to IST, zero out time components to get IST midnight
  const nowIST = new Date(utcNow.getTime() + IST_OFFSET_MS);
  const midnightIST = new Date(nowIST);
  midnightIST.setHours(0, 0, 0, 0);

  // Convert IST midnight back to UTC
  const todayStartUTC = new Date(midnightIST.getTime() - IST_OFFSET_MS);
  const todayEndUTC   = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);

  return { todayStartUTC, todayEndUTC };
}

export async function markAbsentees() {
  try {
    console.log('[Attendance Scheduler] Running auto-absent job...');

    const { todayStartUTC, todayEndUTC } = getISTDayBounds(new Date());

    // Store absent records at exactly 2:00 PM IST
    const absentTimestamp = new Date(todayStartUTC.getTime() + 14 * 60 * 60 * 1000);

    // All students
    const students = await User.find({ role: 'student' }, '_id name').lean();
    if (students.length === 0) {
      console.log('[Attendance Scheduler] No students found.');
      return;
    }

    // All attendance records for the full IST day (fixes the old 14-hour cut-off bug)
    const todayRecords = await Attendance.find(
      { date: { $gte: todayStartUTC, $lt: todayEndUTC } },
      'user'
    ).lean();

    const studentsWithRecord = new Set(todayRecords.map(r => r.user.toString()));

    const absentStudents = students.filter(
      s => !studentsWithRecord.has(s._id.toString())
    );

    if (absentStudents.length === 0) {
      console.log('[Attendance Scheduler] All students already have attendance today.');
      return;
    }

    const absentRecords = absentStudents.map(s => ({
      user:       s._id,
      classGroup: null,
      date:       absentTimestamp,
      status:     'Absent',
    }));

    // ordered:false — one duplicate won't block the rest
    const result = await Attendance.insertMany(absentRecords, { ordered: false });

    console.log(`[Attendance Scheduler] Marked ${result.length} student(s) as Absent:`);
    absentStudents.forEach(s => console.log(`  - ${s.name}`));

  } catch (err) {
    if (err.name === 'MongoBulkWriteError') {
      const inserted = err.result?.nInserted ?? 0;
      const failed   = err.writeErrors?.length ?? 0;
      console.warn(
        `[Attendance Scheduler] BulkWrite: ${inserted} inserted, ${failed} skipped (likely duplicates).`
      );
    } else {
      console.error('[Attendance Scheduler] Error:', err.message, err.stack);
    }
  }
}

export function startAttendanceScheduler() {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('[Attendance Scheduler] Invalid cron schedule:', CRON_SCHEDULE);
    return;
  }

  // Runs at exactly 08:30 UTC (= 2:00 PM IST) Mon–Sat only
  cron.schedule(CRON_SCHEDULE, markAbsentees, { timezone: 'UTC' });

  console.log('[Attendance Scheduler] Started — runs at 2:00 PM IST (Mon–Sat)');
}
