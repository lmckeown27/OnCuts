/**
 * Blockchain Sync Cron Service
 * 
 * Runs hourly sync from Aptos blockchain → PostgreSQL cache
 * 
 * Schedule: Every hour at :00
 * Purpose: Keep PostgreSQL cache up-to-date with blockchain
 * 
 * Why hourly?
 * - Balance between freshness and cost
 * - Most queries hit cache (fast)
 * - Critical data (bookings) can query blockchain directly
 * - Reduces blockchain read costs by 90%
 */

import cron from 'node-cron';
import { logger } from '../utils/logger';
import { blockchainSyncService } from './blockchain-sync.service';

class BlockchainSyncCronService {
  private syncJob: cron.ScheduledTask | null = null;

  /**
   * Start the hourly sync cron job
   */
  start() {
    // Run every hour at :00
    this.syncJob = cron.schedule('0 * * * *', async () => {
      logger.info('Starting scheduled blockchain sync (cron)...');
      
      try {
        await blockchainSyncService.syncAll();
        logger.info('Scheduled blockchain sync complete');
      } catch (error) {
        logger.error('Scheduled blockchain sync failed:', error);
      }
    });

    logger.info('Blockchain sync cron job started (hourly at :00)');

    // Run initial sync on startup (after 10 seconds)
    setTimeout(async () => {
      logger.info('Running initial blockchain sync on startup...');
      try {
        await blockchainSyncService.syncAll();
        logger.info('Initial blockchain sync complete');
      } catch (error) {
        logger.error('Initial blockchain sync failed:', error);
      }
    }, 10000);
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.syncJob) {
      this.syncJob.stop();
      logger.info('Stopped blockchain sync cron job');
    }
  }

  /**
   * Manually trigger sync (for testing/admin)
   */
  async triggerManualSync() {
    logger.info('Manually triggering blockchain sync...');
    await blockchainSyncService.syncAll();
    logger.info('Manual blockchain sync complete');
  }

  /**
   * Get sync status
   */
  getStatus() {
    return blockchainSyncService.getStatus();
  }
}

export default new BlockchainSyncCronService();

