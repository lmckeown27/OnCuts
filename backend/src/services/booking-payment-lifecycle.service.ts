/**
 * Shared helpers for pay-on-accept + tip-on-complete booking lifecycle.
 */

import { logger } from '../utils/logger';
import { getFrontendBaseUrl } from '../config/app-url';
import { sendTemplatedNotification } from './notification-template.service';
import { getSocketIO } from '../index';

/** Unpaid ACCEPTED bookings auto-cancel after this many minutes (24 hours). */
export const UNPAID_ACCEPTED_CANCEL_AFTER_MINUTES = 24 * 60;

export function bookingPaymentUrl(bookingId: string): string {
  return `${getFrontendBaseUrl()}/web/payment/${bookingId}`;
}

/** After complete (legacy timing): nudge consumer to pay for the service. */
export async function notifyConsumerPayAfterComplete(opts: {
  bookingId: string;
  consumerId: string;
  barberName: string;
  serviceName: string;
  priceUsdCents?: number | null;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string | null;
}): Promise<void> {
  const { bookingId, consumerId, barberName, serviceName } = opts;
  const paymentUrl = bookingPaymentUrl(bookingId);
  const priceFormatted =
    typeof opts.priceUsdCents === 'number'
      ? `$${(opts.priceUsdCents / 100).toFixed(2)}`
      : undefined;
  const title = 'Payment Request';
  const message = priceFormatted
    ? `${barberName} completed your ${serviceName}. Please complete payment of ${priceFormatted}.`
    : `${barberName} completed your ${serviceName}. Please complete payment.`;

  try {
    await sendTemplatedNotification({
      userId: consumerId,
      key: 'payment_request',
      side: 'consumer',
      vars: { barberName, service: serviceName },
      type: 'payment_request',
      data: { bookingId, paymentUrl, phase: 'service' },
      fallbackTitle: title,
      fallbackBody: message,
    });
  } catch (err: any) {
    logger.warn(`Failed pay-after-complete notify for ${bookingId}: ${err?.message || err}`);
  }

  try {
    const io = getSocketIO();
    if (io) {
      io.to(`user-${consumerId}`).emit('booking-completed', {
        bookingId,
        status: 'COMPLETED',
        barberName,
        serviceName,
        price: opts.priceUsdCents ?? undefined,
        priceFormatted,
        paymentUrl,
        phase: 'service',
        scheduledDate: opts.scheduledDate,
        scheduledTime: opts.scheduledTime,
        location: opts.location ?? undefined,
      });
    }
  } catch {
    /* non-fatal */
  }
}

/** After complete (pay-on-accept): nudge consumer to decide tip. */
export async function notifyConsumerTipAfterComplete(opts: {
  bookingId: string;
  consumerId: string;
  barberName: string;
  serviceName: string;
  priceUsdCents?: number | null;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string | null;
}): Promise<void> {
  const { bookingId, consumerId, barberName, serviceName } = opts;
  const paymentUrl = bookingPaymentUrl(bookingId);
  const title = 'Add a tip';
  const message = `${barberName} completed your ${serviceName}. Consider leaving a tip.`;

  try {
    await sendTemplatedNotification({
      userId: consumerId,
      key: 'payment_request',
      side: 'consumer',
      vars: { barberName, service: serviceName },
      type: 'payment_request',
      data: { bookingId, paymentUrl, phase: 'tip' },
      fallbackTitle: title,
      fallbackBody: message,
    });
  } catch (err: any) {
    logger.warn(`Failed tip-after-complete notify for ${bookingId}: ${err?.message || err}`);
  }

  try {
    const io = getSocketIO();
    if (io) {
      io.to(`user-${consumerId}`).emit('booking-completed', {
        bookingId,
        status: 'COMPLETED',
        barberName,
        serviceName,
        price: opts.priceUsdCents ?? undefined,
        priceFormatted:
          typeof opts.priceUsdCents === 'number'
            ? `$${(opts.priceUsdCents / 100).toFixed(2)}`
            : undefined,
        paymentUrl,
        phase: 'tip',
        scheduledDate: opts.scheduledDate,
        scheduledTime: opts.scheduledTime,
        location: opts.location ?? undefined,
      });
    }
  } catch {
    /* non-fatal */
  }
}
