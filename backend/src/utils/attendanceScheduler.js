/**
 * Attendance Scheduler
 *
 * Runs every day at 2:00 PM IST (08:30 UTC) Monday–Saturday.
 * Marks all students who have NOT marked attendance that day as Absent.
 *
 * Also runs a catch-up check on server startup — if the server restarted
 * after 08:30 UTC on a weekday and the job was missed, it runs immediately.
 */

import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import { User } from '../models/User.js';

// IST = UTC+5:30  →  2:00 PM IST = 08:30 UTC
const CRON_SCHEDULE = '30 8 * * 1-6';

/**
 * Returns the IST date boundaries for a given UTC Date.
 * todayStart = midnight IST in UTC
 * todayEnd   = end of day IST in UTC (exclusive, i.e. next midnight)
 */
function getISTDayBounds(utcNow) {
  const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30

  // Current time expressed as IST
  const nowIST = new Date(utcNow.getTime() + IST_OFFSET_MS);

  // Midnight of today in IST (zero out h/m/s/ms)
  const midnightIST = new Date(nowIST);
  midnightIST.setHours(0, 0, 0, 0);

  // Convert back to UTC
  const todayStartUTC = new Date(midnightIST.getTime() - IST_OFFSET_MS);
  const todayEndUTC   = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000); // +24 h

  return { todayStartUTC, todayEndUTC };
}

export async function markAbsentees() {
  try {
    console.log('[Attendance Scheduler] Running auto-absent job...');

    const { todayStartUTC, todayEndUTC } = getISTDayBounds(new Date());

    // Timestamp to store on the absent record (2:00 PM IST)
    const absentTimestamp = new Date(todayStartUTC.getTime() + 14 * 60 * 60 * 1000);

    // All students
    const students = await User.find({ role: 'student' }, '_id name').lean();
    if (students.length === 0) {
      console.log('[Attendance Scheduler] No students found.');
      return;
    }

    // All attendance records for today (full day window — fixes the cut-off bug)
    const todayRecords = await Attendance.find(
      { date: { $gte: todayStartUTC, $lt: todayEndUTC } },
      'user'
    ).lean();

    const studentsWithRecord = new Set(todayRecords.map(r => r.user.toString()));

    // Students with no record at all today
    const absentStudents = students.filter(
      s => !studentsWithRecord.has(s._id.toString())
    );

    if (absentStudents.length === 0) {
      console.log('[Attendance Scheduler] All students already have attendance today.');
      return;
    }

    // Bulk insert — use ordered:false so one duplicate doesn't block the rest
    const absentRecords = absentStudents.map(s => ({
      user:       s._id,
      classGroup: null,
      date:       absentTimestamp,
      status:     'Absent',
    }));

    const result = await Attendance.insertMany(absentRecords, { ordered: false });

    console.log(`[Attendance Scheduler] Marked ${result.length} student(s) as Absent:`);
    absentStudents.forEach(s => console.log(`  - ${s.name}`));

  } catch (err) {
    // insertMany with ordered:false throws a BulkWriteError but still inserts
    // the non-duplicate documents — log the details but don't crash
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

/**
 * On server startup, check if today is a weekday and it's already past
 * 2:00 PM IST (08:30 UTC). If so, run the job immediately in case the
 * server restarted after the scheduled time and missed it.
 */
function runCatchUpIfNeeded() {
  const now     = new Date();
  const dayUTC  = now.getUTCDay();   // 0 = Sun, 6 = Sat
  const hourUTC = now.getUTCHours();
  const minUTC  = now.getUTCMinutes();

  const isWeekday      = dayUTC >= 1 && dayUTC <= 6;
  const isPast2PMIST   = hourUTC > 8 || (hourUTC === 8 && minUTC >= 30);

  if (!isWeekday || !isPast2PMIST) return;

  console.log('[Attendance Scheduler] Server started after 2 PM IST — running catch-up job...');
  markAbsentees();
}

export function startAttendanceScheduler() {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('[Attendance Scheduler] Invalid cron schedule:', CRON_SCHEDULE);
    return;
  }

  cron.schedule(CRON_SCHEDULE, markAbsentees, { timezone: 'UTC' });
  console.log('[Attendance Scheduler] Started — runs at 2:00 PM IST (Mon–Sat)');

  // Catch-up: fire immediately if server restarted after scheduled time today
  runCatchUpIfNeeded();
}
