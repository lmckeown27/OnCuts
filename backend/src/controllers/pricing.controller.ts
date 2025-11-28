/**
 * Pricing API Controller
 * 
 * Handles all pricing-related API endpoints:
 * - Price estimates for barbers/services
 * - Barber performance scores
 * - Campus market metrics
 * - Pricing configuration
 * - Recompute triggers (admin only)
 * - Anomaly monitoring (admin only)
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import pricingOrchestrator from '../services/pricing/pricing-orchestrator.service';
import priceCalculator from '../services/pricing/price-calculator.service';
import scoringEngine from '../services/pricing/scoring-engine.service';
import marketMetrics from '../services/pricing/market-metrics.service';
import { pool } from '../database/connection';

/**
 * GET /api/pricing/estimate
 * Get current price estimate for a barber/service
 * Query params: barberId, serviceId
 */
export async function getPriceEstimate(req: Request, res: Response) {
  try {
    const { barberId, serviceId } = req.query;

    if (!barberId || !serviceId) {
      return res.status(400).json({
        success: false,
        message: 'barberId and serviceId are required',
      });
    }

    // For mock data, return sample price estimate
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          barberId,
          serviceId: parseInt(serviceId as string),
          finalPriceCents: 3250,
          finalPriceUsd: 32.50,
          breakdown: {
            performanceScore: 87,
            effectiveScore: 89,
            msi: 0.72,
            mdi: 0.58,
            basePrice: 2500,
            priceMultiplier: 1.41,
            marketAdjustment: 1.02,
            computedPrice: 3600,
            finalPrice: 3250,
            minPrice: 2000,
            maxPrice: 3750,
            cappedReason: 'max_price_ceiling',
            priceChangePct: 7.6,
          },
          lastUpdated: new Date(),
        },
      });
    }

    const price = await priceCalculator.getBarberPrice(
      barberId as string,
      parseInt(serviceId as string)
    );

    if (!price) {
      return res.status(404).json({
        success: false,
        message: 'Price not found. Barber may need initial pricing computation.',
      });
    }

    res.json({
      success: true,
      data: {
        ...price,
        finalPriceUsd: price.finalPriceCents / 100,
      },
    });
  } catch (error) {
    logger.error('Failed to get price estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/barber/:barberId/score
 * Get barber's performance score and history
 * Query params: days (default 30)
 */
export async function getBarberScore(req: Request, res: Response) {
  try {
    const { barberId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // For mock data, return sample scores
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          currentScore: {
            barberId,
            periodDate: new Date(),
            qualityScore: 92,
            reliabilityScore: 88,
            demandScore: 75,
            performanceScore: 87,
            effectiveScore: 89,
            isNewBarber: false,
            totalLifetimeBookings: 156,
            breakdown: {
              qualityScore: 92,
              reliabilityScore: 88,
              demandScore: 75,
              performanceScore: 87,
              effectiveScore: 89,
              weights: {
                quality: 0.7,
                reliability: 0.2,
                demand: 0.1,
              },
              isNewBarber: false,
              msi: 0.72,
              mdi: 0.58,
            },
          },
          history: Array.from({ length: Math.min(days, 30) }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            performanceScore: 87 + Math.random() * 10 - 5,
            qualityScore: 92 + Math.random() * 6 - 3,
            reliabilityScore: 88 + Math.random() * 8 - 4,
            demandScore: 75 + Math.random() * 10 - 5,
          })),
        },
      });
    }

    const scoreHistory = await scoringEngine.getBarberScoreHistory(barberId, days);

    if (scoreHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No score history found for this barber',
      });
    }

    res.json({
      success: true,
      data: {
        currentScore: scoreHistory[0],
        history: scoreHistory,
      },
    });
  } catch (error) {
    logger.error('Failed to get barber score:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/barber/:barberId/history
 * Get barber's price history across all services
 * Query params: days (default 30)
 */
export async function getBarberPriceHistory(req: Request, res: Response) {
  try {
    const { barberId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // For mock data, return sample price history
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          services: [
            {
              serviceId: 1,
              serviceName: 'Haircut',
              history: Array.from({ length: Math.min(days, 30) }, (_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
                priceCents: 3250 + Math.floor((Math.random() * 200 - 100)),
                priceUsd: (3250 + Math.floor((Math.random() * 200 - 100))) / 100,
                performanceScore: 87 + Math.random() * 10 - 5,
              })),
            },
            {
              serviceId: 2,
              serviceName: 'Haircut & Fade',
              history: Array.from({ length: Math.min(days, 30) }, (_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
                priceCents: 4500 + Math.floor((Math.random() * 300 - 150)),
                priceUsd: (4500 + Math.floor((Math.random() * 300 - 150))) / 100,
                performanceScore: 87 + Math.random() * 10 - 5,
              })),
            },
          ],
        },
      });
    }

    const result = await pool.query(
      `
      SELECT
        bp.service_id,
        s.name as service_name,
        bp.period_date,
        bp.final_price_cents,
        bp.price_change_pct,
        bs.performance_score
      FROM barber_prices bp
      JOIN services s ON bp.service_id = s.id
      LEFT JOIN barber_scores bs ON bp.barber_id = bs.barber_id AND bp.period_date = bs.period_date
      WHERE bp.barber_id = $1
        AND bp.period_date >= CURRENT_DATE - $2
      ORDER BY bp.service_id, bp.period_date DESC
      `,
      [barberId, days]
    );

    // Group by service
    const serviceMap = new Map();
    result.rows.forEach(row => {
      if (!serviceMap.has(row.service_id)) {
        serviceMap.set(row.service_id, {
          serviceId: row.service_id,
          serviceName: row.service_name,
          history: [],
        });
      }
      serviceMap.get(row.service_id).history.push({
        date: row.period_date,
        priceCents: row.final_price_cents,
        priceUsd: row.final_price_cents / 100,
        priceChangePct: row.price_change_pct ? parseFloat(row.price_change_pct) : null,
        performanceScore: row.performance_score ? parseFloat(row.performance_score) : null,
      });
    });

    res.json({
      success: true,
      data: {
        services: Array.from(serviceMap.values()),
      },
    });
  } catch (error) {
    logger.error('Failed to get price history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/campus/:campusId/metrics
 * Get campus market metrics (admin only)
 */
export async function getCampusMetrics(req: Request, res: Response) {
  try {
    const { campusId } = req.params;

    // For mock data, return sample campus metrics
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          campusId,
          msi: 0.72,
          mdi: 0.58,
          activeBarbers: 12,
          totalBookings30d: 450,
          avgBookingsPerBarber: 37.5,
          lastUpdated: new Date(),
        },
      });
    }

    const metrics = await marketMetrics.getCampusMarketMetrics(campusId);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: 'Campus metrics not found',
      });
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get campus metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * POST /api/pricing/recompute
 * Trigger pricing recompute (admin only)
 * Body: { barberIds?, campusIds?, full? }
 */
export async function triggerRecompute(req: Request, res: Response) {
  try {
    const { barberIds, campusIds, full } = req.body;

    logger.info('Pricing recompute triggered by admin', { barberIds, campusIds, full });

    // For mock data, simulate recompute
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        message: 'Recompute triggered successfully (mock mode - no actual changes)',
        data: {
          jobId: Math.floor(Math.random() * 1000),
          status: 'completed',
          barbersProcessed: campusIds ? campusIds.length * 12 : barberIds?.length || 50,
          pricesUpdated: (campusIds ? campusIds.length * 12 : barberIds?.length || 50) * 4,
          errorsCount: 0,
          durationMs: 3500,
        },
      });
    }

    const result = await pricingOrchestrator.recomputeAll({
      barberIds,
      campusIds,
      full,
    });

    res.json({
      success: true,
      message: 'Pricing recompute completed',
      data: result,
    });
  } catch (error) {
    logger.error('Failed to trigger recompute:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/anomalies
 * Get recent price anomalies (admin only)
 * Query params: limit (default 50), status (default 'open')
 */
export async function getAnomalies(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string || 'open';

    // For mock data, return sample anomalies
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          anomalies: [
            {
              id: 1,
              barberId: 'barber-1',
              barberName: 'Marcus Thompson',
              serviceId: 1,
              serviceName: 'Haircut',
              periodDate: new Date(),
              anomalyType: 'large_increase',
              severity: 'medium',
              oldPriceCents: 3000,
              newPriceCents: 3650,
              priceChangePct: 21.7,
              description: 'Price increased by 21.7%',
              status: 'open',
              createdAt: new Date(),
            },
            {
              id: 2,
              barberId: 'barber-3',
              barberName: 'Alex Chen',
              serviceId: 1,
              serviceName: 'Haircut',
              periodDate: new Date(),
              anomalyType: 'shock_cap_hit',
              severity: 'high',
              oldPriceCents: 2500,
              newPriceCents: 3250,
              priceChangePct: 30.0,
              description: 'Price change capped at shock_protection_increase',
              status: 'open',
              createdAt: new Date(),
            },
          ],
          total: 2,
        },
      });
    }

    const result = await pool.query(
      `
      SELECT
        pa.*,
        b.user_id as barber_user_id,
        u.name as barber_name,
        s.name as service_name
      FROM price_anomalies pa
      JOIN barbers b ON pa.barber_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN services s ON pa.service_id = s.id
      WHERE pa.status = $1
      ORDER BY pa.created_at DESC
      LIMIT $2
      `,
      [status, limit]
    );

    res.json({
      success: true,
      data: {
        anomalies: result.rows,
        total: result.rows.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get anomalies:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/config
 * Get current pricing configuration
 */
export async function getConfig(req: Request, res: Response) {
  try {
    // For mock data, return sample config
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: {
          version: 1,
          qualityWeight: 0.70,
          reliabilityWeight: 0.20,
          demandWeight: 0.10,
          ratingWeight: 0.80,
          repeatRateWeight: 0.20,
          onTimeWeight: 0.70,
          noShowWeight: 0.30,
          minPriceMultiplier: 0.80,
          maxPriceMultiplier: 1.50,
          msiInfluence: 0.30,
          mdiMinAdjustment: 0.90,
          mdiMaxAdjustment: 1.10,
          msiEmaAlpha: 0.20,
          mdiEmaAlpha: 0.20,
          newBarberBookingThreshold: 5,
          newBarberQualityBoost: 0.20,
          maxDailyPriceChangePct: 30.00,
          minPriceChangeThresholdPct: 1.00,
          recomputeFrequencyHours: 24,
        },
      });
    }

    const result = await pool.query(
      `SELECT * FROM pricing_config ORDER BY version DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pricing config not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get config:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * PUT /api/pricing/config
 * Update pricing configuration (admin only)
 */
export async function updateConfig(req: Request, res: Response) {
  try {
    const updates = req.body;

    logger.info('Pricing config update requested by admin', updates);

    // For mock data, just return success
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        message: 'Configuration updated successfully (mock mode - no actual changes)',
        data: {
          ...updates,
          version: 2,
          updatedAt: new Date(),
        },
      });
    }

    // Validate weights sum to 1.0
    const { qualityWeight, reliabilityWeight, demandWeight } = updates;
    if (qualityWeight && reliabilityWeight && demandWeight) {
      const sum = parseFloat(qualityWeight) + parseFloat(reliabilityWeight) + parseFloat(demandWeight);
      if (Math.abs(sum - 1.0) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Quality, reliability, and demand weights must sum to 1.0',
        });
      }
    }

    // Get current config
    const currentResult = await pool.query(
      `SELECT * FROM pricing_config ORDER BY version DESC LIMIT 1`
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pricing config not found',
      });
    }

    const currentConfig = currentResult.rows[0];
    const newVersion = currentConfig.version + 1;

    // Insert new version
    const result = await pool.query(
      `
      INSERT INTO pricing_config (
        version,
        quality_weight,
        reliability_weight,
        demand_weight,
        rating_weight,
        repeat_rate_weight,
        on_time_weight,
        no_show_weight,
        min_price_multiplier,
        max_price_multiplier,
        msi_influence,
        mdi_min_adjustment,
        mdi_max_adjustment,
        msi_ema_alpha,
        mdi_ema_alpha,
        new_barber_booking_threshold,
        new_barber_quality_boost,
        max_daily_price_change_pct,
        min_price_change_threshold_pct,
        recompute_frequency_hours,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
      `,
      [
        newVersion,
        updates.qualityWeight || currentConfig.quality_weight,
        updates.reliabilityWeight || currentConfig.reliability_weight,
        updates.demandWeight || currentConfig.demand_weight,
        updates.ratingWeight || currentConfig.rating_weight,
        updates.repeatRateWeight || currentConfig.repeat_rate_weight,
        updates.onTimeWeight || currentConfig.on_time_weight,
        updates.noShowWeight || currentConfig.no_show_weight,
        updates.minPriceMultiplier || currentConfig.min_price_multiplier,
        updates.maxPriceMultiplier || currentConfig.max_price_multiplier,
        updates.msiInfluence || currentConfig.msi_influence,
        updates.mdiMinAdjustment || currentConfig.mdi_min_adjustment,
        updates.mdiMaxAdjustment || currentConfig.mdi_max_adjustment,
        updates.msiEmaAlpha || currentConfig.msi_ema_alpha,
        updates.mdiEmaAlpha || currentConfig.mdi_ema_alpha,
        updates.newBarberBookingThreshold || currentConfig.new_barber_booking_threshold,
        updates.newBarberQualityBoost || currentConfig.new_barber_quality_boost,
        updates.maxDailyPriceChangePct || currentConfig.max_daily_price_change_pct,
        updates.minPriceChangeThresholdPct || currentConfig.min_price_change_threshold_pct,
        updates.recomputeFrequencyHours || currentConfig.recompute_frequency_hours,
        (req as any).user?.id || 'admin', // TODO: Get from auth middleware
      ]
    );

    // Log audit
    await pool.query(
      `
      INSERT INTO pricing_config_audit (config_id, version, changes, changed_by)
      VALUES ($1, $2, $3, $4)
      `,
      [result.rows[0].id, newVersion, JSON.stringify(updates), (req as any).user?.id || 'admin']
    );

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * GET /api/pricing/services
 * Get all services with base prices
 */
export async function getServices(req: Request, res: Response) {
  try {
    // For mock data, return sample services
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        data: [
          {
            id: 1,
            slug: 'haircut',
            name: 'Haircut',
            description: 'Standard haircut',
            defaultBasePriceCents: 2500,
            defaultBasePriceUsd: 25.00,
            defaultMinPriceCents: 2000,
            defaultMaxPriceCents: 3750,
            isActive: true,
          },
          {
            id: 2,
            slug: 'haircut_fade',
            name: 'Haircut & Fade',
            description: 'Haircut with fade',
            defaultBasePriceCents: 3500,
            defaultBasePriceUsd: 35.00,
            defaultMinPriceCents: 2800,
            defaultMaxPriceCents: 5250,
            isActive: true,
          },
          {
            id: 3,
            slug: 'beard_trim',
            name: 'Beard Trim',
            description: 'Professional beard trimming',
            defaultBasePriceCents: 1500,
            defaultBasePriceUsd: 15.00,
            defaultMinPriceCents: 1200,
            defaultMaxPriceCents: 2250,
            isActive: true,
          },
          {
            id: 4,
            slug: 'full_service',
            name: 'Full Service',
            description: 'Cut + Fade + Beard',
            defaultBasePriceCents: 5000,
            defaultBasePriceUsd: 50.00,
            defaultMinPriceCents: 4000,
            defaultMaxPriceCents: 7500,
            isActive: true,
          },
        ],
      });
    }

    const result = await pool.query(
      `SELECT * FROM services WHERE is_active = true ORDER BY id`
    );

    const services = result.rows.map(row => ({
      ...row,
      defaultBasePriceUsd: row.default_base_price_cents / 100,
      defaultMinPriceUsd: row.default_min_price_cents / 100,
      defaultMaxPriceUsd: row.default_max_price_cents / 100,
    }));

    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    logger.error('Failed to get services:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

