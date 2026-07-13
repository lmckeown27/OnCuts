/**
 * Stripe Connect Instant Payouts after eligible card booking charges.
 * Soft-fails: never throws into the booking webhook.
 */

import Stripe from 'stripe';
import { getStripeClientForLivemode } from '../config/stripe';
import { logger } from '../utils/logger';

/** Stripe US Instant Payout minimum ($0.50). */
export const INSTANT_PAYOUT_MIN_CENTS = 50;

export type InstantPayoutStatus = 'instant' | 'skipped' | 'failed' | 'disabled';

export type InstantPayoutResult = {
  status: InstantPayoutStatus;
  payoutId?: string;
  reason?: string;
  amountCents?: number;
};

export function isInstantPayoutsEnabled(): boolean {
  return process.env.STRIPE_INSTANT_PAYOUTS_ENABLED === 'true';
}

function usdInstantAvailableCents(balance: Stripe.Balance): number {
  const buckets = balance.instant_available ?? [];
  return buckets
    .filter((b) => (b.currency || '').toLowerCase() === 'usd')
    .reduce((sum, b) => sum + (b.amount || 0), 0);
}

/**
 * Attempt an Instant Payout of up to `amountCents` from a Connect account balance.
 * Caps to Instant-eligible available balance. Never throws.
 */
export async function attemptInstantPayout(params: {
  connectedAccountId: string;
  amountCents: number;
  bookingId: string;
  livemode: boolean;
  /** Injected Stripe client (tests). Defaults to livemode platform client. */
  stripe?: Stripe;
}): Promise<InstantPayoutResult> {
  const { connectedAccountId, amountCents, bookingId, livemode } = params;

  if (!isInstantPayoutsEnabled()) {
    return { status: 'disabled', reason: 'STRIPE_INSTANT_PAYOUTS_ENABLED is not true' };
  }

  if (!connectedAccountId) {
    return { status: 'skipped', reason: 'missing_connected_account' };
  }

  if (!Number.isFinite(amountCents) || amountCents < INSTANT_PAYOUT_MIN_CENTS) {
    return {
      status: 'skipped',
      reason: `amount_below_minimum_${INSTANT_PAYOUT_MIN_CENTS}`,
      amountCents,
    };
  }

  try {
    const stripe = params.stripe ?? getStripeClientForLivemode(livemode);
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectedAccountId,
    });

    const instantEligible = usdInstantAvailableCents(balance);
    if (instantEligible <= 0) {
      logger.info('Instant payout skipped: no Instant-available balance', {
        bookingId,
        connectedAccountId,
        requestedCents: amountCents,
      });
      return { status: 'skipped', reason: 'instant_balance_zero', amountCents: 0 };
    }

    const payoutAmount = Math.min(amountCents, instantEligible);
    if (payoutAmount < INSTANT_PAYOUT_MIN_CENTS) {
      return {
        status: 'skipped',
        reason: `capped_amount_below_minimum_${INSTANT_PAYOUT_MIN_CENTS}`,
        amountCents: payoutAmount,
      };
    }

    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency: 'usd',
        method: 'instant',
        metadata: {
          booking_id: bookingId,
          platform: 'OnCuts',
        },
      },
      {
        stripeAccount: connectedAccountId,
        idempotencyKey: `instant_payout_booking_${bookingId}`,
      }
    );

    logger.info('Instant payout created', {
      bookingId,
      payoutId: payout.id,
      amountCents: payoutAmount,
      connectedAccountId,
    });

    return {
      status: 'instant',
      payoutId: payout.id,
      amountCents: payoutAmount,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Instant payout failed (soft); schedule payout remains', {
      bookingId,
      connectedAccountId,
      amountCents,
      error: message,
    });
    return { status: 'failed', reason: message, amountCents };
  }
}

/** Persist Instant outcome on payments row (nullable columns). Soft-fails DB errors. */
export async function persistInstantPayoutOutcome(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  paymentIntentId: string,
  result: InstantPayoutResult
): Promise<void> {
  if (result.status === 'disabled') return;
  try {
    await client.query(
      `UPDATE payments
       SET instant_payout_id = COALESCE($1, instant_payout_id),
           instant_payout_status = $2
       WHERE payment_intent_id = $3`,
      [result.payoutId ?? null, result.status, paymentIntentId]
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to persist Instant payout outcome', {
      paymentIntentId,
      status: result.status,
      error: message,
    });
  }
}
