/**
 * Platform frontend controls (cash payments, consumer home mode).
 * Stored on singleton platform_settings; Admin-editable via Controls tab.
 *
 * cash_payment_enabled only gates cash for bookings where BOTH the consumer
 * and the operator user are platform ADMIN (internal/test). Standard
 * consumer/operator bookings never offer cash.
 */

import { pool } from '../database/connection';
import { logger } from './logger';
import type { DbClient } from './platform-commission';
import {
  getConfiguredPlatformFeePercent,
  isPlatformCommissionEnabled,
  setPlatformCommissionEnabled,
  setPlatformFeePercent,
} from './platform-commission';

export type ConsumerHomeMode = 'providers' | 'waitlist';

export interface PlatformFrontendSettings {
  cashPaymentEnabled: boolean;
  consumerHomeMode: ConsumerHomeMode;
}

export interface PlatformSettingsPayload extends PlatformFrontendSettings {
  /** Admin-configured percent (preserved when commission is off). */
  platformFeePercent: number;
  /** When false, card bookings take $0 platform fee. */
  platformCommissionEnabled: boolean;
}

export interface FrontendConfigPayload extends PlatformFrontendSettings {
  consumerUserCount: number;
}

const DEFAULTS: PlatformFrontendSettings = {
  cashPaymentEnabled: false,
  consumerHomeMode: 'providers',
};

const CACHE_TTL_MS = 30_000;

let cachedFrontend: PlatformFrontendSettings | null = null;
let cachedFrontendExpiresAt = 0;

function parseHomeMode(raw: unknown): ConsumerHomeMode {
  return raw === 'waitlist' ? 'waitlist' : 'providers';
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
      `SELECT cash_payment_enabled, consumer_home_mode
       FROM platform_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const next: PlatformFrontendSettings = {
        cashPaymentEnabled: row.cash_payment_enabled === true,
        consumerHomeMode: parseHomeMode(row.consumer_home_mode),
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
  const [settings, consumerUserCount] = await Promise.all([
    getPlatformFrontendSettings(client),
    countConsumerUsers(client),
  ]);
  return {
    ...settings,
    consumerUserCount,
  };
}

export async function getPlatformSettingsPayload(
  client: DbClient = pool
): Promise<PlatformSettingsPayload> {
  const [platformFeePercent, platformCommissionEnabled, frontend] = await Promise.all([
    getConfiguredPlatformFeePercent(client),
    isPlatformCommissionEnabled(client),
    getPlatformFrontendSettings(client),
  ]);
  return {
    platformFeePercent,
    platformCommissionEnabled,
    ...frontend,
  };
}

export async function updatePlatformSettingsPartial(
  patch: {
    platformFeePercent?: number;
    platformCommissionEnabled?: boolean;
    cashPaymentEnabled?: boolean;
    consumerHomeMode?: ConsumerHomeMode;
  },
  updatedBy?: string | null,
  client: DbClient = pool
): Promise<PlatformSettingsPayload> {
  const hasFee = patch.platformFeePercent !== undefined;
  const hasCommissionEnabled = patch.platformCommissionEnabled !== undefined;
  const hasCash = patch.cashPaymentEnabled !== undefined;
  const hasMode = patch.consumerHomeMode !== undefined;

  if (hasFee) {
    await setPlatformFeePercent(patch.platformFeePercent!, updatedBy, client);
  }

  if (hasCommissionEnabled) {
    await setPlatformCommissionEnabled(Boolean(patch.platformCommissionEnabled), updatedBy, client);
  }

  if (hasCash || hasMode) {
    const current = await getPlatformFrontendSettings(client);
    const nextCash = hasCash ? Boolean(patch.cashPaymentEnabled) : current.cashPaymentEnabled;
    const nextMode = hasMode
      ? parseHomeMode(patch.consumerHomeMode)
      : current.consumerHomeMode;

    await client.query(
      `INSERT INTO platform_settings (id, platform_fee_percent, cash_payment_enabled, consumer_home_mode, updated_at, updated_by)
       VALUES (
         1,
         COALESCE((SELECT platform_fee_percent FROM platform_settings WHERE id = 1), 15),
         $1,
         $2,
         NOW(),
         $3
       )
       ON CONFLICT (id) DO UPDATE SET
         cash_payment_enabled = EXCLUDED.cash_payment_enabled,
         consumer_home_mode = EXCLUDED.consumer_home_mode,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [nextCash, nextMode, updatedBy ?? null]
    );
    invalidatePlatformFrontendSettingsCache();
  }

  return getPlatformSettingsPayload(client);
}
