/**
 * AI Controller
 * 
 * Exposes AI-generated data through backend API
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import aiService from '../services/ai.service';

/**
 * GET /api/ai/barber/:barberId/pricing
 * Get AI-generated pricing multiplier for barber
 */
export async function getBarberPricing(req: Request, res: Response) {
  try {
    const { barberId } = req.params;
    const pricingData = await aiService.getBarberPricing(barberId);
    res.json(pricingData);
  } catch (error) {
    logger.error('Get barber pricing error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch barber pricing',
      multiplier: 1.0,
      isDefault: true 
    });
  }
}

/**
 * GET /api/ai/barber/:barberId/quality
 * Get AI-generated quality score for barber
 */
export async function getBarberQuality(req: Request, res: Response) {
  try {
    const { barberId } = req.params;
    const qualityData = await aiService.getBarberQualityScore(barberId);
    res.json(qualityData);
  } catch (error) {
    logger.error('Get barber quality error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quality score',
      qualityScore: 50,
      isDefault: true 
    });
  }
}

/**
 * GET /api/ai/barber/:barberId/history
 * Get barber's pricing and quality history
 */
export async function getBarberHistory(req: Request, res: Response) {
  try {
    const { barberId } = req.params;
    const { limit = 30 } = req.query;
    const history = await aiService.getBarberHistory(barberId, Number(limit));
    res.json(history);
  } catch (error) {
    logger.error('Get barber history error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch barber history',
      pricing: [],
      quality: [] 
    });
  }
}

/**
 * POST /api/ai/booking/calculate-price
 * Calculate booking price with AI multiplier
 */
export async function calculateBookingPrice(req: Request, res: Response) {
  try {
    const { barberId, basePrice } = req.body;

    if (!barberId || !basePrice) {
      return res.status(400).json({ 
        error: 'barberId and basePrice are required' 
      });
    }

    const priceData = await aiService.calculateBookingPrice(barberId, basePrice);
    res.json(priceData);
  } catch (error) {
    logger.error('Calculate booking price error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate price',
      multiplier: 1.0 
    });
  }
}

/**
 * GET /api/ai/admin/market-summary
 * Get market summary for admin dashboard
 */
export async function getMarketSummary(req: Request, res: Response) {
  try {
    const summary = await aiService.getMarketSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Get market summary error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market summary' 
    });
  }
}

/**
 * GET /api/ai/admin/fraud-flags
 * Get fraud detection flags
 */
export async function getFraudFlags(req: Request, res: Response) {
  try {
    const { status = 'PENDING', limit = 50 } = req.query;
    const flags = await aiService.getFraudFlags(String(status), Number(limit));
    res.json(flags);
  } catch (error) {
    logger.error('Get fraud flags error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch fraud flags',
      flags: [] 
    });
  }
}

/**
 * GET /api/ai/admin/disputes
 * Get dispute recommendations
 */
export async function getDisputes(req: Request, res: Response) {
  try {
    const { limit = 50 } = req.query;
    const disputes = await aiService.getDisputes(Number(limit));
    res.json(disputes);
  } catch (error) {
    logger.error('Get disputes error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch disputes',
      disputes: [] 
    });
  }
}

/**
 * GET /api/ai/admin/dashboard
 * Complete admin dashboard data with AI insights
 */
export async function getAdminDashboard(req: Request, res: Response) {
  try {
    const [marketSummary, fraudFlags, disputes] = await Promise.all([
      aiService.getMarketSummary(),
      aiService.getFraudFlags('PENDING', 10),
      aiService.getDisputes(10),
    ]);

    res.json({
      marketSummary,
      fraudAlerts: fraudFlags.flags,
      disputes: disputes.disputes,
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error('Get admin dashboard error:', error);
    res.status(500).json({ 
      error: 'Failed to load admin dashboard' 
    });
  }
}

/**
 * GET /api/ai/barber/:barberId/analytics
 * Complete barber analytics with AI data
 */
export async function getBarberAnalytics(req: Request, res: Response) {
  try {
    const { barberId } = req.params;

    const [pricing, qualityScore, history] = await Promise.all([
      aiService.getBarberPricing(barberId),
      aiService.getBarberQualityScore(barberId),
      aiService.getBarberHistory(barberId, 30),
    ]);

    res.json({
      barberId,
      currentPricing: pricing,
      currentQuality: qualityScore,
      history,
    });
  } catch (error) {
    logger.error('Get barber analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to load barber analytics' 
    });
  }
}

