/**
 * Withdrawal queue for Stripe Connect bank payouts.
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import transactionService, { TransactionType, TransactionStatus } from './transaction.service';
import auditService from './audit.service';

export enum WithdrawalStatus {
  QUEUED = 'queued',
  BATCHED = 'batched',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum DestinationType {
  BANK = 'bank',
}

export interface WithdrawalQueueItem {
  id: number;
  user_id: string;
  transaction_id: number;
  amount: number;
  destination_type: DestinationType;
  destination_address?: string;
  status: WithdrawalStatus;
  queued_at: Date;
  processed_at?: Date;
  failure_reason?: string;
}

export interface QueueWithdrawalInput {
  user_id: string;
  amount: number;
  destination_type: DestinationType;
  destination_address?: string;
}

class WithdrawalBatchService {
  async queueWithdrawal(input: QueueWithdrawalInput): Promise<WithdrawalQueueItem> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const transaction = await transactionService.createTransaction({
        user_id: input.user_id,
        type: TransactionType.PAYOUT,
        amount: -input.amount,
        status: TransactionStatus.PENDING,
        metadata: {
          destination_type: input.destination_type,
          destination_address: input.destination_address,
        },
      });

      const queueResult = await client.query(
        `INSERT INTO withdrawal_queue (
          user_id, transaction_id, amount, destination_type,
          destination_address, status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          input.user_id,
          transaction.id,
          input.amount,
          input.destination_type,
          input.destination_address || null,
          WithdrawalStatus.QUEUED,
        ]
      );

      await auditService.log({
        actor_user_id: input.user_id,
        action: 'withdrawal_queued',
        object_type: 'withdrawal_queue',
        object_id: queueResult.rows[0].id.toString(),
        details: {
          amount_cents: input.amount,
          destination_type: input.destination_type,
        },
      });

      await client.query('COMMIT');

      logger.info('Withdrawal queued', {
        user_id: input.user_id,
        amount_dollars: input.amount / 100,
        destination_type: input.destination_type,
        queue_id: queueResult.rows[0].id,
      });

      return queueResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to queue withdrawal', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserWithdrawals(userId: string): Promise<WithdrawalQueueItem[]> {
    const result = await pool.query(
      `SELECT * FROM withdrawal_queue
       WHERE user_id = $1
       ORDER BY queued_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getStats(): Promise<{
    queued_count: number;
    queued_total_cents: number;
    processing_count: number;
    completed_today: number;
  }> {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'queued'), 0) as queued_total_cents,
        COUNT(*) FILTER (WHERE status IN ('batched', 'processing')) as processing_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND processed_at > CURRENT_DATE) as completed_today
      FROM withdrawal_queue
    `);

    return result.rows[0];
  }
}

export default new WithdrawalBatchService();
