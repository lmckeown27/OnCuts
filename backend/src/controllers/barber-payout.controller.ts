import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getPlatformFeeRate } from '../utils/platform-commission';

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

const DEFAULT_TIMEZONE = 'America/Los_Angeles';

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(v: unknown): number {
  return Math.round(num(v));
}

interface ResolvedBarber {
  barberId: string;
  timezone: string;
}

async function resolveActiveBarber(userId: string): Promise<ResolvedBarber | null> {
  const result = await pool.query(
    `SELECT b.id AS barber_id, COALESCE(c.timezone, $2) AS timezone
     FROM barbers b
     JOIN users u ON b."userId" = u.id
     LEFT JOIN campuses c ON u."campusId" = c.id
     WHERE b."userId" = $1 AND b."isActive" = true
     LIMIT 1`,
    [userId, DEFAULT_TIMEZONE]
  );
  if (result.rows.length === 0) return null;
  return {
    barberId: result.rows[0].barber_id as string,
    timezone: (result.rows[0].timezone as string) || DEFAULT_TIMEZONE,
  };
}

function parseMetricsPeriod(period: string): {
  dateTrunc: string;
  interval: string | null;
  startDate: string | null;
} {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  switch (period) {
    case 'daily':
    case '1w':
      return { dateTrunc: 'day', interval: '7 days', startDate: null };
    case 'weekly':
    case '4w':
      return { dateTrunc: 'week', interval: '1 month', startDate: null };
    case 'monthly':
    case '1y':
      return { dateTrunc: 'month', interval: '1 year', startDate: null };
    case 'mtd':
      return { dateTrunc: 'day', interval: null, startDate: startOfMonth.toISOString() };
    case 'qtd':
      return { dateTrunc: 'day', interval: null, startDate: startOfQuarter.toISOString() };
    case 'ytd':
      return { dateTrunc: 'week', interval: null, startDate: startOfYear.toISOString() };
    case 'all':
      return { dateTrunc: 'month', interval: null, startDate: null };
    default:
      return { dateTrunc: 'week', interval: '1 month', startDate: null };
  }
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

    const platformFeeRate = await getPlatformFeeRate();
    const [bookingRow, recentRow, opsRow, repeatRow] = await Promise.all([
      pool.query(
        `SELECT 
          COALESCE(SUM(
            (b."priceUsdCents" - ROUND(b."priceUsdCents" * $2)::bigint)
            + COALESCE(b."tipAmountCents", 0)::bigint
          ), 0)::bigint AS est_cents,
          COUNT(*)::int AS cnt
         FROM bookings b
         WHERE b."barberId" = $1 AND UPPER(b.status::text) = 'PAID'`,
        [barberId, platformFeeRate]
      ),
      pool.query(
        `SELECT COALESCE(SUM(
            (b."priceUsdCents" - ROUND(b."priceUsdCents" * $2)::bigint)
            + COALESCE(b."tipAmountCents", 0)::bigint
          ), 0)::bigint AS est_cents
         FROM bookings b
         WHERE b."barberId" = $1
           AND UPPER(b.status::text) = 'PAID'
           AND (
             (b."paidAt" IS NOT NULL AND b."paidAt" >= NOW() - INTERVAL '30 days')
             OR (b."paidAt" IS NULL AND b."updatedAt" >= NOW() - INTERVAL '30 days')
           )`,
        [barberId, platformFeeRate]
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

/**
 * Time-series metrics for barber analytics chart.
 * GET /api/barber/payout/metrics?period=daily|weekly|monthly
 */
export async function getBarberMetrics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const resolved = await resolveActiveBarber(userId);
    if (!resolved) {
      return res.json({ success: true, period: req.query.period || 'weekly', data: [], totalClients: 0 });
    }

    const period = (req.query.period as string) || 'weekly';
    const { dateTrunc, interval, startDate } = parseMetricsPeriod(period);
    const { barberId, timezone } = resolved;

    let metricsResult;
    let clientsResult;

    if (interval) {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(*) FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = $2
           AND COALESCE("paidAt", "updatedAt") >= NOW() - $3::interval
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, interval, timezone]
      );
      clientsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(DISTINCT "consumerId") AS clients
         FROM bookings
         WHERE "barberId" = $2
           AND UPPER(status::text) IN ('COMPLETED', 'PAID')
           AND COALESCE("paidAt", "updatedAt") >= NOW() - $3::interval
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, interval, timezone]
      );
    } else if (startDate) {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(*) FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = $2
           AND COALESCE("paidAt", "updatedAt") >= $3::timestamp
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, startDate, timezone]
      );
      clientsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(DISTINCT "consumerId") AS clients
         FROM bookings
         WHERE "barberId" = $2
           AND UPPER(status::text) IN ('COMPLETED', 'PAID')
           AND COALESCE("paidAt", "updatedAt") >= $3::timestamp
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, startDate, timezone]
      );
    } else {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3) AS period_start,
          COUNT(*) FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = $2
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, timezone]
      );
      clientsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3) AS period_start,
          COUNT(DISTINCT "consumerId") AS clients
         FROM bookings
         WHERE "barberId" = $2
           AND UPPER(status::text) IN ('COMPLETED', 'PAID')
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3)
         ORDER BY period_start ASC`,
        [dateTrunc, barberId, timezone]
      );
    }

    const bookingsMap = new Map(
      metricsResult.rows.map((row) => [
        row.period_start?.toISOString(),
        { bookings: parseIntSafe(row.bookings), revenue: parseIntSafe(row.revenue) },
      ])
    );
    const clientsMap = new Map(
      clientsResult.rows.map((row) => [row.period_start?.toISOString(), parseIntSafe(row.clients)])
    );

    const allDates = new Set<string>([...bookingsMap.keys(), ...clientsMap.keys()].filter(Boolean) as string[]);
    const data = Array.from(allDates)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateKey) => ({
        date: dateKey,
        bookings: bookingsMap.get(dateKey)?.bookings || 0,
        revenue: bookingsMap.get(dateKey)?.revenue || 0,
        clients: clientsMap.get(dateKey) || 0,
      }));

    const totalClientsResult = await pool.query(
      interval
        ? `SELECT COUNT(DISTINCT "consumerId") AS total
           FROM bookings
           WHERE "barberId" = $1
             AND UPPER(status::text) IN ('COMPLETED', 'PAID')
             AND COALESCE("paidAt", "updatedAt") >= NOW() - $2::interval`
        : startDate
          ? `SELECT COUNT(DISTINCT "consumerId") AS total
             FROM bookings
             WHERE "barberId" = $1
               AND UPPER(status::text) IN ('COMPLETED', 'PAID')
               AND COALESCE("paidAt", "updatedAt") >= $2::timestamp`
          : `SELECT COUNT(DISTINCT "consumerId") AS total
             FROM bookings
             WHERE "barberId" = $1
               AND UPPER(status::text) IN ('COMPLETED', 'PAID')`,
      interval ? [barberId, interval] : startDate ? [barberId, startDate] : [barberId]
    );

    res.json({
      success: true,
      period,
      data,
      totalClients: parseIntSafe(totalClientsResult.rows[0]?.total),
    });
  } catch (e) {
    logger.error('getBarberMetrics failed', e);
    next(e);
  }
}

/**
 * All-time performance snapshot for barber analytics dashboard.
 * GET /api/barber/payout/performance
 */
export async function getBarberPerformance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const resolved = await resolveActiveBarber(userId);
    if (!resolved) {
      return res.json({
        success: true,
        data: {
          has_barber_profile: false,
          totalRevenue: 0,
          totalBarberEarnings: 0,
          totalPlatformFees: 0,
          totalTips: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          pendingRequests: 0,
          acceptedUpcoming: 0,
          uniqueClients: 0,
          repeatClientPct: 0,
          completionRatePct: 0,
          cardRevenue: 0,
          cardCount: 0,
          cardTips: 0,
          cashRevenue: 0,
          cashCount: 0,
          cashTips: 0,
          averageRating: 0,
          totalReviews: 0,
          averageBookingsPerDay: 0,
          averageBookingsPerWeek: 0,
          averageBookingsPerMonth: 0,
          averageRevenuePerDay: 0,
          averageRevenuePerWeek: 0,
          averageRevenuePerMonth: 0,
          averageCostPerAppointment: 0,
          averageTakeHomePerAppointment: 0,
        },
      });
    }

    const { barberId } = resolved;

    const [bookingsResult, revenueResult, ratingsResult, opsResult, repeatResult, avgDailyResult, avgWeeklyResult, avgMonthlyResult] =
      await Promise.all([
        pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')) AS completed,
            COUNT(*) FILTER (WHERE UPPER(status::text) = 'CANCELLED') AS cancelled,
            COUNT(*) FILTER (WHERE UPPER(status::text) = 'REJECTED') AS rejected
           FROM bookings WHERE "barberId" = $1`,
          [barberId]
        ),
        pool.query(
          `SELECT
            COALESCE(SUM("totalPaidCents"), 0) AS total_revenue,
            COALESCE(SUM("platformFeeUsdCents"), 0) AS total_platform_fees,
            COALESCE(SUM("totalPaidCents") - SUM("platformFeeUsdCents"), 0) AS total_barber_earnings,
            COALESCE(SUM("tipAmountCents"), 0) AS total_tips,
            COUNT(*) AS completed_transaction_count,
            COALESCE(SUM(
              GREATEST(
                COALESCE("totalPaidCents", 0),
                COALESCE("priceUsdCents", 0) + COALESCE("tipAmountCents", 0)
              )
            ) FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) AS card_revenue,
            COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL) AS card_count,
            COALESCE(SUM(COALESCE("tipAmountCents", 0))
              FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) AS card_tips,
            COALESCE(SUM(
              GREATEST(
                COALESCE("totalPaidCents", 0),
                COALESCE("priceUsdCents", 0) + COALESCE("tipAmountCents", 0)
              )
            ) FILTER (WHERE LOWER("paymentMethod") = 'cash'), 0) AS cash_revenue,
            COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'cash') AS cash_count,
            COALESCE(SUM(COALESCE("tipAmountCents", 0))
              FILTER (WHERE LOWER("paymentMethod") = 'cash'), 0) AS cash_tips
           FROM bookings
           WHERE "barberId" = $1 AND UPPER(status::text) IN ('COMPLETED', 'PAID')`,
          [barberId]
        ),
        pool.query(
          `SELECT COALESCE(b."avgRating", 0) AS avg_rating, COALESCE(b."totalReviews", 0) AS total_reviews
           FROM barbers b WHERE b.id = $1`,
          [barberId]
        ),
        pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE UPPER(status::text) = 'PENDING')::int AS pending_count,
            COUNT(*) FILTER (
              WHERE UPPER(status::text) = 'ACCEPTED' AND "requestedAt" >= NOW()
            )::int AS accepted_upcoming_count,
            COUNT(DISTINCT "consumerId") FILTER (
              WHERE UPPER(status::text) IN ('COMPLETED', 'PAID')
            )::int AS unique_clients
           FROM bookings WHERE "barberId" = $1`,
          [barberId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS repeat_clients
           FROM (
             SELECT "consumerId"
             FROM bookings
             WHERE "barberId" = $1 AND UPPER(status::text) IN ('COMPLETED', 'PAID')
             GROUP BY "consumerId"
             HAVING COUNT(*) >= 2
           ) repeat_clients`,
          [barberId]
        ),
        pool.query(
          `SELECT COALESCE(AVG(daily_count), 0) AS avg_daily
           FROM (
             SELECT DATE_TRUNC('day', COALESCE("paidAt", "updatedAt")) AS day, COUNT(*) AS daily_count
             FROM bookings
             WHERE "barberId" = $1
               AND UPPER(status::text) IN ('COMPLETED', 'PAID')
               AND COALESCE("paidAt", "updatedAt") >= NOW() - INTERVAL '30 days'
             GROUP BY DATE_TRUNC('day', COALESCE("paidAt", "updatedAt"))
           ) daily_counts`,
          [barberId]
        ),
        pool.query(
          `SELECT COALESCE(AVG(weekly_count), 0) AS avg_weekly
           FROM (
             SELECT DATE_TRUNC('week', COALESCE("paidAt", "updatedAt")) AS week, COUNT(*) AS weekly_count
             FROM bookings
             WHERE "barberId" = $1
               AND UPPER(status::text) IN ('COMPLETED', 'PAID')
               AND COALESCE("paidAt", "updatedAt") >= NOW() - INTERVAL '12 weeks'
             GROUP BY DATE_TRUNC('week', COALESCE("paidAt", "updatedAt"))
           ) weekly_counts`,
          [barberId]
        ),
        pool.query(
          `SELECT COALESCE(AVG(monthly_count), 0) AS avg_monthly
           FROM (
             SELECT DATE_TRUNC('month', COALESCE("paidAt", "updatedAt")) AS month, COUNT(*) AS monthly_count
             FROM bookings
             WHERE "barberId" = $1
               AND UPPER(status::text) IN ('COMPLETED', 'PAID')
               AND COALESCE("paidAt", "updatedAt") >= NOW() - INTERVAL '12 months'
             GROUP BY DATE_TRUNC('month', COALESCE("paidAt", "updatedAt"))
           ) monthly_counts`,
          [barberId]
        ),
      ]);

    const completedBookings = parseIntSafe(bookingsResult.rows[0]?.completed);
    const cancelledBookings = parseIntSafe(bookingsResult.rows[0]?.cancelled);
    const rejectedBookings = parseIntSafe(bookingsResult.rows[0]?.rejected);
    const totalRevenue = parseIntSafe(revenueResult.rows[0]?.total_revenue);
    const totalPlatformFees = parseIntSafe(revenueResult.rows[0]?.total_platform_fees);
    const totalBarberEarnings = parseIntSafe(revenueResult.rows[0]?.total_barber_earnings);
    const totalTips = parseIntSafe(revenueResult.rows[0]?.total_tips);
    const completedTransactionCount = parseIntSafe(revenueResult.rows[0]?.completed_transaction_count);
    const uniqueClients = parseIntSafe(opsResult.rows[0]?.unique_clients);
    const repeatClients = parseIntSafe(repeatResult.rows[0]?.repeat_clients);
    const terminalCount = completedBookings + cancelledBookings + rejectedBookings;
    const completionRatePct =
      terminalCount > 0 ? Math.round((completedBookings / terminalCount) * 1000) / 10 : 0;
    const repeatClientPct =
      uniqueClients > 0 ? Math.round((repeatClients / uniqueClients) * 1000) / 10 : 0;
    const avgCostPerAppointment =
      completedTransactionCount > 0 ? Math.round(totalRevenue / completedTransactionCount) : 0;
    const averageTakeHomePerAppointment =
      completedTransactionCount > 0 ? Math.round(totalBarberEarnings / completedTransactionCount) : 0;
    const avgDaily = parseFloat(String(avgDailyResult.rows[0]?.avg_daily || 0));
    const avgWeekly = parseFloat(String(avgWeeklyResult.rows[0]?.avg_weekly || 0));
    const avgMonthly = parseFloat(String(avgMonthlyResult.rows[0]?.avg_monthly || 0));

    res.json({
      success: true,
      data: {
        has_barber_profile: true,
        totalRevenue,
        totalBarberEarnings,
        totalPlatformFees,
        totalTips,
        completedBookings,
        cancelledBookings,
        pendingRequests: parseIntSafe(opsResult.rows[0]?.pending_count),
        acceptedUpcoming: parseIntSafe(opsResult.rows[0]?.accepted_upcoming_count),
        uniqueClients,
        repeatClientPct,
        completionRatePct,
        cardRevenue: parseIntSafe(revenueResult.rows[0]?.card_revenue),
        cardCount: parseIntSafe(revenueResult.rows[0]?.card_count),
        cardTips: parseIntSafe(revenueResult.rows[0]?.card_tips),
        cashRevenue: parseIntSafe(revenueResult.rows[0]?.cash_revenue),
        cashCount: parseIntSafe(revenueResult.rows[0]?.cash_count),
        cashTips: parseIntSafe(revenueResult.rows[0]?.cash_tips),
        averageRating: parseFloat(String(ratingsResult.rows[0]?.avg_rating || 0)),
        totalReviews: parseIntSafe(ratingsResult.rows[0]?.total_reviews),
        averageBookingsPerDay: avgDaily,
        averageBookingsPerWeek: avgWeekly,
        averageBookingsPerMonth: avgMonthly,
        averageRevenuePerDay: avgDaily * avgCostPerAppointment,
        averageRevenuePerWeek: avgWeekly * avgCostPerAppointment,
        averageRevenuePerMonth: avgMonthly * avgCostPerAppointment,
        averageCostPerAppointment: avgCostPerAppointment,
        averageTakeHomePerAppointment,
      },
    });
  } catch (e) {
    logger.error('getBarberPerformance failed', e);
    next(e);
  }
}

/**
 * Unique clients with at least one paid/completed booking.
 * GET /api/barber/payout/clients
 */
export async function getBarberClients(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const resolved = await resolveActiveBarber(userId);
    if (!resolved) {
      return res.json({ success: true, data: { clients: [] } });
    }

    const { barberId } = resolved;
    const result = await pool.query(
      `SELECT
         u.id AS consumer_id,
         u.first_name,
         u.last_name,
         u.email,
         u."avatarUrl" AS avatar_url,
         COUNT(*)::int AS total_booking_count,
         COUNT(*) FILTER (WHERE UPPER(b.status::text) IN ('COMPLETED', 'PAID'))::int AS paid_booking_count,
         COALESCE(SUM(b."totalPaidCents") FILTER (WHERE UPPER(b.status::text) IN ('COMPLETED', 'PAID')), 0)::bigint AS total_paid_cents,
         MAX(COALESCE(b."paidAt", b."updatedAt", b."createdAt")) AS last_booking_at,
         COALESCE(AVG(r.rating), 0) AS avg_review_rating,
         COUNT(r.rating)::int AS review_count
       FROM bookings b
       JOIN users u ON b."consumerId" = u.id
       LEFT JOIN reviews r ON r."bookingId" = b.id
       WHERE b."barberId" = $1
         AND b."consumerId" IN (
           SELECT DISTINCT "consumerId"
           FROM bookings
           WHERE "barberId" = $1
             AND UPPER(status::text) IN ('COMPLETED', 'PAID')
         )
       GROUP BY u.id, u.first_name, u.last_name, u.email, u."avatarUrl"
       ORDER BY last_booking_at DESC NULLS LAST`,
      [barberId]
    );

    const clients = result.rows.map((row) => ({
      consumer_id: row.consumer_id as string,
      first_name: row.first_name as string,
      last_name: row.last_name as string,
      email: row.email as string,
      avatar_url: (row.avatar_url as string | null) || null,
      total_booking_count: parseIntSafe(row.total_booking_count),
      paid_booking_count: parseIntSafe(row.paid_booking_count),
      total_paid_cents: parseIntSafe(row.total_paid_cents),
      last_booking_at: row.last_booking_at ? new Date(row.last_booking_at as string).toISOString() : null,
      avg_review_rating: parseFloat(String(row.avg_review_rating || 0)),
      review_count: parseIntSafe(row.review_count),
      is_repeat: parseIntSafe(row.paid_booking_count) >= 2,
    }));

    res.json({ success: true, data: { clients } });
  } catch (e) {
    logger.error('getBarberClients failed', e);
    next(e);
  }
}

/**
 * All bookings between the authenticated barber and a specific client.
 * GET /api/barber/payout/clients/:consumerId/bookings
 */
export async function getBarberClientBookings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const { consumerId } = req.params;
    if (!consumerId) throw new ApiError(400, 'consumerId is required');

    const resolved = await resolveActiveBarber(userId);
    if (!resolved) {
      return res.json({ success: true, data: { bookings: [] } });
    }

    const { barberId } = resolved;

    const linkCheck = await pool.query(
      `SELECT 1
       FROM bookings
       WHERE "barberId" = $1 AND "consumerId" = $2
       LIMIT 1`,
      [barberId, consumerId]
    );
    if (linkCheck.rows.length === 0) {
      throw new ApiError(404, 'No bookings found for this client');
    }

    const result = await pool.query(
      `SELECT
         b.id,
         b."serviceType" AS service_type,
         b."priceUsdCents" AS price_cents,
         b."tipAmountCents" AS tip_cents,
         b."totalPaidCents" AS total_paid_cents,
         b.status,
         b."paymentMethod" AS payment_method,
         b."requestedAt" AS scheduled_time,
         b."createdAt" AS created_at,
         b."paidAt" AS paid_at,
         r.rating AS review_rating,
         r.comment AS review_text
       FROM bookings b
       LEFT JOIN reviews r ON r."bookingId" = b.id
       WHERE b."barberId" = $1 AND b."consumerId" = $2
       ORDER BY COALESCE(b."paidAt", b."requestedAt", b."createdAt") DESC`,
      [barberId, consumerId]
    );

    res.json({ success: true, data: { bookings: result.rows } });
  } catch (e) {
    logger.error('getBarberClientBookings failed', e);
    next(e);
  }
}
