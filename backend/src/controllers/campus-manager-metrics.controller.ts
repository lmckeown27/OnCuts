import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

function parseIntSafe(value: unknown): number {
  const n = parseInt(String(value ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseMetricsPeriod(period: string): {
  dateTrunc: string;
  interval: string | null;
  startDate: string | null;
} {
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
    default:
      return { dateTrunc: 'week', interval: '1 month', startDate: null };
  }
}

async function assertCampusManagerAccess(req: AuthRequest, campusId: string): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Not authenticated');

  if (!campusId || campusId === 'undefined') {
    throw new ApiError(400, 'Valid campusId is required');
  }

  const userResult = await pool.query(`SELECT role, "campusId" FROM users WHERE id = $1`, [userId]);
  if (userResult.rows.length === 0) throw new ApiError(401, 'User not found');

  const { role, campusId: userCampusId } = userResult.rows[0];
  if (role === 'ADMIN') return;
  if (role === 'CAMPUS_MANAGER' && userCampusId === campusId) return;

  const managerCheck = await pool.query(
    `SELECT b.id FROM barbers b
     JOIN users u ON b."userId" = u.id
     WHERE b."userId" = $1
       AND b."campusId" = $2
       AND (b."isCampusManager" = true OR u.role = 'CAMPUS_MANAGER')`,
    [userId, campusId]
  );

  if (managerCheck.rows.length === 0) {
    throw new ApiError(403, 'Campus manager access required');
  }
}

/**
 * Campus performance snapshot for Campus Manager dashboard.
 * GET /api/v1/campus-manager/campus/:campusId/performance
 */
export async function getCampusManagerPerformance(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { campusId } = req.params;
    await assertCampusManagerAccess(req, campusId);

    const barbersResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE b."isActive" = true) as active
       FROM barbers b
       JOIN users u ON b."userId" = u.id
       WHERE u."campusId" = $1::uuid AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')`,
      [campusId]
    );

    const consumersResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid`,
      [campusId]
    );

    const bookingsResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
       FROM bookings
       WHERE "barberId" IN (
         SELECT b.id FROM barbers b
         JOIN users u ON b."userId" = u.id
         WHERE u."campusId" = $1::uuid
       )`,
      [campusId]
    );

    const revenueResult = await pool.query(
      `SELECT
        COALESCE(SUM("totalPaidCents"), 0) as total_revenue,
        COALESCE(SUM("tipAmountCents"), 0) as total_tips,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) as card_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL) as card_count,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'cash'), 0) as cash_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'cash') as cash_count
       FROM bookings
       WHERE status IN ('COMPLETED', 'PAID')
       AND "barberId" IN (
         SELECT b.id FROM barbers b
         JOIN users u ON b."userId" = u.id
         WHERE u."campusId" = $1::uuid
       )`,
      [campusId]
    );

    const ratingsResult = await pool.query(
      `SELECT
        COALESCE(AVG("reviewRating"), 0) as avg_rating,
        COUNT("reviewRating") as total_reviews
       FROM bookings
       WHERE "reviewRating" IS NOT NULL
       AND "barberId" IN (
         SELECT b.id FROM barbers b
         JOIN users u ON b."userId" = u.id
         WHERE u."campusId" = $1::uuid
       )`,
      [campusId]
    );

    const avgDailyBookingsResult = await pool.query(
      `SELECT COALESCE(AVG(daily_count), 0) as avg_daily
       FROM (
         SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as daily_count
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '30 days'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('day', "createdAt")
       ) daily_counts`,
      [campusId]
    );

    const avgWeeklyBookingsResult = await pool.query(
      `SELECT COALESCE(AVG(weekly_count), 0) as avg_weekly
       FROM (
         SELECT DATE_TRUNC('week', "createdAt") as week, COUNT(*) as weekly_count
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '12 weeks'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('week', "createdAt")
       ) weekly_counts`,
      [campusId]
    );

    const avgMonthlyBookingsResult = await pool.query(
      `SELECT COALESCE(AVG(monthly_count), 0) as avg_monthly
       FROM (
         SELECT DATE_TRUNC('month', "createdAt") as month, COUNT(*) as monthly_count
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '12 months'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('month', "createdAt")
       ) monthly_counts`,
      [campusId]
    );

    const avgDailyRevenueResult = await pool.query(
      `SELECT COALESCE(AVG(daily_revenue), 0) as avg_daily
       FROM (
         SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalPaidCents") as daily_revenue
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '30 days'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('day', "createdAt")
       ) daily_revenues`,
      [campusId]
    );

    const avgWeeklyRevenueResult = await pool.query(
      `SELECT COALESCE(AVG(weekly_revenue), 0) as avg_weekly
       FROM (
         SELECT DATE_TRUNC('week', "createdAt") as week, SUM("totalPaidCents") as weekly_revenue
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '12 weeks'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('week', "createdAt")
       ) weekly_revenues`,
      [campusId]
    );

    const avgMonthlyRevenueResult = await pool.query(
      `SELECT COALESCE(AVG(monthly_revenue), 0) as avg_monthly
       FROM (
         SELECT DATE_TRUNC('month', "createdAt") as month, SUM("totalPaidCents") as monthly_revenue
         FROM bookings
         WHERE status IN ('COMPLETED', 'PAID')
         AND "createdAt" >= NOW() - INTERVAL '12 months'
         AND "barberId" IN (
           SELECT b.id FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1::uuid
         )
         GROUP BY DATE_TRUNC('month', "createdAt")
       ) monthly_revenues`,
      [campusId]
    );

    const completedBookings = parseIntSafe(bookingsResult.rows[0]?.completed);
    const cancelledBookings = parseIntSafe(bookingsResult.rows[0]?.cancelled);
    const totalRevenue = parseIntSafe(revenueResult.rows[0]?.total_revenue);
    const completionRatePct =
      completedBookings + cancelledBookings > 0
        ? (completedBookings / (completedBookings + cancelledBookings)) * 100
        : 0;

    res.json({
      success: true,
      data: {
        totalBarbers: parseIntSafe(barbersResult.rows[0]?.total),
        activeBarbers: parseIntSafe(barbersResult.rows[0]?.active),
        totalConsumers: parseIntSafe(consumersResult.rows[0]?.total),
        totalBookings: parseIntSafe(bookingsResult.rows[0]?.total),
        completedBookings,
        cancelledBookings,
        totalRevenue,
        totalTips: parseIntSafe(revenueResult.rows[0]?.total_tips),
        cardRevenue: parseIntSafe(revenueResult.rows[0]?.card_revenue),
        cardCount: parseIntSafe(revenueResult.rows[0]?.card_count),
        cashRevenue: parseIntSafe(revenueResult.rows[0]?.cash_revenue),
        cashCount: parseIntSafe(revenueResult.rows[0]?.cash_count),
        averageRating: parseFloat(String(ratingsResult.rows[0]?.avg_rating || 0)),
        totalReviews: parseIntSafe(ratingsResult.rows[0]?.total_reviews),
        completionRatePct,
        averageBookingsPerDay: parseFloat(String(avgDailyBookingsResult.rows[0]?.avg_daily || 0)),
        averageBookingsPerWeek: parseFloat(String(avgWeeklyBookingsResult.rows[0]?.avg_weekly || 0)),
        averageBookingsPerMonth: parseFloat(String(avgMonthlyBookingsResult.rows[0]?.avg_monthly || 0)),
        averageRevenuePerDay: parseIntSafe(avgDailyRevenueResult.rows[0]?.avg_daily),
        averageRevenuePerWeek: parseIntSafe(avgWeeklyRevenueResult.rows[0]?.avg_weekly),
        averageRevenuePerMonth: parseIntSafe(avgMonthlyRevenueResult.rows[0]?.avg_monthly),
        averageCostPerAppointment: completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Campus time-series metrics for Campus Manager chart.
 * GET /api/v1/campus-manager/campus/:campusId/metrics?period=daily|weekly|monthly
 */
export async function getCampusManagerMetrics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { campusId } = req.params;
    const period = (req.query.period as string) || 'weekly';
    await assertCampusManagerAccess(req, campusId);

    const { dateTrunc, interval, startDate } = parseMetricsPeriod(period);

    const campusResult = await pool.query(
      `SELECT c.timezone, array_agg(b.id) as barber_ids
       FROM campuses c
       LEFT JOIN users u ON u."campusId" = c.id
       LEFT JOIN barbers b ON b."userId" = u.id
       WHERE c.id = $1::uuid
       GROUP BY c.id`,
      [campusId]
    );

    if (campusResult.rows.length === 0) {
      throw new ApiError(404, 'Campus not found');
    }

    const campusTimezone = campusResult.rows[0].timezone || 'America/Los_Angeles';
    const barberIds = (campusResult.rows[0].barber_ids || []).filter((id: string | null) => id !== null);

    if (barberIds.length === 0) {
      return res.json({ success: true, period, data: [], totalUsers: 0 });
    }

    let metricsResult;
    let usersResult;

    if (interval) {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = ANY($2::uuid[])
           AND COALESCE("paidAt", "updatedAt") >= NOW() - $3::interval
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberIds, interval, campusTimezone]
      );
      usersResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $4) AS period_start,
          COUNT(*) AS users
         FROM users
         WHERE role = 'CONSUMER'
           AND "campusId" = $2::uuid
           AND "createdAt" >= NOW() - $3::interval
         GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, campusId, interval, campusTimezone]
      );
    } else if (startDate) {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4) AS period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = ANY($2::uuid[])
           AND COALESCE("paidAt", "updatedAt") >= $3::timestamp
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, barberIds, startDate, campusTimezone]
      );
      usersResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $4) AS period_start,
          COUNT(*) AS users
         FROM users
         WHERE role = 'CONSUMER'
           AND "campusId" = $2::uuid
           AND "createdAt" >= $3::timestamp
         GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $4)
         ORDER BY period_start ASC`,
        [dateTrunc, campusId, startDate, campusTimezone]
      );
    } else {
      metricsResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3) AS period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) AS bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) AS revenue
         FROM bookings
         WHERE "barberId" = ANY($2::uuid[])
         GROUP BY DATE_TRUNC($1, COALESCE("paidAt", "updatedAt") AT TIME ZONE $3)
         ORDER BY period_start ASC`,
        [dateTrunc, barberIds, campusTimezone]
      );
      usersResult = await pool.query(
        `SELECT
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $3) AS period_start,
          COUNT(*) AS users
         FROM users
         WHERE role = 'CONSUMER'
           AND "campusId" = $2::uuid
         GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $3)
         ORDER BY period_start ASC`,
        [dateTrunc, campusId, campusTimezone]
      );
    }

    const bookingsMap = new Map(
      metricsResult.rows.map((row) => [
        row.period_start?.toISOString(),
        { bookings: parseIntSafe(row.bookings), revenue: parseIntSafe(row.revenue) },
      ])
    );
    const usersMap = new Map(
      usersResult.rows.map((row) => [row.period_start?.toISOString(), parseIntSafe(row.users)])
    );

    const allDates = new Set<string>([...bookingsMap.keys(), ...usersMap.keys()].filter(Boolean) as string[]);
    const data = Array.from(allDates)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateKey) => ({
        date: dateKey,
        bookings: bookingsMap.get(dateKey)?.bookings || 0,
        revenue: bookingsMap.get(dateKey)?.revenue || 0,
        users: usersMap.get(dateKey) || 0,
      }));

    const totalUsersResult = await pool.query(
      interval
        ? `SELECT COUNT(*) AS total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid AND "createdAt" >= NOW() - $2::interval`
        : startDate
          ? `SELECT COUNT(*) AS total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid AND "createdAt" >= $2::timestamp`
          : `SELECT COUNT(*) AS total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid`,
      interval ? [campusId, interval] : startDate ? [campusId, startDate] : [campusId]
    );

    res.json({
      success: true,
      period,
      data,
      totalUsers: parseIntSafe(totalUsersResult.rows[0]?.total),
    });
  } catch (error) {
    next(error);
  }
}
