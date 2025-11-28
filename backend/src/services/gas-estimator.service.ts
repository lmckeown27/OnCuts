/**
 * Gas Estimator Service
 * 
 * Estimates required APT gas for upcoming platform operations
 * Monitors gas wallet balance and triggers top-up requests
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import aptosService from './aptos.service';
import Decimal from 'decimal.js';

interface GasEstimate {
  gasWalletAddress: string;
  currentBalanceAPT: number;
  estimatedNeededAPT: number;
  amountNeededAPT: number;
  estimatedCoverageDays: number;
  timestamp: Date;
  metadata: {
    pendingWrites: number;
    avgGasPerWrite: number;
    safetyBufferPct: number;
    estimationHorizon: string;
  };
}

interface GasWallet {
  id: string;
  address: string;
  descriptive_name: string;
  current_balance_apt: number;
  min_balance_threshold_apt: number;
  top_up_threshold_apt: number;
  safety_buffer_percentage: number;
}

interface GasEstimationConfig {
  default_avg_gas_apt_per_write: number;
  estimation_horizon_hours: number;
  safety_buffer_percentage: number;
  min_balance_alert_threshold_apt: number;
  critical_balance_threshold_apt: number;
  auto_create_topup_threshold_apt: number;
}

class GasEstimatorService {
  private config: GasEstimationConfig | null = null;

  /**
   * Load estimation config from database
   */
  private async loadConfig(): Promise<GasEstimationConfig> {
    if (this.config) return this.config;

    const result = await pool.query(
      'SELECT * FROM gas_estimation_config WHERE is_active = true LIMIT 1'
    );

    if (result.rows.length === 0) {
      throw new Error('No active gas estimation config found');
    }

    this.config = {
      default_avg_gas_apt_per_write: parseFloat(result.rows[0].default_avg_gas_apt_per_write),
      estimation_horizon_hours: result.rows[0].estimation_horizon_hours,
      safety_buffer_percentage: parseFloat(result.rows[0].safety_buffer_percentage),
      min_balance_alert_threshold_apt: parseFloat(result.rows[0].min_balance_alert_threshold_apt),
      critical_balance_threshold_apt: parseFloat(result.rows[0].critical_balance_threshold_apt),
      auto_create_topup_threshold_apt: parseFloat(result.rows[0].auto_create_topup_threshold_apt),
    };

    return this.config;
  }

  /**
   * Get active gas wallet
   */
  private async getActiveGasWallet(): Promise<GasWallet> {
    const result = await pool.query(
      'SELECT * FROM gas_wallets WHERE is_active = true LIMIT 1'
    );

    if (result.rows.length === 0) {
      throw new Error('No active gas wallet found');
    }

    return result.rows[0];
  }

  /**
   * Estimate pending writes for next N hours
   * This uses historical data + queued jobs + scheduled batches
   */
  private async estimatePendingWrites(horizonHours: number): Promise<number> {
    try {
      // Count queued withdrawal requests
      const withdrawalResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM withdrawal_requests 
         WHERE status IN ('queued', 'processing')`
      );
      const queuedWithdrawals = parseInt(withdrawalResult.rows[0]?.count || '0');

      // Count active escrow holds that may complete soon
      const escrowResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM escrow_holds 
         WHERE status = 'held' 
         AND expires_at > NOW() 
         AND expires_at < NOW() + INTERVAL '${horizonHours} hours'`
      );
      const activeEscrows = parseInt(escrowResult.rows[0]?.count || '0');

      // Estimate average hourly bookings based on last 7 days
      const bookingResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM bookings 
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );
      const recentBookings = parseInt(bookingResult.rows[0]?.count || '0');
      const avgBookingsPerHour = recentBookings / (7 * 24);
      const estimatedFutureBookings = Math.ceil(avgBookingsPerHour * horizonHours);

      // Each booking typically generates 2 writes (create + complete)
      const bookingWrites = estimatedFutureBookings * 2;

      // Withdrawal batch processing (scheduled every 15 min)
      const batchesInHorizon = Math.ceil(horizonHours * 4); // 4 batches per hour
      const avgWithdrawalsPerBatch = Math.max(queuedWithdrawals / batchesInHorizon, 1);
      const withdrawalWrites = batchesInHorizon;

      // On-chain proof anchoring (booking completions, etc.)
      const proofWrites = estimatedFutureBookings; // 1 proof per booking completion

      const totalEstimatedWrites = 
        bookingWrites + 
        withdrawalWrites + 
        proofWrites + 
        activeEscrows; // Escrow releases

      logger.debug('Estimated pending writes:', {
        bookingWrites,
        withdrawalWrites,
        proofWrites,
        activeEscrows,
        queuedWithdrawals,
        total: totalEstimatedWrites,
      });

      return Math.max(totalEstimatedWrites, 10); // Minimum 10 writes
    } catch (error) {
      logger.error('Failed to estimate pending writes:', error);
      // Fallback to conservative estimate
      return 50; // 50 writes as safety fallback
    }
  }

  /**
   * Get current gas wallet balance from blockchain
   */
  private async getCurrentBalance(address: string): Promise<number> {
    try {
      const balanceAPT = await aptosService.getAccountBalance(address);
      return balanceAPT;
    } catch (error) {
      logger.error(`Failed to get balance for ${address}:`, error);
      return 0;
    }
  }

  /**
   * Calculate gas estimate with safety buffer
   */
  async estimateGas(): Promise<GasEstimate> {
    const config = await this.loadConfig();
    const wallet = await this.getActiveGasWallet();

    // Get current balance from blockchain
    const currentBalanceAPT = await this.getCurrentBalance(wallet.address);

    // Update cached balance in database
    await pool.query(
      `UPDATE gas_wallets 
       SET current_balance_apt = $1, last_checked_at = NOW() 
       WHERE id = $2`,
      [currentBalanceAPT, wallet.id]
    );

    // Estimate pending writes
    const pendingWrites = await this.estimatePendingWrites(config.estimation_horizon_hours);

    // Calculate estimated needed APT
    const baseEstimate = new Decimal(pendingWrites)
      .times(config.default_avg_gas_apt_per_write);

    const safetyMultiplier = new Decimal(1).plus(
      new Decimal(config.safety_buffer_percentage).div(100)
    );

    const estimatedNeededAPT = baseEstimate
      .times(safetyMultiplier)
      .toDecimalPlaces(6, Decimal.ROUND_UP)
      .toNumber();

    // Calculate amount needed (max of 0 or difference)
    const amountNeededAPT = Math.max(
      0,
      new Decimal(estimatedNeededAPT)
        .minus(currentBalanceAPT)
        .toDecimalPlaces(6, Decimal.ROUND_UP)
        .toNumber()
    );

    // Estimate coverage days
    const estimatedDailyConsumption = new Decimal(pendingWrites)
      .div(config.estimation_horizon_hours)
      .times(24)
      .times(config.default_avg_gas_apt_per_write)
      .toNumber();

    const estimatedCoverageDays = estimatedDailyConsumption > 0
      ? new Decimal(currentBalanceAPT)
          .div(estimatedDailyConsumption)
          .toDecimalPlaces(2, Decimal.ROUND_DOWN)
          .toNumber()
      : 999;

    const estimate: GasEstimate = {
      gasWalletAddress: wallet.address,
      currentBalanceAPT,
      estimatedNeededAPT,
      amountNeededAPT,
      estimatedCoverageDays,
      timestamp: new Date(),
      metadata: {
        pendingWrites,
        avgGasPerWrite: config.default_avg_gas_apt_per_write,
        safetyBufferPct: config.safety_buffer_percentage,
        estimationHorizon: `${config.estimation_horizon_hours}h`,
      },
    };

    // Log audit event
    await this.logAuditEvent(wallet.id, 'balance_checked', {
      estimate,
    });

    logger.info('Gas estimate calculated:', {
      current: currentBalanceAPT,
      needed: estimatedNeededAPT,
      amount_needed: amountNeededAPT,
      coverage_days: estimatedCoverageDays,
    });

    return estimate;
  }

  /**
   * Check if top-up is needed and auto-create request
   */
  async checkAndCreateTopUpIfNeeded(): Promise<string | null> {
    const config = await this.loadConfig();
    const estimate = await this.estimateGas();

    // Check if amount needed exceeds threshold
    if (estimate.amountNeededAPT < config.auto_create_topup_threshold_apt) {
      logger.debug('No top-up needed', {
        amountNeeded: estimate.amountNeededAPT,
        threshold: config.auto_create_topup_threshold_apt,
      });
      return null;
    }

    // Check if there's already a pending request
    const pendingResult = await pool.query(
      `SELECT id FROM gas_top_up_requests 
       WHERE gas_wallet_address = $1 
       AND status IN ('pending', 'approved') 
       LIMIT 1`,
      [estimate.gasWalletAddress]
    );

    if (pendingResult.rows.length > 0) {
      logger.info('Top-up request already pending', {
        requestId: pendingResult.rows[0].id,
      });
      return pendingResult.rows[0].id;
    }

    // Create new top-up request
    const wallet = await this.getActiveGasWallet();
    const requestedAmountAPT = new Decimal(estimate.amountNeededAPT)
      .toDecimalPlaces(6, Decimal.ROUND_UP)
      .toNumber();

    const requestedAmountOctas = new Decimal(requestedAmountAPT)
      .times(100_000_000)
      .toDecimalPlaces(0, Decimal.ROUND_UP)
      .toNumber();

    const reason = `Auto-generated: Balance (${estimate.currentBalanceAPT.toFixed(4)} APT) below threshold. Estimated need: ${estimate.estimatedNeededAPT.toFixed(4)} APT for next ${config.estimation_horizon_hours}h.`;

    const insertResult = await pool.query(
      `INSERT INTO gas_top_up_requests (
        gas_wallet_id,
        gas_wallet_address,
        requested_amount_apt,
        requested_amount_octas,
        status,
        reason,
        estimated_coverage_days,
        verification_status,
        audit_metadata
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, 'pending', $7)
      RETURNING id`,
      [
        wallet.id,
        wallet.address,
        requestedAmountAPT,
        requestedAmountOctas,
        reason,
        estimate.estimatedCoverageDays,
        JSON.stringify({ estimate }),
      ]
    );

    const requestId = insertResult.rows[0].id;

    // Log audit event
    await this.logAuditEvent(wallet.id, 'top_up_requested', {
      requestId,
      requestedAmountAPT,
      reason,
    }, requestId);

    logger.info('Auto-created top-up request:', {
      requestId,
      requestedAmountAPT,
      reason,
    });

    // Send alert (placeholder - implement email/Slack notification)
    await this.sendTopUpAlert(requestId, requestedAmountAPT, reason);

    return requestId;
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    gasWalletId: string,
    eventType: string,
    data: any,
    topUpRequestId?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO gas_wallet_audit_logs (
          gas_wallet_id,
          top_up_request_id,
          event_type,
          actor_type,
          data
        ) VALUES ($1, $2, $3, 'system', $4)`,
        [gasWalletId, topUpRequestId || null, eventType, JSON.stringify(data)]
      );
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Send top-up alert (placeholder)
   */
  private async sendTopUpAlert(
    requestId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    logger.warn('🚨 GAS TOP-UP NEEDED:', {
      requestId,
      amount: `${amount.toFixed(6)} APT`,
      reason,
      action: 'Admin action required - connect wallet and approve top-up',
    });

    // TODO: Implement email/Slack notification
    // await emailService.send({
    //   to: process.env.ADMIN_EMAIL,
    //   subject: `CampusCuts: Gas Top-Up Required (${amount.toFixed(4)} APT)`,
    //   body: `Request ID: ${requestId}\nAmount: ${amount.toFixed(6)} APT\nReason: ${reason}`,
    // });
  }
}

// Singleton instance
const gasEstimatorService = new GasEstimatorService();

export default gasEstimatorService;

