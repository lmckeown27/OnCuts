/**
 * Platform-funded provider kickback.
 * After a successful card payment on a commissionless booking, Transfer from
 * platform Stripe balance → Connect account.
 * Amount = round(serviceCents * kickbackPercent / 100). Tips are never included.
 * Kickback is never applied to bookings that paid the normal platform commission.
 */

import type { PoolClient } from 'pg';
import type Stripe from 'stripe';
import { pool } from '../database/connection';
import { getStripeClientForLivemode } from '../config/stripe';
import { logger } from './logger';
import {
  isCommissionFreeEligible,
  parseCommissionIncentiveMode,
  parseIncentiveExpiresAt,
} from './platform-commission';

export type DbClient = PoolClient | typeof pool;

const KICKBACK_CACHE_TTL_MS = 45_000;
let cachedPlatformKickbackPercent: number | null = null;
let cachedPlatformKickbackExpiresAt = 0;

export function clampKickbackPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

export function invalidatePlatformKickbackCache(): void {
  cachedPlatformKickbackPercent = null;
  cachedPlatformKickbackExpiresAt = 0;
}

export function calculateKickbackCents(
  serviceAmountCents: number,
  kickbackPercent: number
): number {
  const amount = Math.max(0, Math.round(serviceAmountCents));
  const percent = Math.max(0, Math.min(100, Number(kickbackPercent) || 0));
  if (amount <= 0 || percent <= 0) return 0;
  return Math.round((amount * percent) / 100);
}

/** Admin-configured global kickback % (0–100). 0 = disabled. */
export async function getConfiguredKickbackPercent(client: DbClient = pool): Promise<number> {
  const now = Date.now();
  if (cachedPlatformKickbackPercent !== null && now < cachedPlatformKickbackExpiresAt) {
    return cachedPlatformKickbackPercent;
  }

  try {
    const result = await client.query(
      `SELECT kickback_percent FROM platform_settings WHERE id = 1 LIMIT 1`
    );
    const raw = result.rows[0]?.kickback_percent;
    const percent = raw != null ? clampKickbackPercent(parseFloat(String(raw))) : 0;
    cachedPlatformKickbackPercent = percent;
    cachedPlatformKickbackExpiresAt = now + KICKBACK_CACHE_TTL_MS;
    return percent;
  } catch (err) {
    logger.warn('platform_settings kickback lookup failed; using 0', {
      error: err instanceof Error ? err.message : String(err),
    });
    cachedPlatformKickbackPercent = 0;
    cachedPlatformKickbackExpiresAt = now + KICKBACK_CACHE_TTL_MS;
    return 0;
  }
}

/**
 * Persist global kickback % and apply it to every operator so Onboarding
 * and payment resolution stay in sync. Per-operator edits after this still win.
 */
export async function setPlatformKickbackPercent(
  percent: number,
  updatedBy?: string | null,
  client: DbClient = pool,
  applyToAllOperators = true
): Promise<number> {
  const next = clampKickbackPercent(percent);
  await client.query(
    `INSERT INTO platform_settings (id, platform_fee_percent, kickback_percent, updated_at, updated_by)
     VALUES (
       1,
       COALESCE((SELECT platform_fee_percent FROM platform_settings WHERE id = 1), 15),
       $1,
       NOW(),
       $2
     )
     ON CONFLICT (id) DO UPDATE SET
       kickback_percent = EXCLUDED.kickback_percent,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [next, updatedBy ?? null]
  );
  invalidatePlatformKickbackCache();
  cachedPlatformKickbackPercent = next;
  cachedPlatformKickbackExpiresAt = Date.now() + KICKBACK_CACHE_TTL_MS;

  if (applyToAllOperators) {
    try {
      await client.query(
        `UPDATE barbers SET kickback_percent = $1, "updatedAt" = NOW()`,
        [next]
      );
    } catch (err) {
      logger.warn('Failed to apply platform kickback to all operators', {
        error: err instanceof Error ? err.message : String(err),
        kickbackPercent: next,
      });
    }
  }

  return next;
}

export async function loadProviderKickbackPercent(
  client: DbClient,
  barberRecordId: string
): Promise<number> {
  const result = await client.query(
    `SELECT kickback_percent,
            commission_free_bookings_remaining,
            commission_incentive_mode,
            commission_incentive_expires_at
     FROM barbers WHERE id = $1::uuid`,
    [barberRecordId]
  );
  const row = result.rows[0];
  if (!row) return 0;

  // Timeframe expired → kickback off even if percent is still stored.
  const incentiveMode = parseCommissionIncentiveMode(row.commission_incentive_mode);
  if (incentiveMode === 'timeframe') {
    const eligible = isCommissionFreeEligible({
      incentiveMode,
      incentiveExpiresAt: parseIncentiveExpiresAt(row.commission_incentive_expires_at),
      commissionFreeBookingsRemaining:
        Math.max(0, parseInt(String(row.commission_free_bookings_remaining ?? '0'), 10) || 0),
    });
    if (!eligible) return 0;
  }

  const raw = row.kickback_percent;
  const percent = raw != null ? parseFloat(String(raw)) : 0;
  if (Number.isFinite(percent) && percent > 0) {
    return Math.min(100, Math.max(0, percent));
  }

  // New operators default to 0 — inherit the Controls → Price rate.
  return getConfiguredKickbackPercent(client);
}

/**
 * Idempotent platform → provider Transfer for kickback.
 * Only runs when the booking was commissionless (`commission_free_applied`).
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
    `SELECT kickback_status, kickback_transfer_id, kickback_cents, kickback_percent,
            commission_free_applied
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

  // Kickback only stacks on commissionless bookings — not on full-commission payments.
  if (row.commission_free_applied !== true) {
    await client.query(
      `UPDATE bookings
       SET kickback_percent = 0,
           kickback_cents = 0,
           kickback_status = 'none',
           kickback_error = NULL,
           "updatedAt" = NOW()
       WHERE id = $1::uuid`,
      [bookingId]
    );
    logger.info('Kickback skipped: booking was not commissionless', { bookingId });
    return { transferred: false, kickbackCents: 0 };
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
          commission_free: 'true',
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
