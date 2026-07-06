/**
 * Single switch for test stack vs live stack: Stripe test/live keys.
 *
 * Set `APP_NETWORK_MODE=testnet` or `mainnet` (alias: `SUI_NETWORK` with the same values).
 * Omit or `APP_NETWORK_MODE=auto`: do not apply network defaults; use explicit env vars only.
 *
 * For Stripe API traffic only: when `STRIPE_MODE=auto`, maps testnet → test keys, mainnet → live keys.
 * Explicit `STRIPE_MODE=test|live` always wins. Webhook key resolution is unchanged (uses event livemode).
 */

import { logger } from '../utils/logger';

export type AppNetworkMode = 'testnet' | 'mainnet';

/** null = switch not used (legacy: only explicit STRIPE_* env). */
export function resolveAppNetworkModeFromEnv(): AppNetworkMode | null {
  const raw = (process.env.APP_NETWORK_MODE || process.env.SUI_NETWORK || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  if (raw === 'mainnet' || raw === 'live' || raw === 'production') return 'mainnet';
  if (raw === 'testnet' || raw === 'test' || raw === 'development') return 'testnet';
  logger.warn(`APP_NETWORK_MODE/SUI_NETWORK invalid value "${raw}" — ignoring`);
  return null;
}

/** No-op: on-chain network defaults removed; Stripe-only production path. */
export function applyAppNetworkModeDefaults(): void {
  resolveAppNetworkModeFromEnv();
}

/**
 * When STRIPE_MODE=auto, prefer test vs live API keys from APP_NETWORK_MODE.
 */
export function stripeAutoModeFromAppNetwork(): 'test' | 'live' | null {
  const net = resolveAppNetworkModeFromEnv();
  if (net === 'testnet') return 'test';
  if (net === 'mainnet') return 'live';
  return null;
}
