/**
 * Platform commission helpers for Stripe Connect destination charges.
 * Fee applies to service amount only (never tips).
 */

import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../database/connection';
import { logger } from './logger';

export const DEFAULT_PLATFORM_FEE_RATE = 0.15;
export const DEFAULT_PLATFORM_FEE_PERCENT = 15;
/** Default commission-free card bookings granted to every new provider. */
export const DEFAULT_COMMISSION_FREE_BOOKINGS = 5;

export type DbClient = PoolClient | typeof pool;

export interface ProviderCommissionSettings {
  platformFeePercent: number | null;
  commissionFreeBookingsRemaining: number;
  /** Effective rate 0–1 used when not commission-free */
  effectiveFeeRate: number;
}

export interface PlatformFeeSplit {
  platformFeeCents: number;
  barberEarningsCents: number;
  feeRate: number;
  commissionFree: boolean;
  feePercentDisplay: number;
}

function parseFeePercent(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

export function effectiveFeeRateFromPercent(platformFeePercent: number | null | undefined): number {
  if (platformFeePercent == null) return DEFAULT_PLATFORM_FEE_RATE;
  return Math.min(1, Math.max(0, platformFeePercent / 100));
}

export function calculatePlatformFeeSplit(
  serviceAmountCents: number,
  settings: Pick<ProviderCommissionSettings, 'platformFeePercent'>,
  opts?: { forceCommissionFree?: boolean }
): PlatformFeeSplit {
  const amount = Math.max(0, Math.round(serviceAmountCents));
  const waived = opts?.forceCommissionFree === true;
  const feeRate = waived ? 0 : effectiveFeeRateFromPercent(settings.platformFeePercent);
  const platformFeeCents = waived ? 0 : Math.round(amount * feeRate);
  const barberEarningsCents = amount - platformFeeCents;
  const feePercentDisplay = waived
    ? 0
    : settings.platformFeePercent != null
      ? settings.platformFeePercent
      : DEFAULT_PLATFORM_FEE_PERCENT;

  return {
    platformFeeCents,
    barberEarningsCents,
    feeRate,
    commissionFree: waived,
    feePercentDisplay,
  };
}

/** Estimate fee at booking create (does not reserve a free slot). */
export function estimatePlatformFeeSplit(
  serviceAmountCents: number,
  settings: ProviderCommissionSettings
): PlatformFeeSplit {
  if (settings.commissionFreeBookingsRemaining > 0) {
    return calculatePlatformFeeSplit(serviceAmountCents, settings, { forceCommissionFree: true });
  }
  return calculatePlatformFeeSplit(serviceAmountCents, settings, { forceCommissionFree: false });
}

function mapSettingsRow(row: QueryResultRow | undefined): ProviderCommissionSettings {
  const platformFeePercent = parseFeePercent(row?.platform_fee_percent);
  const remaining = Math.max(0, parseInt(String(row?.commission_free_bookings_remaining ?? '0'), 10) || 0);
  return {
    platformFeePercent,
    commissionFreeBookingsRemaining: remaining,
    effectiveFeeRate: effectiveFeeRateFromPercent(platformFeePercent),
  };
}

export async function loadProviderCommissionSettings(
  client: DbClient,
  barberRecordId: string
): Promise<ProviderCommissionSettings> {
  const result = await client.query(
    `SELECT platform_fee_percent, commission_free_bookings_remaining
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
    `SELECT id, platform_fee_percent, commission_free_bookings_remaining
     FROM barbers
     WHERE "userId" = $1::uuid`,
    [barberUserId]
  );
  if (result.rows.length === 0) {
    return {
      settings: {
        platformFeePercent: null,
        commissionFreeBookingsRemaining: 0,
        effectiveFeeRate: DEFAULT_PLATFORM_FEE_RATE,
      },
      barberRecordId: null,
    };
  }
  return {
    settings: mapSettingsRow(result.rows[0]),
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
  const settings = await loadProviderCommissionSettings(client, opts.barberRecordId);

  if (opts.alreadyCommissionFreeApplied) {
    return {
      ...calculatePlatformFeeSplit(opts.serviceAmountCents, settings, { forceCommissionFree: true }),
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
      ...calculatePlatformFeeSplit(opts.serviceAmountCents, settings, { forceCommissionFree: true }),
      reservedNow: true,
    };
  }

  const split = calculatePlatformFeeSplit(opts.serviceAmountCents, settings, {
    forceCommissionFree: false,
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
