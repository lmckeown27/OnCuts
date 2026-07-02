import { pool } from '../database/connection';
import stripeService, { isStaleConnectAccountError } from './stripe.service';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { eligible: boolean; expiresAt: number };

const eligibilityCache = new Map<string, CacheEntry>();

async function clearStaleConnectUser(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET stripe_account_id = NULL,
         stripe_payouts_enabled = false,
         stripe_charges_enabled = false,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Whether a provider may appear in consumer discovery for the current platform Stripe keys.
 * Validates against Stripe (not just DB flags) and clears stale Intera-era acct_* IDs.
 */
export async function isProviderEligibleForConsumerBrowse(
  userId: string,
  stripeAccountId: string | null,
): Promise<boolean> {
  if (!stripeAccountId) return false;

  const cached = eligibilityCache.get(stripeAccountId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.eligible;
  }

  try {
    await stripeService.validateConnectAccountForCurrentPlatform(stripeAccountId);
    const status = await stripeService.getAccountStatus(stripeAccountId);
    const eligible = status.chargesEnabled && status.payoutsEnabled;

    eligibilityCache.set(stripeAccountId, {
      eligible,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    await pool.query(
      `UPDATE users
       SET stripe_payouts_enabled = $1,
           stripe_charges_enabled = $2,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3
         AND (
           stripe_payouts_enabled IS DISTINCT FROM $1
           OR stripe_charges_enabled IS DISTINCT FROM $2
         )`,
      [status.payoutsEnabled, status.chargesEnabled, userId]
    );

    return eligible;
  } catch (error) {
    if (isStaleConnectAccountError(error)) {
      logger.warn('Stale Connect account excluded from consumer browse', {
        userId,
        stripeAccountId,
      });
      await clearStaleConnectUser(userId);
      eligibilityCache.set(stripeAccountId, {
        eligible: false,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return false;
    }

    logger.warn('Connect eligibility check failed; excluding provider from browse', {
      userId,
      stripeAccountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function filterRowsEligibleForConsumerBrowse<
  T extends { user_id: string; stripe_account_id: string | null },
>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;

  const checked = await Promise.all(
    rows.map(async (row) => ({
      row,
      eligible: await isProviderEligibleForConsumerBrowse(row.user_id, row.stripe_account_id),
    })),
  );

  return checked.filter((entry) => entry.eligible).map((entry) => entry.row);
}
