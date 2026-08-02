/**
 * Shared helpers for pay-on-accept + tip-on-complete booking lifecycle.
 */

import { logger } from '../utils/logger';
import { getFrontendBaseUrl } from '../config/app-url';
import notificationService from './notification.service';
import pushNotificationService from './pushNotification.service';
import { getSocketIO } from '../index';

/** Unpaid ACCEPTED bookings auto-cancel after this many minutes (24 hours). */
export const UNPAID_ACCEPTED_CANCEL_AFTER_MINUTES = 24 * 60;

export function bookingPaymentUrl(bookingId: string): string {
  return `${getFrontendBaseUrl()}/web/payment/${bookingId}`;
}

/** After accept: nudge consumer to pay service now. */
export async function notifyConsumerPayAfterAccept(opts: {
  bookingId: string;
  consumerId: string;
  barberName: string;
  priceUsdCents?: number | null;
}): Promise<void> {
  const { bookingId, consumerId, barberName, priceUsdCents } = opts;
  const paymentUrl = bookingPaymentUrl(bookingId);
  const priceLabel =
    typeof priceUsdCents === 'number'
      ? ` of $${(priceUsdCents / 100).toFixed(2)}`
      : '';
  const title = 'Pay to confirm your booking';
  const message = `${barberName} accepted your booking. Please pay for the service${priceLabel} to confirm.`;

  try {
    await notificationService.saveNotification({
      userId: consumerId,
      type: 'payment_request',
      title,
      message,
      data: { bookingId, paymentUrl, phase: 'service' },
    });
    await pushNotificationService.sendMirrorPush(
      consumerId,
      title,
      message,
      'payment_request',
      { bookingId, paymentUrl, phase: 'service' }
    );
  } catch (err: any) {
    logger.warn(`Failed pay-after-accept notify for ${bookingId}: ${err?.message || err}`);
  }

  try {
    const io = getSocketIO();
    if (io) {
      io.to(`user-${consumerId}`).emit('booking-payment-required', {
        bookingId,
        status: 'ACCEPTED',
        paymentUrl,
        phase: 'service',
        barberName,
        priceUsdCents: priceUsdCents ?? null,
      });
    }
  } catch {
    /* non-fatal */
  }
}

/** After complete: nudge consumer to decide tip (including $0). */
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
  const message = `${barberName} completed your ${serviceName}. Please choose a tip (including $0).`;

  try {
    await notificationService.saveNotification({
      userId: consumerId,
      type: 'payment_request',
      title,
      message,
      data: { bookingId, paymentUrl, phase: 'tip' },
    });
    await pushNotificationService.sendMirrorPush(
      consumerId,
      title,
      message,
      'payment_request',
      { bookingId, paymentUrl, phase: 'tip' }
    );
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
