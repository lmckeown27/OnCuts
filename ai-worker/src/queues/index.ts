/**
 * BullMQ Queue Definitions
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Redis connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  logger.info('📡 Redis connected for BullMQ');
});

redisConnection.on('error', (err) => {
  logger.error('❌ Redis connection error:', err);
});

// Queue options
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000'),
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Event type definitions
export enum AIEventType {
  BARBER_ONBOARDED = 'BARBER_ONBOARDED',
  NEW_REVIEW_CREATED = 'NEW_REVIEW_CREATED',
  BOOKING_DISPUTED = 'BOOKING_DISPUTED',
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  CANCELLATION_PATTERN_DETECTED = 'CANCELLATION_PATTERN_DETECTED',
  MARKET_DEMAND_UPDATE = 'MARKET_DEMAND_UPDATE',
}

// Create queues
export const barberOnboardingQueue = new Queue('barber-onboarding', defaultQueueOptions);
export const reviewProcessingQueue = new Queue('review-processing', defaultQueueOptions);
export const disputeResolutionQueue = new Queue('dispute-resolution', defaultQueueOptions);
export const weeklySummaryQueue = new Queue('weekly-summary', defaultQueueOptions);
export const fraudDetectionQueue = new Queue('fraud-detection', defaultQueueOptions);
export const marketDemandQueue = new Queue('market-demand', defaultQueueOptions);

// Export all queues
export const queues = {
  barberOnboarding: barberOnboardingQueue,
  reviewProcessing: reviewProcessingQueue,
  disputeResolution: disputeResolutionQueue,
  weeklySummary: weeklySummaryQueue,
  fraudDetection: fraudDetectionQueue,
  marketDemand: marketDemandQueue,
};

// Add job to queue helpers
export async function addBarberOnboardingJob(data: any) {
  return await barberOnboardingQueue.add('onboarding-assessment', data);
}

export async function addReviewProcessingJob(data: any) {
  return await reviewProcessingQueue.add('process-review', data);
}

export async function addDisputeResolutionJob(data: any) {
  return await disputeResolutionQueue.add('resolve-dispute', data);
}

export async function addWeeklySummaryJob(data: any) {
  return await weeklySummaryQueue.add('generate-summary', data);
}

export async function addFraudDetectionJob(data: any) {
  return await fraudDetectionQueue.add('detect-fraud', data);
}

export async function addMarketDemandJob(data: any) {
  return await marketDemandQueue.add('calculate-demand', data);
}

// Close all queues
export async function closeAllQueues() {
  logger.info('Closing all queues...');
  await Promise.all([
    barberOnboardingQueue.close(),
    reviewProcessingQueue.close(),
    disputeResolutionQueue.close(),
    weeklySummaryQueue.close(),
    fraudDetectionQueue.close(),
    marketDemandQueue.close(),
  ]);
  await redisConnection.quit();
  logger.info('✅ All queues closed');
}

export { redisConnection };

