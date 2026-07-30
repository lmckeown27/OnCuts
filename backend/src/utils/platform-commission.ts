/**
 * Platform commission helpers for Stripe Connect destination charges.
 * Fee applies to service amount only (never tips).
 * Rate is stored in platform_settings (Admin-editable); defaults to 15% if missing.
 */

import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../database/connection';
import { logger } from './logger';

/** Fallback when platform_settings row is missing. */
export const DEFAULT_PLATFORM_FEE_RATE = 0.15;
export const DEFAULT_PLATFORM_FEE_PERCENT = 15;
/** Default commission-free card bookings granted to every new provider. */
export const DEFAULT_COMMISSION_FREE_BOOKINGS = 5;

const FEE_CACHE_TTL_MS = 45_000;

let cachedFeePercent: number | null = null;
let cachedFeePercentExpiresAt = 0;

export type DbClient = PoolClient | typeof pool;

export interface ProviderCommissionSettings {
  commissionFreeBookingsRemaining: number;
  /** Effective rate 0–1 used when not commission-free (from platform_settings). */
  effectiveFeeRate: number;
}

export interface PlatformFeeSplit {
  platformFeeCents: number;
  barberEarningsCents: number;
  feeRate: number;
  commissionFree: boolean;
  feePercentDisplay: number;
}

function clampFeePercent(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_PLATFORM_FEE_PERCENT;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

export function invalidatePlatformFeeCache(): void {
  cachedFeePercent = null;
  cachedFeePercentExpiresAt = 0;
}

/**
 * Global platform commission percent (0–100) from platform_settings.
 */
export async function getPlatformFeePercent(client: DbClient = pool): Promise<number> {
  const now = Date.now();
  if (cachedFeePercent !== null && now < cachedFeePercentExpiresAt) {
    return cachedFeePercent;
  }

  try {
    const result = await client.query(
      `SELECT platform_fee_percent FROM platform_settings WHERE id = 1 LIMIT 1`
    );
    if (result.rows.length > 0 && result.rows[0].platform_fee_percent != null) {
      const percent = clampFeePercent(parseFloat(String(result.rows[0].platform_fee_percent)));
      cachedFeePercent = percent;
      cachedFeePercentExpiresAt = now + FEE_CACHE_TTL_MS;
      return percent;
    }
  } catch (err) {
    logger.warn('platform_settings lookup failed; using default commission percent', {
      error: err instanceof Error ? err.message : String(err),
      fallbackPercent: DEFAULT_PLATFORM_FEE_PERCENT,
    });
  }

  cachedFeePercent = DEFAULT_PLATFORM_FEE_PERCENT;
  cachedFeePercentExpiresAt = now + FEE_CACHE_TTL_MS;
  return DEFAULT_PLATFORM_FEE_PERCENT;
}

/** Global platform commission rate 0–1. */
export async function getPlatformFeeRate(client: DbClient = pool): Promise<number> {
  return (await getPlatformFeePercent(client)) / 100;
}

/**
 * Persist Admin-set global commission percent and refresh cache.
 */
export async function setPlatformFeePercent(
  percent: number,
  updatedBy?: string | null,
  client: DbClient = pool
): Promise<number> {
  const next = clampFeePercent(percent);
  await client.query(
    `INSERT INTO platform_settings (id, platform_fee_percent, updated_at, updated_by)
     VALUES (1, $1, NOW(), $2)
     ON CONFLICT (id) DO UPDATE SET
       platform_fee_percent = EXCLUDED.platform_fee_percent,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [next, updatedBy ?? null]
  );
  cachedFeePercent = next;
  cachedFeePercentExpiresAt = Date.now() + FEE_CACHE_TTL_MS;
  return next;
}

export function calculatePlatformFeeSplit(
  serviceAmountCents: number,
  opts?: { forceCommissionFree?: boolean; feePercent?: number }
): PlatformFeeSplit {
  const amount = Math.max(0, Math.round(serviceAmountCents));
  const waived = opts?.forceCommissionFree === true;
  const feePercent = clampFeePercent(
    opts?.feePercent != null ? opts.feePercent : DEFAULT_PLATFORM_FEE_PERCENT
  );
  const feeRate = waived ? 0 : feePercent / 100;
  const platformFeeCents = waived ? 0 : Math.round(amount * feeRate);
  const barberEarningsCents = amount - platformFeeCents;

  return {
    platformFeeCents,
    barberEarningsCents,
    feeRate,
    commissionFree: waived,
    feePercentDisplay: waived ? 0 : feePercent,
  };
}

/** Estimate fee at booking create (does not reserve a free slot). */
export function estimatePlatformFeeSplit(
  serviceAmountCents: number,
  settings: ProviderCommissionSettings
): PlatformFeeSplit {
  if (settings.commissionFreeBookingsRemaining > 0) {
    return calculatePlatformFeeSplit(serviceAmountCents, { forceCommissionFree: true });
  }
  return calculatePlatformFeeSplit(serviceAmountCents, {
    forceCommissionFree: false,
    feePercent: settings.effectiveFeeRate * 100,
  });
}

async function mapSettingsRow(row: QueryResultRow | undefined): Promise<ProviderCommissionSettings> {
  const remaining = Math.max(0, parseInt(String(row?.commission_free_bookings_remaining ?? '0'), 10) || 0);
  const effectiveFeeRate = await getPlatformFeeRate();
  return {
    commissionFreeBookingsRemaining: remaining,
    effectiveFeeRate,
  };
}

export async function loadProviderCommissionSettings(
  client: DbClient,
  barberRecordId: string
): Promise<ProviderCommissionSettings> {
  const result = await client.query(
    `SELECT commission_free_bookings_remaining
     FROM barbers
     WHERE id = $1::uuid`,
    [barberRecordId]
  );
  return mapSettingsRow(result.rows[0]);
}

export async function loadProviderCommissionSettingsByUserId(
  client: DbClient,
  barberUserId: string
): Promise<{ settings: ProviderCommissionSettings; barberRecordId: string | null }> {
  const result = await client.query(
    `SELECT id, commission_free_bookings_remaining
     FROM barbers
     WHERE "userId" = $1::uuid`,
    [barberUserId]
  );
  if (result.rows.length === 0) {
    return {
      settings: {
        commissionFreeBookingsRemaining: 0,
        effectiveFeeRate: await getPlatformFeeRate(client),
      },
      barberRecordId: null,
    };
  }
  return {
    settings: await mapSettingsRow(result.rows[0]),
    barberRecordId: String(result.rows[0].id),
  };
}

/**
 * Atomically consume one commission-free slot.
 * Returns true if a slot was reserved.
 */
export async function reserveCommissionFreeBooking(
  client: DbClient,
  barberRecordId: string
): Promise<boolean> {
  const result = await client.query(
    `UPDATE barbers
     SET commission_free_bookings_remaining = commission_free_bookings_remaining - 1,
         "updatedAt" = NOW()
     WHERE id = $1::uuid
       AND commission_free_bookings_remaining > 0
     RETURNING commission_free_bookings_remaining`,
    [barberRecordId]
  );
  const reserved = (result.rowCount ?? 0) > 0;
  if (reserved) {
    logger.info('Reserved commission-free booking slot', {
      barberRecordId,
      remaining: result.rows[0]?.commission_free_bookings_remaining,
    });
  }
  return reserved;
}

/** Restore a previously reserved free slot (e.g. payment failed / intent abandoned). */
export async function releaseCommissionFreeBooking(
  client: DbClient,
  barberRecordId: string
): Promise<void> {
  await client.query(
    `UPDATE barbers
     SET commission_free_bookings_remaining = commission_free_bookings_remaining + 1,
         "updatedAt" = NOW()
     WHERE id = $1::uuid`,
    [barberRecordId]
  );
  logger.info('Released commission-free booking slot', { barberRecordId });
}

/**
 * Resolve fee for a booking at payment-intent time.
 * Reserves a free slot once per booking (idempotent via commission_free_applied).
 */
export async function resolveBookingPlatformFee(
  client: DbClient,
  opts: {
    bookingId: string;
    barberRecordId: string;
    serviceAmountCents: number;
    alreadyCommissionFreeApplied?: boolean;
  }
): Promise<PlatformFeeSplit & { reservedNow: boolean }> {
  const feePercent = await getPlatformFeePercent(client);

  if (opts.alreadyCommissionFreeApplied) {
    return {
      ...calculatePlatformFeeSplit(opts.serviceAmountCents, { forceCommissionFree: true }),
      reservedNow: false,
    };
  }

  const reservedNow = await reserveCommissionFreeBooking(client, opts.barberRecordId);
  if (reservedNow) {
    await client.query(
      `UPDATE bookings
       SET commission_free_applied = true,
           "platformFeeUsdCents" = 0,
           "barberEarningsUsdCents" = $1,
           "updatedAt" = NOW()
       WHERE id = $2::uuid`,
      [opts.serviceAmountCents, opts.bookingId]
    );
    return {
      ...calculatePlatformFeeSplit(opts.serviceAmountCents, { forceCommissionFree: true }),
      reservedNow: true,
    };
  }

  const split = calculatePlatformFeeSplit(opts.serviceAmountCents, {
    forceCommissionFree: false,
    feePercent,
  });
  await client.query(
    `UPDATE bookings
     SET "platformFeeUsdCents" = $1,
         "barberEarningsUsdCents" = $2,
         "updatedAt" = NOW()
     WHERE id = $3::uuid`,
    [split.platformFeeCents, split.barberEarningsCents, opts.bookingId]
  );
  return { ...split, reservedNow: false };
}
