/**
 * Market Calibration Module
 * 
 * Applies market-specific factors to BQS and ranking calculations
 * 
 * Large markets (LA): Higher competition, more dramatic pricing
 * Small markets (SLO): Lower variation, lower ceilings
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

interface MarketFactors {
  marketId: string;
  marketName: string;
  demandNormalizationFactor: number;
  reviewWeightAdjustment: number;
  competitionIntensityScore: number;
}

interface CalibratedBQS {
  rawBQS: number;
  calibratedBQS: number;
  marketFactors: MarketFactors;
}

export class MarketCalibrationService {
  /**
   * Get market factors
   */
  async getMarketFactors(marketId: string): Promise<MarketFactors> {
    // market_factors table removed — always use neutral defaults.
    let marketName = 'Unknown';
    try {
      const result = await pool.query(`SELECT name FROM markets WHERE market_id = $1`, [marketId]);
      if (result.rows[0]?.name) marketName = String(result.rows[0].name);
    } catch {
      // markets table may be absent; keep Unknown
    }
    return {
      marketId,
      marketName,
      demandNormalizationFactor: 1.0,
      reviewWeightAdjustment: 1.0,
      competitionIntensityScore: 1.0,
    };
  }

  /**
   * Apply market calibration to BQS
   * Adjusts BQS based on market factors
   */
  calibrateBQS(rawBQS: number, marketFactors: MarketFactors): CalibratedBQS {
    // Apply review weight adjustment (affects review component more in small markets)
    // Apply competition intensity (makes scores more spread out in competitive markets)
    
    let calibratedBQS = rawBQS;

    // In highly competitive markets, amplify differences
    if (marketFactors.competitionIntensityScore > 1.0) {
      // Amplify distance from median (50)
      const distanceFrom50 = rawBQS - 50;
      calibratedBQS = 50 + (distanceFrom50 * marketFactors.competitionIntensityScore);
    }

    // In small markets, compress differences
    if (marketFactors.competitionIntensityScore < 1.0) {
      const distanceFrom50 = rawBQS - 50;
      calibratedBQS = 50 + (distanceFrom50 * marketFactors.competitionIntensityScore);
    }

    // Clamp to 0-100
    calibratedBQS = Math.min(Math.max(calibratedBQS, 0), 100);

    return {
      rawBQS,
      calibratedBQS: Math.round(calibratedBQS * 100) / 100,
      marketFactors,
    };
  }

  /**
   * Update market factors (admin control)
   */
  async updateMarketFactors(
    _marketId: string,
    _factors: Partial<{
      demandNormalizationFactor: number;
      reviewWeightAdjustment: number;
      competitionIntensityScore: number;
    }>
  ): Promise<void> {
    throw new Error('market_factors table has been removed; market calibration factors are no longer stored');
  }

  /**
   * Get all markets with their factors
   */
  async getAllMarketsWithFactors() {
    try {
      const result = await pool.query(`
        SELECT 
          m.market_id,
          m.name,
          m.city,
          m.state,
          m.base_price,
          m.average_price,
          m.premium_price_ceiling,
          (SELECT COUNT(*) FROM barbers WHERE market_id = m.market_id AND is_active = true) as active_barbers
        FROM markets m
        ORDER BY m.name
      `);

      return result.rows.map(row => ({
        marketId: row.market_id,
        name: row.name,
        city: row.city,
        state: row.state,
        basePrice: parseFloat(row.base_price),
        averagePrice: parseFloat(row.average_price),
        premiumPriceCeiling: parseFloat(row.premium_price_ceiling),
        demandNormalizationFactor: 1.0,
        reviewWeightAdjustment: 1.0,
        competitionIntensityScore: 1.0,
        activeBarbers: parseInt(row.active_barbers) || 0,
      }));
    } catch (error) {
      logger.error('Error getting markets with factors:', error);
      throw error;
    }
  }

  /**
   * Update market config (prices)
   */
  async updateMarketConfig(
    marketId: string,
    config: Partial<{
      basePrice: number;
      averagePrice: number;
      premiumPriceCeiling: number;
    }>
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (config.basePrice !== undefined) {
        updates.push(`base_price = $${paramIndex++}`);
        values.push(config.basePrice);
      }

      if (config.averagePrice !== undefined) {
        updates.push(`average_price = $${paramIndex++}`);
        values.push(config.averagePrice);
      }

      if (config.premiumPriceCeiling !== undefined) {
        updates.push(`premium_price_ceiling = $${paramIndex++}`);
        values.push(config.premiumPriceCeiling);
      }

      if (updates.length === 0) {
        throw new Error('No config to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(marketId);

      await pool.query(`
        UPDATE markets
        SET ${updates.join(', ')}
        WHERE market_id = $${paramIndex}
      `, values);

      logger.info(`Updated market config for ${marketId}`);
    } catch (error) {
      logger.error(`Error updating market config for ${marketId}:`, error);
      throw error;
    }
  }
}

export const marketCalibrationService = new MarketCalibrationService();

