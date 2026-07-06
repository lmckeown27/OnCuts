/**
 * Pricing API Controller — PostgreSQL-backed dynamic pricing.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import dynamicPricingService, { PricingInput } from '../services/dynamic-pricing.service';

async function getBarberPricingStats(barberId: string): Promise<{
  avgRating: number;
  totalBookings: number;
  avgPrice: number;
  bookingsLast24h: number;
}> {
  const result = await pool.query(
    `SELECT
       COALESCE(AVG("reviewRating") FILTER (WHERE "reviewRating" IS NOT NULL), 3.5)::float AS avg_rating,
       COUNT(*)::int AS total_bookings,
       COALESCE(AVG("totalPaidCents") FILTER (WHERE "totalPaidCents" > 0), 2500)::float / 100 AS avg_price,
       COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours')::int AS bookings_last_24h
     FROM bookings
     WHERE "barberId" = $1`,
    [barberId]
  );
  const row = result.rows[0] || {};
  return {
    avgRating: row.avg_rating ?? 3.5,
    totalBookings: row.total_bookings ?? 0,
    avgPrice: row.avg_price ?? 25,
    bookingsLast24h: row.bookings_last_24h ?? 0,
  };
}

async function barberExists(barberId: string): Promise<boolean> {
  const result = await pool.query('SELECT id FROM barbers WHERE id = $1', [barberId]);
  return result.rows.length > 0;
}

export async function getPriceEstimate(req: Request, res: Response) {
  try {
    const { barberAddress, barberId, serviceCategory, marketType } = req.query;
    const resolvedBarberId = (barberId || barberAddress) as string;

    if (!resolvedBarberId || !serviceCategory) {
      return res.status(400).json({
        success: false,
        message: 'barberId (or barberAddress) and serviceCategory are required',
      });
    }

    if (!(await barberExists(resolvedBarberId))) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found',
      });
    }

    const stats = await getBarberPricingStats(resolvedBarberId);

    const pricingInput: PricingInput = {
      barber_rating: stats.avgRating,
      barber_completion_rate: 0.9,
      barber_total_bookings: stats.totalBookings,
      barber_avg_price: stats.avgPrice,
      barbers_available_count: 5,
      bookings_last_24h: stats.bookingsLast24h,
      market_type: (marketType as any) || 'medium_campus',
      time_of_day: dynamicPricingService.getCurrentTimeCategory(),
      service_category: serviceCategory as any,
      estimated_duration_minutes: 30,
    };

    const pricing = dynamicPricingService.calculatePrice(pricingInput);

    return res.json({
      success: true,
      data: {
        barberId: resolvedBarberId,
        serviceCategory,
        finalPriceUsd: pricing.recommended_price,
        finalPriceCents: Math.round(pricing.recommended_price * 100),
        priceFloor: pricing.price_floor,
        priceCeiling: pricing.price_ceiling,
        confidence: pricing.confidence,
        breakdown: pricing.breakdown,
        reasoning: pricing.reasoning,
      },
    });
  } catch (error: any) {
    logger.error('Error getting price estimate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get price estimate',
      error: error.message,
    });
  }
}

export async function getBarberScore(req: Request, res: Response) {
  try {
    const { barberId } = req.params;

    if (!(await barberExists(barberId))) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found',
      });
    }

    const stats = await getBarberPricingStats(barberId);

    return res.json({
      success: true,
      data: {
        barberId,
        performanceScore: Math.round((stats.avgRating / 5) * 100),
        rating: stats.avgRating,
        completionRate: 0.9,
        totalBookings: stats.totalBookings,
        avgPrice: stats.avgPrice,
      },
    });
  } catch (error: any) {
    logger.error('Error getting barber score:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get barber score',
      error: error.message,
    });
  }
}

export async function getBarberPriceHistory(req: Request, res: Response) {
  try {
    const { barberId } = req.params;

    const result = await pool.query(
      `SELECT "createdAt" AS date,
              COALESCE("totalPaidCents", 0)::float / 100 AS price,
              service_name AS service_type
       FROM bookings
       WHERE "barberId" = $1 AND COALESCE("totalPaidCents", 0) > 0
       ORDER BY "createdAt" DESC
       LIMIT 100`,
      [barberId]
    );

    const priceHistory = result.rows.map((row) => ({
      date: row.date,
      price: row.price,
      serviceType: row.service_type,
    }));

    return res.json({
      success: true,
      data: {
        barberId,
        history: priceHistory,
        avgPrice: priceHistory.length > 0
          ? priceHistory.reduce((sum, b) => sum + b.price, 0) / priceHistory.length
          : 0,
      },
    });
  } catch (error: any) {
    logger.error('Error getting barber price history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get price history',
      error: error.message,
    });
  }
}

export async function getServices(req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      data: {
        services: [
          { id: 1, category: 'basic', name: 'Basic Cut', basePrice: 15, duration: 20, description: 'Simple haircut, quick and efficient' },
          { id: 2, category: 'standard', name: 'Regular Haircut', basePrice: 25, duration: 35, description: 'Standard haircut with styling' },
          { id: 3, category: 'premium', name: 'Premium Service', basePrice: 40, duration: 60, description: 'Detailed cut with wash and styling' },
        ],
      },
    });
  } catch (error: any) {
    logger.error('Error getting services:', error);
    return res.status(500).json({ success: false, message: 'Failed to get services', error: error.message });
  }
}

export async function getConfig(req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      config: {
        base_prices: { basic: 15, standard: 25, premium: 40 },
        market_multipliers: { small_campus: 0.85, medium_campus: 1.0, large_campus: 1.15, metro: 1.35 },
        time_multipliers: { morning: 0.95, afternoon: 1.0, evening: 1.15, night: 0.9, weekend: 1.2 },
        weights: { quality: 0.3, demand: 0.4, time: 0.2, market: 0.1 },
      },
    });
  } catch (error: any) {
    logger.error('Error getting pricing config:', error);
    return res.status(500).json({ success: false, message: 'Failed to get pricing config', error: error.message });
  }
}

export async function getCampusMetrics(req: Request, res: Response) {
  try {
    const { campusId } = req.params;

    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM barbers b JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1)::int AS total_barbers,
         (SELECT COUNT(*) FROM bookings bk JOIN barbers b ON bk."barberId" = b.id JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1)::int AS total_bookings,
         (SELECT COUNT(*) FROM bookings bk JOIN barbers b ON bk."barberId" = b.id JOIN users u ON b."userId" = u.id WHERE u."campusId" = $1 AND bk."createdAt" > NOW() - INTERVAL '24 hours')::int AS bookings_last_24h`,
      [campusId]
    );

    const row = stats.rows[0] || {};

    return res.json({
      success: true,
      data: {
        campusId,
        totalBarbers: row.total_barbers ?? 0,
        totalBookings: row.total_bookings ?? 0,
        avgPrice: 25,
        bookingsLast24h: row.bookings_last_24h ?? 0,
      },
    });
  } catch (error: any) {
    logger.error('Error getting campus metrics:', error);
    return res.status(500).json({ success: false, message: 'Failed to get campus metrics', error: error.message });
  }
}

export async function triggerRecompute(req: Request, res: Response) {
  try {
    logger.info('Pricing recompute triggered (dynamic pricing — no batch recompute needed)');
    return res.json({
      success: true,
      message: 'Pricing is calculated dynamically — no recompute needed',
    });
  } catch (error: any) {
    logger.error('Error in recompute trigger:', error);
    return res.status(500).json({ success: false, message: 'Failed to trigger recompute', error: error.message });
  }
}

export async function getAnomalies(req: Request, res: Response) {
  try {
    return res.json({
      success: true,
      data: { anomalies: [], message: 'Anomaly detection not yet implemented' },
    });
  } catch (error: any) {
    logger.error('Error getting anomalies:', error);
    return res.status(500).json({ success: false, message: 'Failed to get anomalies', error: error.message });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    return res.json({
      success: false,
      message: 'Config updates not yet implemented',
    });
  } catch (error: any) {
    logger.error('Error updating config:', error);
    return res.status(500).json({ success: false, message: 'Failed to update config', error: error.message });
  }
}
