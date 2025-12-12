/**
 * AI Worker Main Entry Point
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from './utils/logger';
import { testConnection, closePool } from './db/connection';
import { closeAllQueues } from './queues';
// Import all workers
import { reviewProcessingWorker } from './processors/reviewProcessing.processor';
import { fraudDetectionWorker } from './processors/fraudDetection.processor';
import { disputeResolutionWorker } from './processors/disputeResolution.processor';
import { onboardingAssessmentWorker } from './processors/onboardingAssessment.processor';
import { marketDemandWorker } from './processors/marketDemand.processor';
import { weeklySummaryWorker } from './processors/weeklySummary.processor';

// Export AI functions for direct backend integration
export * from './services/ai-functions';
export * from './queues';

async function startAIWorker() {
  logger.info('🤖 Starting CampusCuts AI Worker (Background Processors)...');

  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Log environment
    logger.info('Environment Configuration:', {
      nodeEnv: process.env.NODE_ENV,
      redisHost: process.env.REDIS_HOST || 'localhost',
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSendGridKey: !!process.env.SENDGRID_API_KEY,
      queueConcurrency: process.env.QUEUE_CONCURRENCY || 5,
    });

    // Log worker status
    logger.info('✅ All workers initialized:', {
      reviewProcessing: reviewProcessingWorker.isRunning(),
      fraudDetection: fraudDetectionWorker.isRunning(),
      disputeResolution: disputeResolutionWorker.isRunning(),
      onboardingAssessment: onboardingAssessmentWorker.isRunning(),
      marketDemand: marketDemandWorker.isRunning(),
      weeklySummary: weeklySummaryWorker.isRunning(),
    });

    logger.info('🎉 AI Worker is fully operational!');
    logger.info('📊 Workers are listening for jobs...');
    logger.info('💡 Functions exported for direct backend integration');

  } catch (error) {
    logger.error('❌ Failed to start AI Worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down AI Worker...');

  try {
    // Close all workers
    await reviewProcessingWorker.close();
    await fraudDetectionWorker.close();
    await disputeResolutionWorker.close();
    await onboardingAssessmentWorker.close();
    await marketDemandWorker.close();
    await weeklySummaryWorker.close();

    // Close queues
    await closeAllQueues();

    // Close database
    await closePool();

    logger.info('✅ AI Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the worker
startAIWorker();

