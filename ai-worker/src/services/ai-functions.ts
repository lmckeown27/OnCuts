/**
 * AI Functions - Direct callable functions for backend integration
 * 
 * These functions accept database query function and logger as parameters
 * Uses backend's existing resources instead of creating its own
 */

// Type definitions for backend resources
export interface AIFunctionDeps {
  query: (text: string, params?: any[]) => Promise<any>;
  logger: {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
}

/**
 * Get barber pricing multiplier
 * Direct function - no HTTP call needed
 */
export async function getBarberPricing(barberId: string, deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const result = await query(
      `SELECT 
        multiplier, 
        base_multiplier,
        campus_coefficient,
        demand_factor,
        quality_factor,
        reasoning,
        expires_at,
        created_at
       FROM barber_pricing_multipliers
       WHERE barber_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [barberId]
    );

    if (result.rows.length === 0) {
      return { 
        barberId,
        multiplier: 1.0,
        isDefault: true,
        reasoning: 'No AI pricing data yet, using default multiplier'
      };
    }

    return {
      barberId,
      multiplier: parseFloat(result.rows[0].multiplier),
      breakdown: {
        base: parseFloat(result.rows[0].base_multiplier),
        campusCoefficient: parseFloat(result.rows[0].campus_coefficient),
        demandFactor: parseFloat(result.rows[0].demand_factor),
        qualityFactor: parseFloat(result.rows[0].quality_factor),
      },
      reasoning: result.rows[0].reasoning,
      expiresAt: result.rows[0].expires_at,
      updatedAt: result.rows[0].created_at,
    };
  } catch (error) {
    logger.error('Error fetching barber pricing:', error);
    return {
      barberId,
      multiplier: 1.0,
      isDefault: true,
      error: true,
    };
  }
}

/**
 * Get barber quality score
 * Direct function - no HTTP call needed
 */
export async function getBarberQualityScore(barberId: string, deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const result = await query(
      `SELECT 
        quality_score,
        sentiment_score,
        reasoning,
        factors,
        created_at
       FROM barber_quality_scores
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [barberId]
    );

    if (result.rows.length === 0) {
      return { 
        barberId,
        qualityScore: 50,
        isDefault: true,
        reasoning: 'No AI quality data yet, using default score'
      };
    }

    return {
      barberId,
      qualityScore: parseFloat(result.rows[0].quality_score),
      sentimentScore: parseFloat(result.rows[0].sentiment_score),
      reasoning: result.rows[0].reasoning,
      factors: result.rows[0].factors,
      updatedAt: result.rows[0].created_at,
    };
  } catch (error) {
    logger.error('Error fetching quality score:', error);
    return {
      barberId,
      qualityScore: 50,
      isDefault: true,
      error: true,
    };
  }
}

/**
 * Get barber history
 * Direct function - no HTTP call needed
 */
export async function getBarberHistory(barberId: string, limit: number, deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const pricingResult = await query(
      `SELECT multiplier, created_at
       FROM barber_pricing_multipliers
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [barberId, limit]
    );

    const qualityResult = await query(
      `SELECT quality_score, created_at
       FROM barber_quality_scores
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [barberId, limit]
    );

    return {
      barberId,
      pricing: pricingResult.rows.map((r: any) => ({
        multiplier: parseFloat(r.multiplier),
        date: r.created_at,
      })),
      quality: qualityResult.rows.map((r: any) => ({
        score: parseFloat(r.quality_score),
        date: r.created_at,
      })),
    };
  } catch (error) {
    logger.error('Error fetching barber history:', error);
    return { barberId, pricing: [], quality: [] };
  }
}

/**
 * Get market summary
 * Direct function - no HTTP call needed
 */
export async function getMarketSummary(deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const marketStats = await query(
      `SELECT 
        campus_id,
        demand_index,
        active_barbers,
        active_customers,
        booking_velocity,
        supply_demand_ratio,
        insights,
        week_start,
        created_at
       FROM market_stats
       WHERE week_start = (SELECT MAX(week_start) FROM market_stats)
       ORDER BY demand_index DESC`
    );

    const fraudAlerts = await query(
      `SELECT COUNT(*) as count, risk_level
       FROM fraud_flags
       WHERE status = 'PENDING' AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY risk_level`
    );

    const disputes = await query(
      `SELECT COUNT(*) as count
       FROM dispute_recommendations
       WHERE created_at >= NOW() - INTERVAL '7 days' AND admin_decision IS NULL`
    );

    return {
      campuses: marketStats.rows.map((row: any) => ({
        campusId: row.campus_id,
        demandIndex: parseFloat(row.demand_index),
        activeBarbers: parseInt(row.active_barbers),
        activeCustomers: parseInt(row.active_customers),
        bookingVelocity: parseFloat(row.booking_velocity),
        supplyDemandRatio: parseFloat(row.supply_demand_ratio),
        insights: row.insights,
        weekStart: row.week_start,
      })),
      fraudAlerts: fraudAlerts.rows.reduce((acc: any, row: any) => {
        acc[row.risk_level] = parseInt(row.count);
        return acc;
      }, {}),
      pendingDisputes: parseInt(disputes.rows[0]?.count) || 0,
      lastUpdated: marketStats.rows[0]?.created_at,
    };
  } catch (error) {
    logger.error('Error fetching market summary:', error);
    return null;
  }
}

/**
 * Get fraud flags
 * Direct function - no HTTP call needed
 */
export async function getFraudFlags(status: string, limit: number, deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const result = await query(
      `SELECT 
        id,
        user_id,
        risk_score,
        risk_level,
        fraud_indicators,
        pattern_type,
        confidence,
        recommended_action,
        status,
        created_at
       FROM fraud_flags
       WHERE status = $1
       ORDER BY risk_score DESC, created_at DESC
       LIMIT $2`,
      [status, limit]
    );

    return {
      flags: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        riskScore: parseFloat(row.risk_score),
        riskLevel: row.risk_level,
        fraudIndicators: row.fraud_indicators,
        patternType: row.pattern_type,
        confidence: parseFloat(row.confidence),
        recommendedAction: row.recommended_action,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    logger.error('Error fetching fraud flags:', error);
    return { flags: [] };
  }
}

/**
 * Get disputes
 * Direct function - no HTTP call needed
 */
export async function getDisputes(limit: number, deps: AIFunctionDeps) {
  const { query, logger } = deps;
  try {
    const result = await query(
      `SELECT 
        id,
        booking_id,
        barber_id,
        customer_id,
        at_fault,
        confidence,
        recommended_action,
        refund_percentage,
        reasoning,
        evidence_analyzed,
        admin_decision,
        created_at
       FROM dispute_recommendations
       WHERE admin_decision IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return {
      disputes: result.rows.map((row: any) => ({
        id: row.id,
        bookingId: row.booking_id,
        barberId: row.barber_id,
        customerId: row.customer_id,
        atFault: row.at_fault,
        confidence: parseFloat(row.confidence),
        recommendedAction: row.recommended_action,
        refundPercentage: parseFloat(row.refund_percentage),
        reasoning: row.reasoning,
        evidenceAnalyzed: row.evidence_analyzed,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    logger.error('Error fetching disputes:', error);
    return { disputes: [] };
  }
}

/**
 * Calculate booking price with AI multiplier
 * Direct function - called during booking creation
 */
export async function calculateBookingPrice(barberId: string, basePrice: number, deps: AIFunctionDeps) {
  const { logger } = deps;
  try {
    const pricingData = await getBarberPricing(barberId, deps);
    const finalPrice = Math.round(basePrice * pricingData.multiplier * 100) / 100;
    const platformFee = Math.round(finalPrice * 0.05 * 100) / 100;

    return {
      basePrice,
      multiplier: pricingData.multiplier,
      finalPrice,
      platformFee,
      barberReceives: Math.round((finalPrice - platformFee) * 100) / 100,
      reasoning: pricingData.reasoning,
      breakdown: pricingData.breakdown,
    };
  } catch (error) {
    logger.error('Error calculating booking price:', error);
    return {
      basePrice,
      multiplier: 1.0,
      finalPrice: basePrice,
      platformFee: Math.round(basePrice * 0.05 * 100) / 100,
      barberReceives: Math.round(basePrice * 0.95 * 100) / 100,
      error: true,
    };
  }
}

// Export type for use in backend
export type { AIFunctionDeps };

