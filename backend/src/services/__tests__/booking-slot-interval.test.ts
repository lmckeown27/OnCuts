import {
  DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES,
  BOOKING_SLOT_INTERVAL_PRESETS,
  resolveBookingSlotIntervalMinutes,
  slotAlignsToInterval,
} from '../barber-availability.service';

describe('booking slot interval', () => {
  it('resolves presets and falls back to 15', () => {
    expect(resolveBookingSlotIntervalMinutes(15)).toBe(15);
    expect(resolveBookingSlotIntervalMinutes(30)).toBe(30);
    expect(resolveBookingSlotIntervalMinutes(45)).toBe(45);
    expect(resolveBookingSlotIntervalMinutes(20)).toBe(DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES);
    expect(resolveBookingSlotIntervalMinutes(undefined)).toBe(DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES);
    expect(BOOKING_SLOT_INTERVAL_PRESETS).toEqual([15, 30, 45]);
  });

  it('checks start times against interval alignment', () => {
    const intervals = [{ start: '09:00', end: '12:00' }];
    expect(slotAlignsToInterval(9 * 60, intervals, 30)).toBe(true);
    expect(slotAlignsToInterval(9 * 60 + 30, intervals, 30)).toBe(true);
    expect(slotAlignsToInterval(9 * 60 + 15, intervals, 30)).toBe(false);
    expect(slotAlignsToInterval(9 * 60 + 45, intervals, 45)).toBe(true);
  });
});
