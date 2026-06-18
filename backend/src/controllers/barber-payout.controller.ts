import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const SUI_ADDR = /^0x[0-9a-fA-F]{64}$/;

/**
 * Barber Sui (or legacy hex) payout address for Checkout metadata.
 * GET /api/barber/payout/status
 */
export async function getBarberPayoutStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const result = await pool.query(
      `SELECT
         NULLIF(TRIM(sui_address), '') AS sui,
         NULLIF(TRIM("walletAddress"), '') AS legacy
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const row = result.rows[0];
    const payoutAddress = (row.sui as string | null) || (row.legacy as string | null) || null;
    const valid = Boolean(payoutAddress && SUI_ADDR.test(payoutAddress));

    res.json({
      success: true,
      data: {
        payout_ready: valid,
        /** Canonical payout id when valid; otherwise null */
        sui_address: valid ? payoutAddress : null,
        /** Raw DB value if present but not valid 0x+64 hex (user should replace) */
        invalid_stored_address: Boolean(payoutAddress && !valid),
        stored_address_preview: !valid && payoutAddress ? `${payoutAddress.slice(0, 10)}…` : null,
      },
    });
  } catch (e) {
    logger.error('getBarberPayoutStatus failed', e);
    next(e);
  }
}

const PLATFORM_FEE_RATE = 0.15;

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Earnings snapshot for Payout Settings UI (ledger + booking-based estimate).
 * GET /api/barber/payout/summary
 */
export async function getBarberPayoutSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const barberResult = await pool.query(
      `SELECT id FROM barbers WHERE "userId" = $1 AND "isActive" = true LIMIT 1`,
      [userId]
    );

    if (barberResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          has_barber_profile: false,
          ledger_total_dollars: 0,
          ledger_pending_dollars: 0,
          ledger_paid_out_dollars: 0,
          booking_estimated_barber_cents: 0,
          paid_bookings_count: 0,
          recent_30d_barber_cents: 0,
          display_total_dollars: 0,
          gross_volume_cents: 0,
          tips_cents: 0,
          avg_take_home_cents: 0,
          completed_bookings_count: 0,
          cancelled_bookings_count: 0,
          pending_requests_count: 0,
          accepted_upcoming_count: 0,
          unique_clients_count: 0,
          repeat_client_pct: 0,
          completion_rate_pct: 0,
          avg_rating: 0,
          total_reviews: 0,
        },
      });
    }

    const barberId = barberResult.rows[0].id as string;

    const profileRow = await pool.query(
      `SELECT "avgRating" AS avg_rating, "totalReviews" AS total_reviews
       FROM barbers WHERE id = $1`,
      [barberId]
    );
    const profile = profileRow.rows[0] || {};

    let ledgerTotal = 0;
    let ledgerPending = 0;
    let ledgerPaidOut = 0;

    try {
      const ledgerRow = await pool.query(
        `SELECT 
          COALESCE(SUM(barber_payout), 0) AS total,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN barber_payout ELSE 0 END), 0) AS pending,
          COALESCE(SUM(CASE WHEN status = 'succeeded' THEN barber_payout ELSE 0 END), 0) AS paid_out
         FROM payment_transactions
         WHERE barber_id = $1`,
        [barberId]
      );
      const lr = ledgerRow.rows[0] || {};
      ledgerTotal = num(lr.total);
      ledgerPending = num(lr.pending);
      ledgerPaidOut = num(lr.paid_out);
    } catch (ledgerErr: unknown) {
      const pe = ledgerErr as { code?: string; message?: string };
      // 42501 = insufficient_privilege; 42P01 = undefined_table
      if (pe.code === '42501' || pe.code === '42P01') {
        logger.warn(
          'getBarberPayoutSummary: skipping payment_transactions ledger (missing table or GRANT); using booking estimate only',
          { code: pe.code, barberId }
        );
      } else {
        throw ledgerErr;
      }
    }

    const [bookingRow, recentRow, opsRow, repeatRow] = await Promise.all([
      pool.query(
        `SELECT 
          COALESCE(SUM(
            (b."priceUsdCents" - ROUND(b."priceUsdCents" * ${PLATFORM_FEE_RATE})::bigint)
            + COALESCE(b."tipAmountCents", 0)::bigint
          ), 0)::bigint AS est_cents,
          COUNT(*)::int AS cnt
         FROM bookings b
         WHERE b."barberId" = $1 AND UPPER(b.status::text) = 'PAID'`,
        [barberId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(
            (b."priceUsdCents" - ROUND(b."priceUsdCents" * ${PLATFORM_FEE_RATE})::bigint)
            + COALESCE(b."tipAmountCents", 0)::bigint
          ), 0)::bigint AS est_cents
         FROM bookings b
         WHERE b."barberId" = $1
           AND UPPER(b.status::text) = 'PAID'
           AND (
             (b."paidAt" IS NOT NULL AND b."paidAt" >= NOW() - INTERVAL '30 days')
             OR (b."paidAt" IS NULL AND b."updatedAt" >= NOW() - INTERVAL '30 days')
           )`,
        [barberId]
      ),
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE UPPER(status::text) IN ('PAID', 'COMPLETED'))::int AS completed_count,
          COUNT(*) FILTER (WHERE UPPER(status::text) = 'CANCELLED')::int AS cancelled_count,
          COUNT(*) FILTER (WHERE UPPER(status::text) = 'REJECTED')::int AS rejected_count,
          COUNT(*) FILTER (WHERE UPPER(status::text) = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (
            WHERE UPPER(status::text) = 'ACCEPTED'
              AND b."requestedAt" >= NOW()
          )::int AS accepted_upcoming_count,
          COUNT(DISTINCT "consumerId") FILTER (
            WHERE UPPER(status::text) IN ('PAID', 'COMPLETED')
          )::int AS unique_clients,
          COALESCE(SUM("priceUsdCents") FILTER (WHERE UPPER(status::text) = 'PAID'), 0)::bigint AS gross_cents,
          COALESCE(SUM(COALESCE("tipAmountCents", 0)) FILTER (WHERE UPPER(status::text) = 'PAID'), 0)::bigint AS tips_cents
         FROM bookings b
         WHERE b."barberId" = $1`,
        [barberId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS repeat_clients
         FROM (
           SELECT "consumerId"
           FROM bookings
           WHERE "barberId" = $1
             AND UPPER(status::text) IN ('PAID', 'COMPLETED')
           GROUP BY "consumerId"
           HAVING COUNT(*) >= 2
         ) repeat_clients`,
        [barberId]
      ),
    ]);

    const br = bookingRow.rows[0] || {};
    const bookingEstCents = num(br.est_cents);
    const paidCount = Math.round(num((br as { cnt?: unknown }).cnt));

    const rr = recentRow.rows[0] || {};
    const recent30Cents = num(rr.est_cents);

    const displayTotal =
      ledgerTotal > 0 ? ledgerTotal : Math.round(bookingEstCents) / 100;

    const ops = opsRow.rows[0] || {};
    const completedCount = Math.round(num(ops.completed_count));
    const cancelledCount = Math.round(num(ops.cancelled_count));
    const rejectedCount = Math.round(num(ops.rejected_count));
    const pendingCount = Math.round(num(ops.pending_count));
    const acceptedUpcoming = Math.round(num(ops.accepted_upcoming_count));
    const uniqueClients = Math.round(num(ops.unique_clients));
    const grossCents = Math.round(num(ops.gross_cents));
    const tipsCents = Math.round(num(ops.tips_cents));
    const repeatClients = Math.round(num(repeatRow.rows[0]?.repeat_clients));

    const terminalCount = completedCount + cancelledCount + rejectedCount;
    const completionRatePct =
      terminalCount > 0 ? Math.round((completedCount / terminalCount) * 1000) / 10 : 0;
    const repeatClientPct =
      uniqueClients > 0 ? Math.round((repeatClients / uniqueClients) * 1000) / 10 : 0;
    const avgTakeHomeCents =
      paidCount > 0 ? Math.round(bookingEstCents / paidCount) : 0;

    res.json({
      success: true,
      data: {
        has_barber_profile: true,
        ledger_total_dollars: ledgerTotal,
        ledger_pending_dollars: ledgerPending,
        ledger_paid_out_dollars: ledgerPaidOut,
        booking_estimated_barber_cents: Math.round(bookingEstCents),
        paid_bookings_count: paidCount,
        recent_30d_barber_cents: Math.round(recent30Cents),
        display_total_dollars: displayTotal,
        gross_volume_cents: grossCents,
        tips_cents: tipsCents,
        avg_take_home_cents: avgTakeHomeCents,
        completed_bookings_count: completedCount,
        cancelled_bookings_count: cancelledCount,
        pending_requests_count: pendingCount,
        accepted_upcoming_count: acceptedUpcoming,
        unique_clients_count: uniqueClients,
        repeat_client_pct: repeatClientPct,
        completion_rate_pct: completionRatePct,
        avg_rating: num(profile.avg_rating),
        total_reviews: Math.round(num(profile.total_reviews)),
      },
    });
  } catch (e) {
    logger.error('getBarberPayoutSummary failed', e);
    next(e);
  }
}
