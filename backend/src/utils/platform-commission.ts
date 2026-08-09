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

/** Configured admin-set percent (not the effective charged percent when commission is off). */
let cachedConfiguredFeePercent: number | null = null;
let cachedCommissionEnabled: boolean | null = null;
let cachedFeeSettingsExpiresAt = 0;

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
  cachedConfiguredFeePercent = null;
  cachedCommissionEnabled = null;
  cachedFeeSettingsExpiresAt = 0;
}

async function loadPlatformFeeSettings(
  client: DbClient = pool
): Promise<{ configuredPercent: number; enabled: boolean }> {
  const now = Date.now();
  if (
    cachedConfiguredFeePercent !== null &&
    cachedCommissionEnabled !== null &&
    now < cachedFeeSettingsExpiresAt
  ) {
    return {
      configuredPercent: cachedConfiguredFeePercent,
      enabled: cachedCommissionEnabled,
    };
  }

  try {
    const result = await client.query(
      `SELECT platform_fee_percent, platform_commission_enabled
       FROM platform_settings WHERE id = 1 LIMIT 1`
    );
    if (result.rows.length > 0) {
      const percent =
        result.rows[0].platform_fee_percent != null
          ? clampFeePercent(parseFloat(String(result.rows[0].platform_fee_percent)))
          : DEFAULT_PLATFORM_FEE_PERCENT;
      // Default true when column missing / null (pre-migration rows)
      const enabled = result.rows[0].platform_commission_enabled !== false;
      cachedConfiguredFeePercent = percent;
      cachedCommissionEnabled = enabled;
      cachedFeeSettingsExpiresAt = now + FEE_CACHE_TTL_MS;
      return { configuredPercent: percent, enabled };
    }
  } catch (err) {
    // Column may not exist yet before migration 060 — fall back to percent-only query.
    try {
      const result = await client.query(
        `SELECT platform_fee_percent FROM platform_settings WHERE id = 1 LIMIT 1`
      );
      if (result.rows.length > 0 && result.rows[0].platform_fee_percent != null) {
        const percent = clampFeePercent(parseFloat(String(result.rows[0].platform_fee_percent)));
        cachedConfiguredFeePercent = percent;
        cachedCommissionEnabled = true;
        cachedFeeSettingsExpiresAt = now + FEE_CACHE_TTL_MS;
        return { configuredPercent: percent, enabled: true };
      }
    } catch {
      /* use defaults below */
    }
    logger.warn('platform_settings lookup failed; using default commission settings', {
      error: err instanceof Error ? err.message : String(err),
      fallbackPercent: DEFAULT_PLATFORM_FEE_PERCENT,
    });
  }

  cachedConfiguredFeePercent = DEFAULT_PLATFORM_FEE_PERCENT;
  cachedCommissionEnabled = true;
  cachedFeeSettingsExpiresAt = now + FEE_CACHE_TTL_MS;
  return { configuredPercent: DEFAULT_PLATFORM_FEE_PERCENT, enabled: true };
}

/** Admin-configured percent (0–100), even when global commission is turned off. */
export async function getConfiguredPlatformFeePercent(client: DbClient = pool): Promise<number> {
  const { configuredPercent } = await loadPlatformFeeSettings(client);
  return configuredPercent;
}

/** Whether platform commission is charged on card service payments. */
export async function isPlatformCommissionEnabled(client: DbClient = pool): Promise<boolean> {
  const { enabled } = await loadPlatformFeeSettings(client);
  return enabled;
}

/**
 * Effective platform commission percent (0–100) for charging.
 * Returns 0 when global commission is disabled.
 */
export async function getPlatformFeePercent(client: DbClient = pool): Promise<number> {
  const { configuredPercent, enabled } = await loadPlatformFeeSettings(client);
  return enabled ? configuredPercent : 0;
}

/** Global platform commission rate 0–1 (effective for charging). */
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
  invalidatePlatformFeeCache();
  return next;
}

/**
 * Persist global commission on/off and refresh cache.
 */
export async function setPlatformCommissionEnabled(
  enabled: boolean,
  updatedBy?: string | null,
  client: DbClient = pool
): Promise<boolean> {
  const next = Boolean(enabled);
  await client.query(
    `INSERT INTO platform_settings (id, platform_fee_percent, platform_commission_enabled, updated_at, updated_by)
     VALUES (
       1,
       COALESCE((SELECT platform_fee_percent FROM platform_settings WHERE id = 1), $1),
       $2,
       NOW(),
       $3
     )
     ON CONFLICT (id) DO UPDATE SET
       platform_commission_enabled = EXCLUDED.platform_commission_enabled,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [DEFAULT_PLATFORM_FEE_PERCENT, next, updatedBy ?? null]
  );
  invalidatePlatformFeeCache();
  await loadPlatformFeeSettings(client);
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
  if (opts.alreadyCommissionFreeApplied) {
    return {
      ...calculatePlatformFeeSplit(opts.serviceAmountCents, { forceCommissionFree: true }),
      reservedNow: false,
    };
  }

  // Global commission off: $0 fee, do not consume free slots or stamp commission_free_applied.
  if (!(await isPlatformCommissionEnabled(client))) {
    const split = calculatePlatformFeeSplit(opts.serviceAmountCents, {
      forceCommissionFree: false,
      feePercent: 0,
    });
    await client.query(
      `UPDATE bookings
       SET "platformFeeUsdCents" = $1,
           "barberEarningsUsdCents" = $2,
           "updatedAt" = NOW()
       WHERE id = $3::uuid`,
      [split.platformFeeCents, split.barberEarningsCents, opts.bookingId]
    );
    logger.info('Platform commission disabled; booking charged $0 fee without free-slot reserve', {
      bookingId: opts.bookingId,
      barberRecordId: opts.barberRecordId,
    });
    return { ...split, reservedNow: false };
  }

  const feePercent = await getPlatformFeePercent(client);

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
