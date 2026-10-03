import {
  DEFAULT_MAX_ADVANCE_BOOKING_DAYS,
  calendarDateExceedsMaxAdvance,
  filterSlotsWithinMaxAdvance,
  maxAdvanceBookingErrorMessage,
  resolveMaxAdvanceBookingDays,
  scheduledTimeExceedsMaxAdvance,
} from '../barber-availability.service';

const TZ = 'America/Los_Angeles';

describe('max advance booking window', () => {
  const now = new Date('2026-10-03T20:00:00.000Z'); // 13:00 Pacific

  it('treats null, missing, and non-positive values as the 30 day default', () => {
    expect(resolveMaxAdvanceBookingDays(null)).toBe(DEFAULT_MAX_ADVANCE_BOOKING_DAYS);
    expect(resolveMaxAdvanceBookingDays(undefined)).toBe(30);
    expect(resolveMaxAdvanceBookingDays(0)).toBe(30);
    expect(resolveMaxAdvanceBookingDays(-4)).toBe(30);
    expect(resolveMaxAdvanceBookingDays('')).toBe(30);
    expect(resolveMaxAdvanceBookingDays(14)).toBe(14);
    expect(resolveMaxAdvanceBookingDays('7')).toBe(7);
  });

  it('allows a booking at the cutoff and rejects times after it (POST /api/v1/bookings-simple guard)', () => {
    const days = 7;
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    expect(scheduledTimeExceedsMaxAdvance(cutoff, days, now)).toBe(false);
    expect(scheduledTimeExceedsMaxAdvance(new Date(cutoff.getTime() + 1), days, now)).toBe(true);
    expect(scheduledTimeExceedsMaxAdvance(new Date(cutoff.getTime() + 60_000), null, now)).toBe(
      false
    );
    const pastDefault = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(scheduledTimeExceedsMaxAdvance(pastDefault, null, now)).toBe(true);
    expect(maxAdvanceBookingErrorMessage(7)).toBe(
      'This barber only accepts bookings up to 7 days in advance.'
    );
    expect(maxAdvanceBookingErrorMessage(null)).toBe(
      'This barber only accepts bookings up to 30 days in advance.'
    );
  });

  it('returns no availability slots for a date past the cutoff (GET /api/v1/barbers/:id/availability)', () => {
    expect(calendarDateExceedsMaxAdvance('2026-10-11', TZ, 7, now)).toBe(true);
    const slots = filterSlotsWithinMaxAdvance(
      '2026-10-11',
      [
        { time: '09:00', available: true },
        { time: '10:00', available: true },
      ],
      TZ,
      7,
      now
    );
    expect(slots).toEqual([]);
  });

  it('keeps earlier slots on the boundary day and drops slots after the cutoff instant', () => {
    // Cutoff is 2026-10-10T20:00:00Z = 13:00 Pacific.
    const slots = filterSlotsWithinMaxAdvance(
      '2026-10-10',
      [
        { time: '12:00', available: true },
        { time: '13:00', available: true },
        { time: '13:15', available: true },
      ],
      TZ,
      7,
      now
    );
    expect(slots.map((slot) => slot.time)).toEqual(['12:00', '13:00']);
  });
});
