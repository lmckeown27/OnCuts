/**
 * Platform commission helpers for Stripe Connect destination charges.
 * Fee applies to service amount only (never tips).
 * Rate is platform-hardcoded (15%); admins only control commission-free booking quota.
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
  commissionFreeBookingsRemaining: number;
  /** Effective rate 0–1 used when not commission-free (always platform default). */
  effectiveFeeRate: number;
}

export interface PlatformFeeSplit {
  platformFeeCents: number;
  barberEarningsCents: number;
  feeRate: number;
  commissionFree: boolean;
  feePercentDisplay: number;
}

export function calculatePlatformFeeSplit(
  serviceAmountCents: number,
  opts?: { forceCommissionFree?: boolean }
): PlatformFeeSplit {
  const amount = Math.max(0, Math.round(serviceAmountCents));
  const waived = opts?.forceCommissionFree === true;
  const feeRate = waived ? 0 : DEFAULT_PLATFORM_FEE_RATE;
  const platformFeeCents = waived ? 0 : Math.round(amount * feeRate);
  const barberEarningsCents = amount - platformFeeCents;

  return {
    platformFeeCents,
    barberEarningsCents,
    feeRate,
    commissionFree: waived,
    feePercentDisplay: waived ? 0 : DEFAULT_PLATFORM_FEE_PERCENT,
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
  return calculatePlatformFeeSplit(serviceAmountCents, { forceCommissionFree: false });
}

function mapSettingsRow(row: QueryResultRow | undefined): ProviderCommissionSettings {
  const remaining = Math.max(0, parseInt(String(row?.commission_free_bookings_remaining ?? '0'), 10) || 0);
  return {
    commissionFreeBookingsRemaining: remaining,
    effectiveFeeRate: DEFAULT_PLATFORM_FEE_RATE,
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
