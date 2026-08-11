import {
  CLIENT_CANCEL_REFUND_HOUR_PRESETS,
  DEFAULT_CLIENT_CANCEL_REFUND_HOURS,
  resolveClientCancelRefundHours,
  resolveClientCancelRefundWindowMs,
  shouldRefundOnCancellation,
} from '../booking-cancellation.service';

describe('shouldRefundOnCancellation', () => {
  const appointment = new Date('2026-08-05T18:00:00.000Z');

  it('always refunds when operator cancels', () => {
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'barber',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - 5 * 60 * 1000),
      })
    ).toBe(true);
  });

  it('always refunds when admin cancels', () => {
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'admin',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - 30 * 1000),
      })
    ).toBe(true);
  });

  it('refunds consumer cancel more than 1 hour before (default)', () => {
    const windowMs = resolveClientCancelRefundWindowMs(DEFAULT_CLIENT_CANCEL_REFUND_HOURS);
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - windowMs - 1),
      })
    ).toBe(true);
  });

  it('does not refund consumer cancel within 1 hour (default)', () => {
    const windowMs = resolveClientCancelRefundWindowMs(DEFAULT_CLIENT_CANCEL_REFUND_HOURS);
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - windowMs + 1),
      })
    ).toBe(false);
  });

  it('uses operator-configured 4 hour window', () => {
    const windowMs = resolveClientCancelRefundWindowMs(4);
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        refundHours: 4,
        now: new Date(appointment.getTime() - windowMs - 1),
      })
    ).toBe(true);
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        refundHours: 4,
        now: new Date(appointment.getTime() - windowMs + 1),
      })
    ).toBe(false);
  });

  it('falls back to 1 hour for invalid refundHours', () => {
    expect(resolveClientCancelRefundHours(99)).toBe(DEFAULT_CLIENT_CANCEL_REFUND_HOURS);
    expect(CLIENT_CANCEL_REFUND_HOUR_PRESETS).toEqual([1, 2, 4, 6, 12, 24]);
  });

  it('does not refund consumer cancel after appointment start', () => {
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() + 60 * 1000),
      })
    ).toBe(false);
  });
});
