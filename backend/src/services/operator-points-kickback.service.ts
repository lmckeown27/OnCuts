/**
 * Stage operator points on unpaid bookings; settle (debit + record boost) after payment.
 */

import { PoolClient } from 'pg';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { applyPointsDelta } from './points-ledger.service';
import { getReferralProgramSettings } from './referral-code.service';
import logger from '../utils/logger';

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
            COALESCE(b.operator_points_boost_cents, 0) AS boost_cents
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
 * Debit staged (or override) operator points after payment and record boost cents.
 * Idempotent when applied_pts already set.
 */
export async function settleOperatorPointsKickback(opts: {
  bookingId: string;
  pointsPtsOverride?: number;
  client?: PoolClient | null;
}): Promise<{ appliedPts: number; boostCents: number }> {
  const run = async (c: DbClient) => {
    const booking = await loadBookingForOperatorPoints(opts.bookingId, c);
    if (!booking) {
      logger.warn('operator_points_kickback_settle_missing_booking', {
        bookingId: opts.bookingId,
      });
      return { appliedPts: 0, boostCents: 0 };
    }

    const alreadyApplied = Number(booking.applied_pts) || 0;
    if (alreadyApplied > 0) {
      return {
        appliedPts: alreadyApplied,
        boostCents: Number(booking.boost_cents) || 0,
      };
    }

    if (!booking.paid_at) {
      logger.warn('operator_points_kickback_settle_unpaid', {
        bookingId: opts.bookingId,
      });
      return { appliedPts: 0, boostCents: 0 };
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
      return { appliedPts: 0, boostCents: 0 };
    }

    const dollars = applyPts / settings.pointsPerDollar;
    const boostCents = Math.round(dollars * 100);

    await applyPointsDelta({
      userId: String(booking.barber_user_id),
      kind: 'operator',
      deltaPts: -applyPts,
      reason: 'operator_booking_kickback',
      bookingId: opts.bookingId,
      meta: { payoutBoostDollars: dollars, boostCents },
      // Prefer an explicit transaction client when settle owns BEGIN/COMMIT.
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

    logger.info('operator_points_kickback_settled', {
      bookingId: opts.bookingId,
      applyPts,
      boostCents,
    });

    return { appliedPts: applyPts, boostCents };
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
