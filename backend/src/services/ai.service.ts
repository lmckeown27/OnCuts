/**
 * AI Service - Direct integration with AI Worker
 * 
 * Imports AI functions and passes backend's database and logger
 * No HTTP calls needed - everything runs in-process
 */

import { logger } from '../utils/logger';
import { pool } from '../database/connection';

// Import AI functions directly from ai-worker
import {
  getBarberPricing as aiGetBarberPricing,
  getBarberQualityScore as aiGetBarberQualityScore,
  getBarberHistory as aiGetBarberHistory,
  getMarketSummary as aiGetMarketSummary,
  getFraudFlags as aiGetFraudFlags,
  getDisputes as aiGetDisputes,
  calculateBookingPrice as aiCalculateBookingPrice,
  AIFunctionDeps,
} from '../../../ai-worker/src/services/ai-functions';

// Import queue functions
import {
  addReviewProcessingJob,
  addFraudDetectionJob,
  addDisputeResolutionJob,
  addBarberOnboardingJob,
  addMarketDemandJob,
} from '../../../ai-worker/src/queues';

// Create dependencies object with backend's resources
const aiDeps: AIFunctionDeps = {
  query: async (text: string, params?: any[]) => {
    const result = await pool.query(text, params);
    return result;
  },
  logger: {
    info: (message: string, ...args: any[]) => logger.info(message, ...args),
    error: (message: string, ...args: any[]) => logger.error(message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
    debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
  },
};

/**
 * Get barber pricing multiplier with AI
 */
export async function getBarberPricing(barberId: string) {
  try {
    return await aiGetBarberPricing(barberId, aiDeps);
  } catch (error) {
    logger.error('AI Service - getBarberPricing error:', error);
    return {
      barberId,
      multiplier: 1.0,
      isDefault: true,
      error: true,
    };
  }
}

/**
 * Get barber quality score from AI
 */
export async function getBarberQualityScore(barberId: string) {
  try {
    return await aiGetBarberQualityScore(barberId, aiDeps);
  } catch (error) {
    logger.error('AI Service - getBarberQualityScore error:', error);
    return {
      barberId,
      qualityScore: 50,
      isDefault: true,
      error: true,
    };
  }
}

/**
 * Get barber pricing and quality history
 */
export async function getBarberHistory(barberId: string, limit = 30) {
  try {
    return await aiGetBarberHistory(barberId, limit, aiDeps);
  } catch (error) {
    logger.error('AI Service - getBarberHistory error:', error);
    return { barberId, pricing: [], quality: [] };
  }
}

/**
 * Calculate booking price with AI multiplier
 */
export async function calculateBookingPrice(barberId: string, basePrice: number) {
  try {
    return await aiCalculateBookingPrice(barberId, basePrice, aiDeps);
  } catch (error) {
    logger.error('AI Service - calculateBookingPrice error:', error);
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

/**
 * Get market summary for admin dashboard
 */
export async function getMarketSummary() {
  try {
    return await aiGetMarketSummary(aiDeps);
  } catch (error) {
    logger.error('AI Service - getMarketSummary error:', error);
    return null;
  }
}

/**
 * Get fraud flags for admin
 */
export async function getFraudFlags(status = 'PENDING', limit = 50) {
  try {
    return await aiGetFraudFlags(status, limit, aiDeps);
  } catch (error) {
    logger.error('AI Service - getFraudFlags error:', error);
    return { flags: [] };
  }
}

/**
 * Get dispute recommendations for admin
 */
export async function getDisputes(limit = 50) {
  try {
    return await aiGetDisputes(limit, aiDeps);
  } catch (error) {
    logger.error('AI Service - getDisputes error:', error);
    return { disputes: [] };
  }
}

/**
 * Trigger AI processing for new review
 */
export async function triggerReviewProcessing(reviewData: {
  reviewId: string;
  barberId: string;
  customerId: string;
  rating: number;
  reviewText: string;
  bookingId: string;
  createdAt: string;
}) {
  try {
    await addReviewProcessingJob(reviewData);
    logger.info(`Review processing queued: ${reviewData.reviewId}`);
  } catch (error) {
    logger.error('Failed to queue review processing:', error);
  }
}

/**
 * Trigger fraud detection for suspicious activity
 */
export async function triggerFraudDetection(
  userId: string, 
  userType: 'barber' | 'customer', 
  reason: string
) {
  try {
    await addFraudDetectionJob({ userId, userType, triggerReason: reason });
    logger.info(`Fraud detection queued for user: ${userId}`);
  } catch (error) {
    logger.error('Failed to queue fraud detection:', error);
  }
}

/**
 * Trigger dispute resolution analysis
 */
export async function triggerDisputeResolution(disputeData: {
  bookingId: string;
  disputeId: string;
  disputeReason: string;
  disputeDescription: string;
}) {
  try {
    await addDisputeResolutionJob(disputeData);
    logger.info(`Dispute resolution queued: ${disputeData.disputeId}`);
  } catch (error) {
    logger.error('Failed to queue dispute resolution:', error);
  }
}

/**
 * Trigger onboarding assessment for new user
 */
export async function triggerOnboardingAssessment(applicationData: any) {
  try {
    await addBarberOnboardingJob(applicationData);
    logger.info(`Onboarding assessment queued for: ${applicationData.userId}`);
  } catch (error) {
    logger.error('Failed to queue onboarding assessment:', error);
  }
}

/**
 * Trigger market demand update for campus
 */
export async function triggerMarketDemandUpdate(campusId: string, campusName: string) {
  try {
    await addMarketDemandJob({ campusId, campusName });
    logger.info(`Market demand update queued for: ${campusName}`);
  } catch (error) {
    logger.error('Failed to queue market demand update:', error);
  }
}

export default {
  getBarberPricing,
  getBarberQualityScore,
  getBarberHistory,
  calculateBookingPrice,
  getMarketSummary,
  getFraudFlags,
  getDisputes,
  triggerReviewProcessing,
  triggerFraudDetection,
  triggerDisputeResolution,
  triggerOnboardingAssessment,
  triggerMarketDemandUpdate,
};

