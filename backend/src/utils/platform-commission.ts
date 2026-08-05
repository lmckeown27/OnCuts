/**
 * Platform commission helpers for Stripe Connect destination charges.
 * Fee applies to service amount only (never tips).
 * Rate is stored in platform_settings (Admin-editable); defaults to 15% if missing.
 *
 * Commissionless eligibility:
 * - count mode: commission_free_bookings_remaining > 0 (decremented per booking)
 * - timeframe mode: now < commission_incentive_expires_at (unlimited until expiry)
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

export type CommissionIncentiveMode = 'count' | 'timeframe';
export type CommissionIncentiveDurationUnit = 'days' | 'weeks' | 'months';

export interface ProviderCommissionSettings {
  commissionFreeBookingsRemaining: number;
  /** Effective rate 0–1 used when not commission-free (from platform_settings). */
  effectiveFeeRate: number;
  incentiveMode: CommissionIncentiveMode;
  incentiveExpiresAt: Date | null;
  /** True if provider currently gets commission-free (count remaining or active window). */
  commissionFreeEligible: boolean;
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

export function parseCommissionIncentiveMode(raw: unknown): CommissionIncentiveMode {
  return String(raw ?? '').toLowerCase() === 'timeframe' ? 'timeframe' : 'count';
}

export function parseIncentiveExpiresAt(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whether commissionless (and thus kickback eligibility) is active right now. */
export function isCommissionFreeEligible(
  settings: Pick<
    ProviderCommissionSettings,
    'incentiveMode' | 'incentiveExpiresAt' | 'commissionFreeBookingsRemaining'
  >,
  now: Date = new Date()
): boolean {
  if (settings.incentiveMode === 'timeframe') {
    return (
      settings.incentiveExpiresAt != null && settings.incentiveExpiresAt.getTime() > now.getTime()
    );
  }
  return settings.commissionFreeBookingsRemaining > 0;
}

export function computeIncentiveExpiresAt(
  durationValue: number,
  durationUnit: CommissionIncentiveDurationUnit,
  from: Date = new Date()
): Date {
  const d = new Date(from.getTime());
  if (durationUnit === 'days') {
    d.setUTCDate(d.getUTCDate() + durationValue);
  } else if (durationUnit === 'weeks') {
    d.setUTCDate(d.getUTCDate() + durationValue * 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() + durationValue);
  }
  return d;
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
  if (settings.commissionFreeEligible) {
    return calculatePlatformFeeSplit(serviceAmountCents, { forceCommissionFree: true });
  }
  return calculatePlatformFeeSplit(serviceAmountCents, {
    forceCommissionFree: false,
    feePercent: settings.effectiveFeeRate * 100,
  });
}

async function mapSettingsRow(row: QueryResultRow | undefined): Promise<ProviderCommissionSettings> {
  const remaining = Math.max(0, parseInt(String(row?.commission_free_bookings_remaining ?? '0'), 10) || 0);
  const incentiveMode = parseCommissionIncentiveMode(row?.commission_incentive_mode);
  const incentiveExpiresAt = parseIncentiveExpiresAt(row?.commission_incentive_expires_at);
  const effectiveFeeRate = await getPlatformFeeRate();
  const base: ProviderCommissionSettings = {
    commissionFreeBookingsRemaining: remaining,
    effectiveFeeRate,
    incentiveMode,
    incentiveExpiresAt,
    commissionFreeEligible: false,
  };
  base.commissionFreeEligible = isCommissionFreeEligible(base);
  return base;
}

export async function loadProviderCommissionSettings(
  client: DbClient,
  barberRecordId: string
): Promise<ProviderCommissionSettings> {
  const result = await client.query(
    `SELECT commission_free_bookings_remaining,
            commission_incentive_mode,
            commission_incentive_expires_at
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
    `SELECT id, commission_free_bookings_remaining,
            commission_incentive_mode,
            commission_incentive_expires_at
     FROM barbers
     WHERE "userId" = $1::uuid`,
    [barberUserId]
  );
  if (result.rows.length === 0) {
    return {
      settings: {
        commissionFreeBookingsRemaining: 0,
        effectiveFeeRate: await getPlatformFeeRate(client),
        incentiveMode: 'count',
        incentiveExpiresAt: null,
        commissionFreeEligible: false,
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
 * Atomically reserve commission-free for a booking.
 * Count mode: decrement remaining. Timeframe mode: no decrement while window active.
 */
export async function reserveCommissionFreeBooking(
  client: DbClient,
  barberRecordId: string
): Promise<boolean> {
  const result = await client.query(
    `UPDATE barbers
     SET commission_free_bookings_remaining = CASE
           WHEN COALESCE(commission_incentive_mode, 'count') = 'count'
                AND commission_free_bookings_remaining > 0
             THEN commission_free_bookings_remaining - 1
           ELSE commission_free_bookings_remaining
         END,
         "updatedAt" = NOW()
     WHERE id = $1::uuid
       AND (
         (
           COALESCE(commission_incentive_mode, 'count') = 'timeframe'
           AND commission_incentive_expires_at IS NOT NULL
           AND commission_incentive_expires_at > NOW()
         )
         OR (
           COALESCE(commission_incentive_mode, 'count') = 'count'
           AND commission_free_bookings_remaining > 0
         )
       )
     RETURNING commission_free_bookings_remaining,
               commission_incentive_mode,
               commission_incentive_expires_at`,
    [barberRecordId]
  );
  const reserved = (result.rowCount ?? 0) > 0;
  if (reserved) {
    const mode = parseCommissionIncentiveMode(result.rows[0]?.commission_incentive_mode);
    logger.info(
      mode === 'timeframe'
        ? 'Reserved commission-free booking via timeframe window'
        : 'Reserved commission-free booking slot',
      {
        barberRecordId,
        remaining: result.rows[0]?.commission_free_bookings_remaining,
        expiresAt: result.rows[0]?.commission_incentive_expires_at,
      }
    );
  }
  return reserved;
}

/** Restore a previously reserved free slot (e.g. payment failed / intent abandoned). */
export async function releaseCommissionFreeBooking(
  client: DbClient,
  barberRecordId: string
): Promise<void> {
  // Only restore quota in count mode — timeframe never decremented.
  const result = await client.query(
    `UPDATE barbers
     SET commission_free_bookings_remaining = commission_free_bookings_remaining + 1,
         "updatedAt" = NOW()
     WHERE id = $1::uuid
       AND COALESCE(commission_incentive_mode, 'count') = 'count'
     RETURNING id`,
    [barberRecordId]
  );
  if ((result.rowCount ?? 0) > 0) {
    logger.info('Released commission-free booking slot', { barberRecordId });
  }
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
