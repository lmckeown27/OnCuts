/**
 * Platform-funded provider kickback.
 * After a successful card payment, Transfer from platform Stripe balance → Connect account.
 * Amount = round(serviceCents * kickbackPercent / 100). Tips are never included.
 */

import type { PoolClient } from 'pg';
import type Stripe from 'stripe';
import { pool } from '../database/connection';
import { getStripeClientForLivemode } from '../config/stripe';
import { logger } from './logger';

export type DbClient = PoolClient | typeof pool;

export function calculateKickbackCents(
  serviceAmountCents: number,
  kickbackPercent: number
): number {
  const amount = Math.max(0, Math.round(serviceAmountCents));
  const percent = Math.max(0, Math.min(100, Number(kickbackPercent) || 0));
  if (amount <= 0 || percent <= 0) return 0;
  return Math.round((amount * percent) / 100);
}

export async function loadProviderKickbackPercent(
  client: DbClient,
  barberRecordId: string
): Promise<number> {
  const result = await client.query(
    `SELECT kickback_percent FROM barbers WHERE id = $1::uuid`,
    [barberRecordId]
  );
  const raw = result.rows[0]?.kickback_percent;
  const percent = raw != null ? parseFloat(String(raw)) : 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, Math.max(0, percent));
}

/**
 * Idempotent platform → provider Transfer for kickback.
 * Safe to call from payment webhooks (destination-charge or manual Transfer flows).
 */
export async function processProviderKickback(opts: {
  client: DbClient;
  bookingId: string;
  barberRecordId: string;
  serviceAmountCents: number;
  connectedAccountId: string | null | undefined;
  paymentIntentId: string;
  livemode: boolean;
}): Promise<{ transferred: boolean; kickbackCents: number; transferId?: string }> {
  const {
    client,
    bookingId,
    barberRecordId,
    serviceAmountCents,
    connectedAccountId,
    paymentIntentId,
    livemode,
  } = opts;

  // Already transferred?
  const existing = await client.query(
    `SELECT kickback_status, kickback_transfer_id, kickback_cents, kickback_percent
     FROM bookings WHERE id = $1::uuid FOR UPDATE`,
    [bookingId]
  );
  const row = existing.rows[0];
  if (!row) {
    logger.warn('Kickback skipped: booking not found', { bookingId });
    return { transferred: false, kickbackCents: 0 };
  }
  if (row.kickback_status === 'transferred' && row.kickback_transfer_id) {
    return {
      transferred: true,
      kickbackCents: parseInt(String(row.kickback_cents ?? '0'), 10) || 0,
      transferId: String(row.kickback_transfer_id),
    };
  }

  const percent = await loadProviderKickbackPercent(client, barberRecordId);
  const kickbackCents = calculateKickbackCents(serviceAmountCents, percent);

  if (kickbackCents <= 0) {
    await client.query(
      `UPDATE bookings
       SET kickback_percent = $1,
           kickback_cents = 0,
           kickback_status = 'none',
           kickback_error = NULL,
           "updatedAt" = NOW()
       WHERE id = $2::uuid`,
      [percent, bookingId]
    );
    return { transferred: false, kickbackCents: 0 };
  }

  if (!connectedAccountId) {
    await client.query(
      `UPDATE bookings
       SET kickback_percent = $1,
           kickback_cents = $2,
           kickback_status = 'failed',
           kickback_error = $3,
           "updatedAt" = NOW()
       WHERE id = $4::uuid`,
      [percent, kickbackCents, 'Provider has no Stripe Connect account', bookingId]
    );
    logger.warn('Kickback failed: no Connect account', { bookingId, kickbackCents });
    return { transferred: false, kickbackCents };
  }

  await client.query(
    `UPDATE bookings
     SET kickback_percent = $1,
         kickback_cents = $2,
         kickback_status = 'pending',
         kickback_error = NULL,
         "updatedAt" = NOW()
     WHERE id = $3::uuid`,
    [percent, kickbackCents, bookingId]
  );

  try {
    const stripe = getStripeClientForLivemode(livemode);
    const transfer: Stripe.Transfer = await stripe.transfers.create(
      {
        amount: kickbackCents,
        currency: 'usd',
        destination: connectedAccountId,
        transfer_group: `booking_${bookingId}`,
        metadata: {
          type: 'provider_kickback',
          booking_id: bookingId,
          barber_id: barberRecordId,
          payment_intent_id: paymentIntentId,
          service_amount_cents: String(Math.max(0, Math.round(serviceAmountCents))),
          kickback_percent: String(percent),
          kickback_cents: String(kickbackCents),
        },
      },
      {
        // Idempotency: one kickback Transfer per booking
        idempotencyKey: `kickback_${bookingId}`,
      }
    );

    await client.query(
      `UPDATE bookings
       SET kickback_transfer_id = $1,
           kickback_status = 'transferred',
           kickback_transferred_at = NOW(),
           kickback_error = NULL,
           "updatedAt" = NOW()
       WHERE id = $2::uuid`,
      [transfer.id, bookingId]
    );

    logger.info('Provider kickback transferred', {
      bookingId,
      transferId: transfer.id,
      kickbackCents,
      percent,
      destination: connectedAccountId,
    });

    return { transferred: true, kickbackCents, transferId: transfer.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await client.query(
      `UPDATE bookings
       SET kickback_status = 'failed',
           kickback_error = $1,
           "updatedAt" = NOW()
       WHERE id = $2::uuid`,
      [message.slice(0, 500), bookingId]
    );
    logger.error('Provider kickback transfer failed', {
      bookingId,
      kickbackCents,
      percent,
      error: message,
    });
    return { transferred: false, kickbackCents };
  }
}
