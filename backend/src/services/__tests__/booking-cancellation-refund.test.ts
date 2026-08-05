import {
  CONSUMER_CANCEL_NO_REFUND_WINDOW_MS,
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

  it('refunds consumer cancel more than 1 hour before', () => {
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - CONSUMER_CANCEL_NO_REFUND_WINDOW_MS - 1),
      })
    ).toBe(true);
  });

  it('does not refund consumer cancel within 1 hour', () => {
    expect(
      shouldRefundOnCancellation({
        cancelledBy: 'consumer',
        scheduledTime: appointment,
        now: new Date(appointment.getTime() - CONSUMER_CANCEL_NO_REFUND_WINDOW_MS + 1),
      })
    ).toBe(false);
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
