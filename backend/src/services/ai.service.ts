/**
 * AI Service - Direct integration with AI Worker
 * 
 * Imports AI functions and passes backend's database and logger
 * No HTTP calls needed - everything runs in-process
 */

import { logger } from '../utils/logger';
import { pool } from '../database/connection';

// Import AI functions directly from ai-worker
// NOTE: Commented out to avoid cross-project imports (outside rootDir)
// AI Worker should be run as a separate microservice
// import {
//   getBarberPricing as aiGetBarberPricing,
//   getBarberQualityScore as aiGetBarberQualityScore,
//   getBarberHistory as aiGetBarberHistory,
//   getMarketSummary as aiGetMarketSummary,
//   getFraudFlags as aiGetFraudFlags,
//   getDisputes as aiGetDisputes,
//   calculateBookingPrice as aiCalculateBookingPrice,
//   AIFunctionDeps,
// } from '../../../ai-worker/src/services/ai-functions';

// Placeholder type until AI Worker is properly integrated
type AIFunctionDeps = { db: any; logger: any };

// Queue functions (optional - only needed if running AI Worker separately)
// Import queue functions if you want background processing
// Commented out to avoid bullmq/ioredis dependencies
// import {
//   addReviewProcessingJob,
//   addFraudDetectionJob,
//   addDisputeResolutionJob,
//   addBarberOnboardingJob,
//   addMarketDemandJob,
// } from '../../../ai-worker/src/queues';

// Create dependencies object with backend's resources
const aiDeps: AIFunctionDeps = {
  db: pool,
  logger: logger,
};

/**
 * Get barber pricing multiplier with AI
 * NOTE: AI Worker integration temporarily disabled
 */
export async function getBarberPricing(barberId: string) {
  try {
    // TODO: Integrate with AI Worker microservice via HTTP/Queue
    logger.warn('AI Service - getBarberPricing: AI Worker not integrated');
    return {
      barberId,
      multiplier: 1.0,
      isDefault: true,
      error: false,
    };
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
 * NOTE: AI Worker integration temporarily disabled
 */
export async function getBarberQualityScore(barberId: string) {
  try {
    // TODO: Integrate with AI Worker microservice via HTTP/Queue
    logger.warn('AI Service - getBarberQualityScore: AI Worker not integrated');
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
    // TODO: Integrate with AI Worker microservice
    logger.warn('AI Service - getBarberHistory: AI Worker not integrated');
    return { barberId, history: [], error: false };
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
    // TODO: Integrate with AI Worker microservice
    logger.warn('AI Service - calculateBookingPrice: AI Worker not integrated');
    return { barberId, price: basePrice, multiplier: 1.0, error: false };
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
    // TODO: Integrate with AI Worker microservice
    logger.warn('AI Service - getMarketSummary: AI Worker not integrated');
    return { markets: [], summary: 'AI Worker not integrated', error: false };
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
    // TODO: Integrate with AI Worker microservice
    logger.warn('AI Service - getFraudFlags: AI Worker not integrated');
    return { flags: [], total: 0, error: false };
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
    // TODO: Integrate with AI Worker microservice
    logger.warn('AI Service - getDisputes: AI Worker not integrated');
    return { disputes: [], total: 0, error: false };
  } catch (error) {
    logger.error('AI Service - getDisputes error:', error);
    return { disputes: [] };
  }
}

/**
 * Trigger AI processing for new review
 * Note: Requires AI Worker running separately with queue system
 * For now, this is a no-op. AI processing happens on-demand via direct calls.
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
  // TODO: Implement queue-based background processing if needed
  // For now, AI functions are called directly when needed
  logger.info(`Review processing triggered for: ${reviewData.reviewId} (direct mode)`);
}

/**
 * Trigger fraud detection for suspicious activity
 * Note: Requires AI Worker running separately with queue system
 */
export async function triggerFraudDetection(
  userId: string, 
  userType: 'barber' | 'customer', 
  reason: string
) {
  logger.info(`Fraud detection triggered for user: ${userId} (direct mode)`);
  // TODO: Call fraud detection directly if needed
}

/**
 * Trigger dispute resolution analysis
 * Note: Requires AI Worker running separately with queue system
 */
export async function triggerDisputeResolution(disputeData: {
  bookingId: string;
  disputeId: string;
  disputeReason: string;
  disputeDescription: string;
}) {
  logger.info(`Dispute resolution triggered: ${disputeData.disputeId} (direct mode)`);
  // TODO: Call dispute resolution directly if needed
}

/**
 * Trigger onboarding assessment for new user
 * Note: Requires AI Worker running separately with queue system
 */
export async function triggerOnboardingAssessment(applicationData: any) {
  logger.info(`Onboarding assessment triggered for: ${applicationData.userId} (direct mode)`);
  // TODO: Call onboarding assessment directly if needed
}

/**
 * Trigger market demand update for campus
 * Note: Requires AI Worker running separately with queue system
 */
export async function triggerMarketDemandUpdate(campusId: string, campusName: string) {
  logger.info(`Market demand update triggered for: ${campusName} (direct mode)`);
  // TODO: Call market demand calculation directly if needed
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

