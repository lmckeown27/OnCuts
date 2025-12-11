/**
 * Blockchain Sync Service
 * 
 * Syncs data from Aptos blockchain → PostgreSQL cache
 * 
 * Architecture:
 * - Blockchain = Source of truth (all writes go here)
 * - PostgreSQL = Cache layer (synced hourly for fast reads)
 * 
 * This service:
 * 1. Queries blockchain for latest data
 * 2. Updates PostgreSQL tables
 * 3. Runs on cron schedule (hourly)
 * 
 * Why? 50-70% cost savings vs pure blockchain queries!
 */

import { pool } from '../database/connection';
import blockchainQueryService from './blockchain-query.service';
import { logger } from '../utils/logger';

class BlockchainSyncService {
  private isSyncing = false;
  private lastSyncTime: Date | null = null;

  /**
   * Full sync: Sync all data from blockchain to PostgreSQL
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      logger.info('Starting full blockchain sync...');

      // Sync in parallel for speed
      await Promise.all([
        this.syncUsers(),
        this.syncBookings(),
        this.syncReviews(),
      ]);

      this.lastSyncTime = new Date();
      const duration = Date.now() - startTime;

      logger.info(`Blockchain sync complete in ${duration}ms`, {
        lastSyncTime: this.lastSyncTime,
      });
    } catch (error) {
      logger.error('Blockchain sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync users from blockchain to PostgreSQL
   */
  private async syncUsers(): Promise<void> {
    try {
      // Get all users from blockchain
      // Note: In production, implement pagination for large datasets
      const users = await this.getAllUsersFromBlockchain();

      logger.info(`Syncing ${users.length} users from blockchain...`);

      for (const user of users) {
        await pool.query(
          `
          INSERT INTO users (
            aptos_address, email, full_name, role, 
            balance, locked_balance, profile_picture_cid,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (aptos_address) 
          DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            balance = EXCLUDED.balance,
            locked_balance = EXCLUDED.locked_balance,
            profile_picture_cid = EXCLUDED.profile_picture_cid,
            updated_at = EXCLUDED.updated_at
          `,
          [
            user.address,
            user.email || null,
            user.full_name || null,
            user.role,
            user.balance,
            user.locked_balance,
            user.profile_picture_cid || null,
            new Date(user.created_at * 1000), // Convert timestamp
            new Date(),
          ]
        );
      }

      logger.info(`Synced ${users.length} users successfully`);
    } catch (error) {
      logger.error('Failed to sync users:', error);
      throw error;
    }
  }

  /**
   * Sync bookings from blockchain to PostgreSQL
   */
  private async syncBookings(): Promise<void> {
    try {
      const bookings = await this.getAllBookingsFromBlockchain();

      logger.info(`Syncing ${bookings.length} bookings from blockchain...`);

      for (const booking of bookings) {
        await pool.query(
          `
          INSERT INTO bookings (
            blockchain_id, student_address, barber_address,
            amount, platform_fee, scheduled_time, status,
            created_at, completed_at, cancelled_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (blockchain_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            completed_at = EXCLUDED.completed_at,
            cancelled_at = EXCLUDED.cancelled_at
          `,
          [
            booking.id,
            booking.student_addr,
            booking.barber_addr,
            booking.amount,
            booking.platform_fee || 0,
            new Date(booking.scheduled_time * 1000),
            booking.status,
            new Date(booking.created_at * 1000),
            booking.completed_at ? new Date(booking.completed_at * 1000) : null,
            booking.cancelled_at ? new Date(booking.cancelled_at * 1000) : null,
          ]
        );
      }

      logger.info(`Synced ${bookings.length} bookings successfully`);
    } catch (error) {
      logger.error('Failed to sync bookings:', error);
      throw error;
    }
  }

  /**
   * Sync reviews from blockchain to PostgreSQL
   */
  private async syncReviews(): Promise<void> {
    try {
      const reviews = await this.getAllReviewsFromBlockchain();

      logger.info(`Syncing ${reviews.length} reviews from blockchain...`);

      for (const review of reviews) {
        await pool.query(
          `
          INSERT INTO reviews (
            blockchain_id, booking_id, reviewer_address,
            barber_address, rating, comment_cid, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (blockchain_id)
          DO UPDATE SET
            rating = EXCLUDED.rating,
            comment_cid = EXCLUDED.comment_cid
          `,
          [
            review.id,
            review.booking_id,
            review.reviewer_addr,
            review.barber_addr,
            review.rating,
            review.comment_cid || null,
            new Date(review.created_at * 1000),
          ]
        );
      }

      logger.info(`Synced ${reviews.length} reviews successfully`);
    } catch (error) {
      logger.error('Failed to sync reviews:', error);
      throw error;
    }
  }

  /**
   * Get all users from blockchain
   * TODO: Implement pagination for production
   */
  private async getAllUsersFromBlockchain(): Promise<any[]> {
    // This is a simplified version
    // In production, you'd query the blockchain indexer or implement pagination
    
    try {
      // Query blockchain for user events
      // For now, return empty array - implement based on your smart contract events
      logger.warn('getAllUsersFromBlockchain not fully implemented - returning empty array');
      return [];
    } catch (error) {
      logger.error('Error fetching users from blockchain:', error);
      return [];
    }
  }

  /**
   * Get all bookings from blockchain
   */
  private async getAllBookingsFromBlockchain(): Promise<any[]> {
    try {
      // Query blockchain for all bookings
      // This would use your blockchain query service
      logger.warn('getAllBookingsFromBlockchain not fully implemented - returning empty array');
      return [];
    } catch (error) {
      logger.error('Error fetching bookings from blockchain:', error);
      return [];
    }
  }

  /**
   * Get all reviews from blockchain
   */
  private async getAllReviewsFromBlockchain(): Promise<any[]> {
    try {
      logger.warn('getAllReviewsFromBlockchain not fully implemented - returning empty array');
      return [];
    } catch (error) {
      logger.error('Error fetching reviews from blockchain:', error);
      return [];
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn: this.lastSyncTime 
        ? Math.max(0, 3600000 - (Date.now() - this.lastSyncTime.getTime())) // 1 hour
        : 0,
    };
  }
}

export const blockchainSyncService = new BlockchainSyncService();
export default blockchainSyncService;

