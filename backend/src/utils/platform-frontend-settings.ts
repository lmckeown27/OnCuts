/**
 * Platform frontend controls (cash payments, consumer home mode, reviews,
 * payment timing). Stored on singleton platform_settings; Admin-editable via
 * Controls tab.
 *
 * cash_payment_enabled only gates cash for bookings where BOTH the consumer
 * and the operator user are platform ADMIN (internal/test). Standard
 * consumer/operator bookings never offer cash.
 *
 * payment_timing_mode:
 *   on_accept — charge service after accept; tip after complete (default)
 *   after_complete — charge service (+ optional tip) after mark-complete
 */

import { pool } from '../database/connection';
import { logger } from './logger';
import type { DbClient } from './platform-commission';
import {
  getConfiguredPlatformFeePercent,
  getFeeBurden,
  isPlatformCommissionEnabled,
  setFeeBurden,
  setPlatformCommissionEnabled,
  setPlatformFeePercent,
  type FeeBurden,
} from './platform-commission';
import {
  getConfiguredKickbackPercent,
  setPlatformKickbackPercent,
} from './platform-kickback';

export type ConsumerHomeMode = 'providers' | 'waitlist';

/** When the consumer pays for the service relative to booking completion. */
export type PaymentTimingMode = 'on_accept' | 'after_complete';

export interface PlatformFrontendSettings {
  cashPaymentEnabled: boolean;
  consumerHomeMode: ConsumerHomeMode;
  consumerHomeReviewsEnabled: boolean;
  paymentTimingMode: PaymentTimingMode;
}

export interface PlatformSettingsPayload extends PlatformFrontendSettings {
  /** Admin-configured percent (preserved when commission is off). */
  platformFeePercent: number;
  /** When false, card bookings take $0 platform fee. */
  platformCommissionEnabled: boolean;
  /** Global kickback % of service amount (0 = off). Applied to all operators on save. */
  kickbackPercent: number;
  /** operator = commission from listed price; client = Service Fee on top. */
  feeBurden: FeeBurden;
}

export interface FrontendConfigPayload extends PlatformFrontendSettings {
  consumerUserCount: number;
  platformFeePercent: number;
  platformCommissionEnabled: boolean;
  feeBurden: FeeBurden;
}

const DEFAULTS: PlatformFrontendSettings = {
  cashPaymentEnabled: false,
  consumerHomeMode: 'providers',
  consumerHomeReviewsEnabled: true,
  paymentTimingMode: 'on_accept',
};

const CACHE_TTL_MS = 30_000;

let cachedFrontend: PlatformFrontendSettings | null = null;
let cachedFrontendExpiresAt = 0;

function parseHomeMode(raw: unknown): ConsumerHomeMode {
  return raw === 'waitlist' ? 'waitlist' : 'providers';
}

export function parsePaymentTimingMode(raw: unknown): PaymentTimingMode {
  return raw === 'after_complete' ? 'after_complete' : 'on_accept';
}

export function invalidatePlatformFrontendSettingsCache(): void {
  cachedFrontend = null;
  cachedFrontendExpiresAt = 0;
}

export async function getPlatformFrontendSettings(
  client: DbClient = pool
): Promise<PlatformFrontendSettings> {
  const now = Date.now();
  if (cachedFrontend !== null && now < cachedFrontendExpiresAt) {
    return cachedFrontend;
  }

  try {
    const result = await client.query(
      `SELECT cash_payment_enabled, consumer_home_mode, consumer_home_reviews_enabled,
              payment_timing_mode
       FROM platform_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const next: PlatformFrontendSettings = {
        cashPaymentEnabled: row.cash_payment_enabled === true,
        consumerHomeMode: parseHomeMode(row.consumer_home_mode),
        consumerHomeReviewsEnabled: row.consumer_home_reviews_enabled !== false,
        paymentTimingMode: parsePaymentTimingMode(row.payment_timing_mode),
      };
      cachedFrontend = next;
      cachedFrontendExpiresAt = now + CACHE_TTL_MS;
      return next;
    }
  } catch (err) {
    logger.warn('platform_settings frontend lookup failed; using defaults', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  cachedFrontend = { ...DEFAULTS };
  cachedFrontendExpiresAt = now + CACHE_TTL_MS;
  return { ...DEFAULTS };
}

export async function getPaymentTimingMode(
  client: DbClient = pool
): Promise<PaymentTimingMode> {
  const settings = await getPlatformFrontendSettings(client);
  return settings.paymentTimingMode;
}

export async function isPayOnAccept(client: DbClient = pool): Promise<boolean> {
  return (await getPaymentTimingMode(client)) === 'on_accept';
}

export async function isCashPaymentEnabled(client: DbClient = pool): Promise<boolean> {
  const settings = await getPlatformFrontendSettings(client);
  return settings.cashPaymentEnabled;
}

export function isAdminAdminBookingPair(
  consumerRole: unknown,
  barberUserRole: unknown
): boolean {
  return (
    String(consumerRole || '').trim().toUpperCase() === 'ADMIN' &&
    String(barberUserRole || '').trim().toUpperCase() === 'ADMIN'
  );
}

/** Cash is allowed only when the Controls toggle is on AND both parties are ADMIN. */
export async function isCashPaymentAllowedForRoles(
  consumerRole: unknown,
  barberUserRole: unknown,
  client: DbClient = pool
): Promise<boolean> {
  if (!isAdminAdminBookingPair(consumerRole, barberUserRole)) return false;
  return isCashPaymentEnabled(client);
}

/**
 * Same total as Admin Users tab default (`role` unmanaged / managed):
 * consumers + admins. Used for the public waitlist count.
 */
export async function countConsumerUsers(client: DbClient = pool): Promise<number> {
  try {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role IN ('CONSUMER', 'ADMIN')`
    );
    return parseInt(String(result.rows[0]?.count ?? '0'), 10) || 0;
  } catch (err) {
    logger.warn('consumer user count failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

export async function getFrontendConfigPayload(
  client: DbClient = pool
): Promise<FrontendConfigPayload> {
  const [settings, consumerUserCount, platformFeePercent, platformCommissionEnabled, feeBurden] =
    await Promise.all([
      getPlatformFrontendSettings(client),
      countConsumerUsers(client),
      getConfiguredPlatformFeePercent(client),
      isPlatformCommissionEnabled(client),
      getFeeBurden(client),
    ]);
  return {
    ...settings,
    consumerUserCount,
    platformFeePercent,
    platformCommissionEnabled,
    feeBurden,
  };
}

export async function getPlatformSettingsPayload(
  client: DbClient = pool
): Promise<PlatformSettingsPayload> {
  const [platformFeePercent, platformCommissionEnabled, kickbackPercent, feeBurden, frontend] =
    await Promise.all([
      getConfiguredPlatformFeePercent(client),
      isPlatformCommissionEnabled(client),
      getConfiguredKickbackPercent(client),
      getFeeBurden(client),
      getPlatformFrontendSettings(client),
    ]);
  return {
    platformFeePercent,
    platformCommissionEnabled,
    kickbackPercent,
    feeBurden,
    ...frontend,
  };
}

export async function updatePlatformSettingsPartial(
  patch: {
    platformFeePercent?: number;
    platformCommissionEnabled?: boolean;
    kickbackPercent?: number;
    feeBurden?: FeeBurden;
    cashPaymentEnabled?: boolean;
    consumerHomeMode?: ConsumerHomeMode;
    consumerHomeReviewsEnabled?: boolean;
    paymentTimingMode?: PaymentTimingMode;
  },
  updatedBy?: string | null,
  client: DbClient = pool
): Promise<PlatformSettingsPayload> {
  const hasFee = patch.platformFeePercent !== undefined;
  const hasCommissionEnabled = patch.platformCommissionEnabled !== undefined;
  const hasKickback = patch.kickbackPercent !== undefined;
  const hasBurden = patch.feeBurden !== undefined;
  const hasCash = patch.cashPaymentEnabled !== undefined;
  const hasMode = patch.consumerHomeMode !== undefined;
  const hasReviews = patch.consumerHomeReviewsEnabled !== undefined;
  const hasPaymentTiming = patch.paymentTimingMode !== undefined;

  if (hasFee) {
    await setPlatformFeePercent(patch.platformFeePercent!, updatedBy, client);
  }

  if (hasCommissionEnabled) {
    await setPlatformCommissionEnabled(Boolean(patch.platformCommissionEnabled), updatedBy, client);
  }

  if (hasKickback) {
    await setPlatformKickbackPercent(patch.kickbackPercent!, updatedBy, client);
  }

  if (hasBurden) {
    await setFeeBurden(patch.feeBurden!, updatedBy, client);
  }

  if (hasCash || hasMode || hasReviews || hasPaymentTiming) {
    const current = await getPlatformFrontendSettings(client);
    const nextCash = hasCash ? Boolean(patch.cashPaymentEnabled) : current.cashPaymentEnabled;
    const nextMode = hasMode
      ? parseHomeMode(patch.consumerHomeMode)
      : current.consumerHomeMode;
    const nextReviews = hasReviews
      ? Boolean(patch.consumerHomeReviewsEnabled)
      : current.consumerHomeReviewsEnabled;
    const nextPaymentTiming = hasPaymentTiming
      ? parsePaymentTimingMode(patch.paymentTimingMode)
      : current.paymentTimingMode;

    await client.query(
      `INSERT INTO platform_settings (
         id, platform_fee_percent, cash_payment_enabled, consumer_home_mode,
         consumer_home_reviews_enabled, payment_timing_mode, updated_at, updated_by
       )
       VALUES (
         1,
         COALESCE((SELECT platform_fee_percent FROM platform_settings WHERE id = 1), 15),
         $1,
         $2,
         $3,
         $4,
         NOW(),
         $5
       )
       ON CONFLICT (id) DO UPDATE SET
         cash_payment_enabled = EXCLUDED.cash_payment_enabled,
         consumer_home_mode = EXCLUDED.consumer_home_mode,
         consumer_home_reviews_enabled = EXCLUDED.consumer_home_reviews_enabled,
         payment_timing_mode = EXCLUDED.payment_timing_mode,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [nextCash, nextMode, nextReviews, nextPaymentTiming, updatedBy ?? null]
    );
    invalidatePlatformFrontendSettingsCache();
  }

  return getPlatformSettingsPayload(client);
}
