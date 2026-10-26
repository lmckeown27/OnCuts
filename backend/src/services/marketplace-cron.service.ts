/**
 * Marketplace Cron Jobs
 * 
 * Schedules:
 * - Nightly (2am): recompute_bqs, update_prices, refresh_rankings
 * - Every 15 minutes: surge_detector
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { bqsService } from './bqs-calculation.service';
import { marketplacePricingService } from './marketplace-pricing.service';
import { rankingService } from './ranking-algorithm.service';
import { surgePricingService } from './surge-pricing.service';

export class MarketplaceCronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Nightly BQS Recomputation (2am)
   */
  private async jobRecomputeBQS(): Promise<void> {
    try {
      logger.info('🌙 Starting nightly BQS recomputation...');

      const result = await bqsService.recomputeAllBQS();

      logger.info(`✅ BQS recomputation complete: ${result.processed} processed, ${result.failed} failed`);
    } catch (error: any) {
      logger.error('❌ BQS recomputation failed:', error);
    }
  }

  /**
   * Nightly Pricing Update (2am)
   */
  private async jobUpdatePrices(): Promise<void> {
    try {
      logger.info('💰 Starting nightly pricing update...');

      const result = await marketplacePricingService.updateAllPricingBounds();

      logger.info(`✅ Pricing update complete: ${result.processed} processed, ${result.failed} failed`);
    } catch (error: any) {
      logger.error('❌ Pricing update failed:', error);
    }
  }

  /**
   * Nightly Rank Refresh (2am)
   */
  private async jobRefreshRankings(): Promise<void> {
    try {
      logger.info('📊 Starting nightly ranking refresh...');

      const result = await rankingService.refreshAllRankScores();

      logger.info(`✅ Ranking refresh complete: ${result.processed} processed, ${result.failed} failed`);
    } catch (error: any) {
      logger.error('❌ Ranking refresh failed:', error);
    }
  }

  /**
   * Surge Detection (every 15 minutes)
   */
  private async jobSurgeDetection(): Promise<void> {
    try {
      logger.info('🔥 Running surge detection...');

      // End expired surges first
      await surgePricingService.endExpiredSurges();

      // Check current surge status
      const result = await surgePricingService.checkAllMarketsSurge();

      if (result.surgeActive > 0) {
        logger.info(`🔥 Surge active in ${result.surgeActive} markets`);
      }
    } catch (error: any) {
      logger.error('❌ Surge detection failed:', error);
    }
  }

  /**
   * Check if PostgreSQL is available
   */
  private async isPostgresAvailable(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start all cron jobs
   */
  async startAllJobs(): Promise<void> {
    // Check if PostgreSQL is available
    const postgresAvailable = await this.isPostgresAvailable();
    
    if (!postgresAvailable) {
      logger.warn('⚠️  Marketplace cron jobs disabled: PostgreSQL not available');
      logger.warn('   The system will operate in blockchain-only mode');
      return;
    }

    logger.info('🚀 Starting marketplace cron jobs...');

    // Nightly jobs at 2am: BQS → Pricing → Rankings
    const nightlyJob = cron.schedule('0 2 * * *', async () => {
      logger.info('🌙 Starting nightly marketplace update (2am)...');
      
      // Run in sequence
      await this.jobRecomputeBQS();
      await this.jobUpdatePrices();
      await this.jobRefreshRankings();
      
      logger.info('✅ Nightly marketplace update complete');
    });

    this.jobs.set('nightly', nightlyJob);

    // Referral M2 hold releases (hourly)
    const referralM2Job = cron.schedule('15 * * * *', async () => {
      try {
        const { processDueReferralM2Awards } = await import('./referral-lifecycle.service');
        const n = await processDueReferralM2Awards();
        if (n > 0) logger.info(`Referral M2 awards released: ${n}`);
      } catch (err: any) {
        logger.warn('Referral M2 cron soft-failed', { error: err?.message || String(err) });
      }
    });
    this.jobs.set('referral_m2', referralM2Job);

    // Surge detection disabled - requires surge_events table
    // TODO: Re-enable when surge pricing feature is implemented
    // const surgeJob = cron.schedule('*/15 * * * *', async () => {
    //   await this.jobSurgeDetection();
    // });
    // this.jobs.set('surge', surgeJob);

    logger.info('✅ Marketplace cron jobs started:');
    logger.info('   - Nightly update: 2am (BQS → Pricing → Rankings)');
    logger.info('   - Referral M2 holds: hourly');
    logger.info('   - Surge detection: Disabled');
  }

  /**
   * Stop all cron jobs
   */
  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Manually trigger BQS recomputation (for admin/testing)
   */
  async triggerBQSRecompute(): Promise<any> {
    logger.info('🔧 Manual BQS recomputation triggered');
    await this.jobRecomputeBQS();
  }

  /**
   * Manually trigger pricing update (for admin/testing)
   */
  async triggerPricingUpdate(): Promise<any> {
    logger.info('🔧 Manual pricing update triggered');
    await this.jobUpdatePrices();
  }

  /**
   * Manually trigger ranking refresh (for admin/testing)
   */
  async triggerRankingRefresh(): Promise<any> {
    logger.info('🔧 Manual ranking refresh triggered');
    await this.jobRefreshRankings();
  }

  /**
   * Manually trigger surge detection (for admin/testing)
   */
  async triggerSurgeDetection(): Promise<any> {
    logger.info('🔧 Manual surge detection triggered');
    await this.jobSurgeDetection();
  }

}

export const marketplaceCronService = new MarketplaceCronService();

