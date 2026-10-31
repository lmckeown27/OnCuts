/**
 * Stage operator points on unpaid bookings; settle (debit + record boost) after payment.
 * Cash boost is paid via the same platform → Connect Stripe Transfer path as % kickback.
 */

import { PoolClient } from 'pg';
import type Stripe from 'stripe';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { applyPointsDelta } from './points-ledger.service';
import { getReferralProgramSettings } from './referral-code.service';
import { logger } from '../utils/logger';
import { getStripeClientForLivemode } from '../config/stripe';
import { stripeAutoModeFromAppNetwork } from '../config/app-network';

type DbClient = PoolClient | typeof pool;

async function loadBookingForOperatorPoints(bookingId: string, client: DbClient) {
  const result = await client.query(
    `SELECT b.id,
            b."barberId" AS barber_record_id,
            bar."userId" AS barber_user_id,
            COALESCE(b."priceUsdCents", 0) AS price_usd_cents,
            COALESCE(b."paidAt", b.paid_at) AS paid_at,
            COALESCE(b.operator_points_pending_pts, 0) AS pending_pts,
            COALESCE(b.operator_points_applied_pts, 0) AS applied_pts,
            COALESCE(b.operator_points_boost_cents, 0) AS boost_cents,
            COALESCE(b.operator_points_kickback_status, 'none') AS kickback_status,
            b.operator_points_kickback_transfer_id AS kickback_transfer_id
     FROM bookings b
     JOIN barbers bar ON b."barberId" = bar.id
     WHERE b.id = $1`,
    [bookingId]
  );
  return result.rows[0] || null;
}

function maxPointsForService(serviceCents: number, pointsPerDollar: number, maxSpendPercent: number): number {
  return Math.floor((serviceCents / 100) * pointsPerDollar * (maxSpendPercent / 100));
}

function resolveLivemode(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return stripeAutoModeFromAppNetwork() === 'live';
}

async function resolveConnectedAccountId(
  client: DbClient,
  barberRecordId: string,
  provided?: string | null
): Promise<string | null> {
  if (provided) return provided;
  const result = await client.query(
    `SELECT u.stripe_account_id
     FROM users u
     JOIN barbers b ON b."userId" = u.id
     WHERE b.id = $1`,
    [barberRecordId]
  );
  return result.rows[0]?.stripe_account_id || null;
}

/**
 * Platform → Connect Transfer for operator points boost.
 * Same Stripe Transfer pattern as processProviderKickback (% kickback).
 * Idempotent when status is already transferred.
 */
export async function transferOperatorPointsKickbackBoost(opts: {
  client: DbClient;
  bookingId: string;
  barberRecordId: string;
  boostCents: number;
  connectedAccountId?: string | null;
  paymentIntentId?: string | null;
  livemode?: boolean;
}): Promise<{ transferred: boolean; boostCents: number; transferId?: string }> {
  const boostCents = Math.max(0, Math.round(Number(opts.boostCents) || 0));
  if (boostCents <= 0) {
    return { transferred: false, boostCents: 0 };
  }

  const existing = await opts.client.query(
    `SELECT operator_points_kickback_status, operator_points_kickback_transfer_id,
            operator_points_boost_cents
     FROM bookings WHERE id = $1::uuid FOR UPDATE`,
    [opts.bookingId]
  );
  const row = existing.rows[0];
  if (!row) {
    logger.warn('operator_points_kickback_transfer_missing_booking', {
      bookingId: opts.bookingId,
    });
    return { transferred: false, boostCents: 0 };
  }

  if (
    row.operator_points_kickback_status === 'transferred' &&
    row.operator_points_kickback_transfer_id
  ) {
    return {
      transferred: true,
      boostCents: parseInt(String(row.operator_points_boost_cents ?? boostCents), 10) || boostCents,
      transferId: String(row.operator_points_kickback_transfer_id),
    };
  }

  const connectedAccountId = await resolveConnectedAccountId(
    opts.client,
    opts.barberRecordId,
    opts.connectedAccountId
  );

  if (!connectedAccountId) {
    await opts.client.query(
      `UPDATE bookings
       SET operator_points_kickback_status = 'failed',
           operator_points_kickback_error = $2,
           "updatedAt" = NOW()
       WHERE id = $1::uuid`,
      [opts.bookingId, 'Provider has no Stripe Connect account']
    );
    logger.warn('operator_points_kickback_transfer_no_connect', {
      bookingId: opts.bookingId,
      boostCents,
    });
    return { transferred: false, boostCents };
  }

  await opts.client.query(
    `UPDATE bookings
     SET operator_points_kickback_status = 'pending',
         operator_points_kickback_error = NULL,
         "updatedAt" = NOW()
     WHERE id = $1::uuid`,
    [opts.bookingId]
  );

  const livemode = resolveLivemode(opts.livemode);
  const paymentIntentId = opts.paymentIntentId || `points_kickback_${opts.bookingId}`;

  try {
    const stripe = getStripeClientForLivemode(livemode);
    const transfer: Stripe.Transfer = await stripe.transfers.create(
      {
        amount: boostCents,
        currency: 'usd',
        destination: connectedAccountId,
        transfer_group: `booking_${opts.bookingId}`,
        metadata: {
          type: 'operator_points_kickback',
          booking_id: opts.bookingId,
          barber_id: opts.barberRecordId,
          payment_intent_id: paymentIntentId,
          kickback_cents: String(boostCents),
        },
      },
      {
        idempotencyKey: `operator_points_kickback_${opts.bookingId}`,
      }
    );

    await opts.client.query(
      `UPDATE bookings
       SET operator_points_kickback_transfer_id = $2,
           operator_points_kickback_status = 'transferred',
           operator_points_kickback_transferred_at = NOW(),
           operator_points_kickback_error = NULL,
           "updatedAt" = NOW()
       WHERE id = $1::uuid`,
      [opts.bookingId, transfer.id]
    );

    logger.info('operator_points_kickback_transferred', {
      bookingId: opts.bookingId,
      transferId: transfer.id,
      boostCents,
      destination: connectedAccountId,
    });

    return { transferred: true, boostCents, transferId: transfer.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await opts.client.query(
      `UPDATE bookings
       SET operator_points_kickback_status = 'failed',
           operator_points_kickback_error = $2,
           "updatedAt" = NOW()
       WHERE id = $1::uuid`,
      [opts.bookingId, message.slice(0, 500)]
    );
    logger.error('operator_points_kickback_transfer_failed', {
      bookingId: opts.bookingId,
      boostCents,
      error: message,
    });
    return { transferred: false, boostCents };
  }
}

/**
 * Stage (unpaid) or immediately settle (paid) operator points for a booking kickback.
 */
export async function stageOrApplyOperatorPointsKickback(opts: {
  bookingId: string;
  operatorUserId: string;
  pointsPts: number;
}): Promise<{
  mode: 'staged' | 'applied' | 'noop';
  pendingPts: number;
  appliedPts: number;
  payoutBoostDollars: number;
  maxPts: number;
}> {
  const pointsToApply = Math.floor(Number(opts.pointsPts));
  if (!Number.isFinite(pointsToApply) || pointsToApply < 0) {
    throw new ApiError(400, 'pointsPts must be a non-negative integer');
  }

  const settings = await getReferralProgramSettings();
  const booking = await loadBookingForOperatorPoints(opts.bookingId, pool);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (String(booking.barber_user_id) !== String(opts.operatorUserId)) {
    throw new ApiError(403, 'Not your booking');
  }

  const serviceCents = Math.max(0, Math.round(Number(booking.price_usd_cents) || 0));
  const maxPts = maxPointsForService(
    serviceCents,
    settings.pointsPerDollar,
    settings.maxSpendPercent
  );

  const bal = await pool.query(
    `SELECT balance_pts FROM operator_points WHERE user_id = $1`,
    [opts.operatorUserId]
  );
  const balancePts = Number(bal.rows[0]?.balance_pts) || 0;
  const alreadyApplied = Number(booking.applied_pts) || 0;
  if (alreadyApplied > 0) {
    return {
      mode: 'applied',
      pendingPts: 0,
      appliedPts: alreadyApplied,
      payoutBoostDollars: (Number(booking.boost_cents) || 0) / 100,
      maxPts,
    };
  }

  const applyPts = Math.min(pointsToApply, maxPts, balancePts);
  const paid = booking.paid_at != null;

  if (!paid) {
    await pool.query(
      `UPDATE bookings
       SET operator_points_pending_pts = $2,
           "updatedAt" = NOW()
       WHERE id = $1`,
      [opts.bookingId, applyPts]
    );
    return {
      mode: applyPts > 0 ? 'staged' : 'noop',
      pendingPts: applyPts,
      appliedPts: 0,
      payoutBoostDollars: applyPts / settings.pointsPerDollar,
      maxPts,
    };
  }

  // Already paid — settle immediately from this request.
  const settled = await settleOperatorPointsKickback({
    bookingId: opts.bookingId,
    pointsPtsOverride: applyPts,
  });
  return {
    mode: settled.appliedPts > 0 ? 'applied' : 'noop',
    pendingPts: 0,
    appliedPts: settled.appliedPts,
    payoutBoostDollars: settled.boostCents / 100,
    maxPts,
  };
}

/**
 * Debit staged (or override) operator points after payment, record boost cents,
 * then Transfer boost via the same platform → Connect path as % kickback.
 * Idempotent when applied_pts already set (still retries transfer if needed).
 */
export async function settleOperatorPointsKickback(opts: {
  bookingId: string;
  pointsPtsOverride?: number;
  client?: PoolClient | null;
  connectedAccountId?: string | null;
  paymentIntentId?: string | null;
  livemode?: boolean;
}): Promise<{ appliedPts: number; boostCents: number; transferred?: boolean }> {
  const run = async (c: DbClient) => {
    const booking = await loadBookingForOperatorPoints(opts.bookingId, c);
    if (!booking) {
      logger.warn('operator_points_kickback_settle_missing_booking', {
        bookingId: opts.bookingId,
      });
      return { appliedPts: 0, boostCents: 0, transferred: false };
    }

    let appliedPts = Number(booking.applied_pts) || 0;
    let boostCents = Number(booking.boost_cents) || 0;

    if (appliedPts <= 0) {
      if (!booking.paid_at) {
        logger.warn('operator_points_kickback_settle_unpaid', {
          bookingId: opts.bookingId,
        });
        return { appliedPts: 0, boostCents: 0, transferred: false };
      }

      const settings = await getReferralProgramSettings();
      const serviceCents = Math.max(0, Math.round(Number(booking.price_usd_cents) || 0));
      const maxPts = maxPointsForService(
        serviceCents,
        settings.pointsPerDollar,
        settings.maxSpendPercent
      );
      const pending = Number(booking.pending_pts) || 0;
      const desired =
        opts.pointsPtsOverride != null ? Math.floor(opts.pointsPtsOverride) : pending;
      const applyPts = Math.max(0, Math.min(desired, maxPts));

      if (applyPts <= 0) {
        await c.query(
          `UPDATE bookings
           SET operator_points_pending_pts = 0,
               "updatedAt" = NOW()
           WHERE id = $1`,
          [opts.bookingId]
        );
        return { appliedPts: 0, boostCents: 0, transferred: false };
      }

      const dollars = applyPts / settings.pointsPerDollar;
      boostCents = Math.round(dollars * 100);

      await applyPointsDelta({
        userId: String(booking.barber_user_id),
        kind: 'operator',
        deltaPts: -applyPts,
        reason: 'operator_booking_kickback',
        bookingId: opts.bookingId,
        meta: { payoutBoostDollars: dollars, boostCents },
        client: opts.client || (c as PoolClient),
      });

      await c.query(
        `UPDATE bookings
         SET operator_points_pending_pts = 0,
             operator_points_applied_pts = $2,
             operator_points_boost_cents = $3,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [opts.bookingId, applyPts, boostCents]
      );

      appliedPts = applyPts;

      logger.info('operator_points_kickback_settled', {
        bookingId: opts.bookingId,
        applyPts,
        boostCents,
      });
    }

    if (boostCents <= 0) {
      return { appliedPts, boostCents, transferred: false };
    }

    const transfer = await transferOperatorPointsKickbackBoost({
      client: c,
      bookingId: opts.bookingId,
      barberRecordId: String(booking.barber_record_id),
      boostCents,
      connectedAccountId: opts.connectedAccountId,
      paymentIntentId: opts.paymentIntentId,
      livemode: opts.livemode,
    });

    return {
      appliedPts,
      boostCents,
      transferred: transfer.transferred,
    };
  };

  if (opts.client) return run(opts.client);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await run(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}
