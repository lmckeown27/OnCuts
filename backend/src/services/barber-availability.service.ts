/**
 * Shared barber weekly-schedule and slot validation for availability API and booking writes.
 */

import { DateTime } from 'luxon';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';

export interface TimeInterval {
  id?: string;
  start: string;
  end: string;
}

export interface DayAvailability {
  enabled?: boolean;
  intervals?: TimeInterval[];
  start?: string;
  end?: string;
}

export type WeeklySchedule = Partial<
  Record<'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday', DayAvailability>
>;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export const BOOKING_SLOT_INCREMENT_MINUTES = 15;
export const SAME_DAY_BOOKING_BUFFER_MINUTES = 1;

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getDayNameFromDateString(date: string): (typeof DAY_NAMES)[number] {
  const [year, month, day] = date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day, 12, 0, 0);
  return DAY_NAMES[targetDate.getDay()];
}

export function getIntervalsForDay(
  weeklySchedule: WeeklySchedule,
  dayName: (typeof DAY_NAMES)[number]
): TimeInterval[] {
  const daySchedule = weeklySchedule[dayName];
  if (!daySchedule?.enabled) return [];

  if (daySchedule.intervals && Array.isArray(daySchedule.intervals)) {
    return daySchedule.intervals;
  }
  if (daySchedule.start && daySchedule.end) {
    return [{ id: 'legacy', start: daySchedule.start, end: daySchedule.end }];
  }
  return [];
}

export function slotFitsSchedule(
  startMinutes: number,
  durationMinutes: number,
  intervals: TimeInterval[]
): boolean {
  const endMinutes = startMinutes + durationMinutes;
  return intervals.some((interval) => {
    const intervalStart = timeToMinutes(interval.start);
    const intervalEnd = timeToMinutes(interval.end);
    return startMinutes >= intervalStart && endMinutes <= intervalEnd;
  });
}

export function slotOverlapsRanges(
  startMinutes: number,
  durationMinutes: number,
  ranges: { start: string; end: string }[]
): boolean {
  const endMinutes = startMinutes + durationMinutes;
  return ranges.some((range) => {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);
    return startMinutes < rangeEnd && endMinutes > rangeStart;
  });
}

export function generateBookableStartSlots(
  intervals: TimeInterval[],
  blockedRanges: { start: string; end: string }[],
  appointmentDurationMinutes: number,
  slotIncrementMinutes: number = BOOKING_SLOT_INCREMENT_MINUTES,
  currentTimeMinutes: number = 0
): { time: string; available: boolean }[] {
  const slots: { time: string; available: boolean }[] = [];
  const seen = new Set<string>();

  for (const interval of intervals) {
    const startMins = timeToMinutes(interval.start);
    const endMins = timeToMinutes(interval.end);

    for (let mins = startMins; mins + appointmentDurationMinutes <= endMins; mins += slotIncrementMinutes) {
      if (currentTimeMinutes > 0 && mins < currentTimeMinutes) continue;

      const time = minutesToTime(mins);
      if (seen.has(time)) continue;
      seen.add(time);

      if (!slotOverlapsRanges(mins, appointmentDurationMinutes, blockedRanges)) {
        slots.push({ time, available: true });
      }
    }
  }

  return slots;
}

export async function fetchBookedAndBlockedSlots(
  barberId: string,
  date: string,
  excludeBookingId?: string
): Promise<{ start: string; end: string }[]> {
  const bookingsParams: string[] = [barberId, date];
  let excludeBookingClause = '';
  if (excludeBookingId) {
    excludeBookingClause = ' AND id != $3';
    bookingsParams.push(excludeBookingId);
  }

  const bookingsResult = await pool.query(
    `SELECT
       TO_CHAR("requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH24:MI') as start_time,
       TO_CHAR("requestedAt" AT TIME ZONE 'America/Los_Angeles' + (COALESCE("durationMinutes", 60) * INTERVAL '1 minute'), 'HH24:MI') as end_time
     FROM bookings
     WHERE "barberId" = $1
       AND DATE("requestedAt" AT TIME ZONE 'America/Los_Angeles') = $2
       AND status IN ('ACCEPTED', 'PENDING')${excludeBookingClause}
     ORDER BY "requestedAt"`,
    bookingsParams
  );

  const timeBlocksResult = await pool.query(
    `SELECT
       TO_CHAR(start_time, 'HH24:MI') as start_time,
       TO_CHAR(end_time, 'HH24:MI') as end_time
     FROM barber_time_blocks
     WHERE barber_id = $1
       AND block_date = $2
     ORDER BY start_time`,
    [barberId, date]
  );

  return [
    ...bookingsResult.rows.map((row) => ({ start: row.start_time, end: row.end_time })),
    ...timeBlocksResult.rows.map((row) => ({ start: row.start_time, end: row.end_time })),
  ];
}

export async function assertBookingWithinBarberAvailability(
  barberRecordId: string,
  requestedTimeUtc: Date,
  durationMinutes: number,
  excludeBookingId?: string,
  client: Pick<typeof pool, 'query'> = pool
): Promise<void> {
  const barberResult = await client.query(
    `SELECT b."weeklySchedule" as weekly_schedule,
            COALESCE(c.timezone, 'America/Los_Angeles') as campus_timezone
     FROM barbers b
     LEFT JOIN users u ON b."userId" = u.id
     LEFT JOIN campuses c ON u."campusId" = c.id
     WHERE b.id = $1`,
    [barberRecordId]
  );

  if (barberResult.rows.length === 0) {
    throw new ApiError(404, 'Barber not found');
  }

  const weeklySchedule: WeeklySchedule = barberResult.rows[0].weekly_schedule || {};
  const campusTimezone: string = barberResult.rows[0].campus_timezone || 'America/Los_Angeles';

  const local = DateTime.fromJSDate(requestedTimeUtc, { zone: 'utc' }).setZone(campusTimezone);
  const date = local.toFormat('yyyy-MM-dd');
  const time = local.toFormat('HH:mm');
  const dayName = getDayNameFromDateString(date);
  const intervals = getIntervalsForDay(weeklySchedule, dayName);

  if (intervals.length === 0) {
    throw new ApiError(400, 'The barber is not available on the selected date');
  }

  const startMinutes = timeToMinutes(time);
  if (!slotFitsSchedule(startMinutes, durationMinutes, intervals)) {
    throw new ApiError(400, 'The selected time is outside the barber\'s available hours');
  }

  const blockedRanges = await fetchBookedAndBlockedSlots(barberRecordId, date, excludeBookingId);
  if (slotOverlapsRanges(startMinutes, durationMinutes, blockedRanges)) {
    throw new ApiError(409, 'This time slot is no longer available');
  }
}
