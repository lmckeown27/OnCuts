/**
 * Gas Top-Up Transaction Verifier Service
 * 
 * Verifies admin wallet transfers to gas wallet on Aptos blockchain
 * Watches for transaction confirmation and updates request status
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import axios from 'axios';
import Decimal from 'decimal.js';

interface VerificationResult {
  verified: boolean;
  status: 'verified' | 'amount_mismatch' | 'tx_not_found' | 'timeout' | 'pending';
  verifiedAmountOctas?: number;
  errorMessage?: string;
  chainData?: any;
}

interface TopUpRequest {
  id: string;
  gas_wallet_address: string;
  requested_amount_octas: number;
  approved_tx_hash: string;
  admin_address_requested_from: string;
}

class GasTopUpVerifierService {
  private nodeUrl: string;
  private verificationTimeoutMs: number = 10 * 60 * 1000; // 10 minutes
  private pollingIntervalMs: number = 5000; // 5 seconds
  private minConfirmations: number = 1;

  constructor() {
    this.nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
  }

  /**
   * Load config from database
   */
  private async loadConfig(): Promise<void> {
    const result = await pool.query(
      'SELECT tx_verification_timeout_minutes, min_confirmations FROM gas_estimation_config WHERE is_active = true LIMIT 1'
    );

    if (result.rows.length > 0) {
      this.verificationTimeoutMs = result.rows[0].tx_verification_timeout_minutes * 60 * 1000;
      this.minConfirmations = result.rows[0].min_confirmations;
    }
  }

  /**
   * Verify transaction on Aptos blockchain
   */
  async verifyTransaction(txHash: string, expectedToAddress: string, expectedAmountOctas: number): Promise<VerificationResult> {
    try {
      const url = `${this.nodeUrl}/transactions/by_hash/${txHash}`;
      const response = await axios.get(url);
      const tx = response.data;

      // Check transaction success
      if (!tx.success) {
        return {
          verified: false,
          status: 'tx_not_found',
          errorMessage: 'Transaction failed on-chain',
          chainData: tx,
        };
      }

      // Extract transfer details from events
      let transferAmount = 0;
      let transferTo = '';

      // Look for coin transfer events
      for (const event of tx.events || []) {
        if (event.type.includes('DepositEvent')) {
          // Deposit event indicates funds received
          if (event.data && event.data.account) {
            transferTo = event.data.account;
            transferAmount = parseInt(event.data.amount || '0');
          }
        }
      }

      // Verify recipient address matches
      if (transferTo.toLowerCase() !== expectedToAddress.toLowerCase()) {
        return {
          verified: false,
          status: 'amount_mismatch',
          errorMessage: `Transaction sent to wrong address. Expected: ${expectedToAddress}, Got: ${transferTo}`,
          chainData: tx,
        };
      }

      // Verify amount matches (allow exact or more)
      if (transferAmount < expectedAmountOctas) {
        return {
          verified: false,
          status: 'amount_mismatch',
          verifiedAmountOctas: transferAmount,
          errorMessage: `Insufficient amount. Expected: ${expectedAmountOctas} octas, Got: ${transferAmount} octas`,
          chainData: tx,
        };
      }

      // Success!
      return {
        verified: true,
        status: 'verified',
        verifiedAmountOctas: transferAmount,
        chainData: tx,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          verified: false,
          status: 'tx_not_found',
          errorMessage: 'Transaction not found on blockchain',
        };
      }

      logger.error(`Failed to verify transaction ${txHash}:`, error);
      return {
        verified: false,
        status: 'pending',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Watch and verify a top-up request
   * Polls blockchain until verified or timeout
   */
  async watchTopUpRequest(requestId: string): Promise<void> {
    await this.loadConfig();

    // Get request details
    const requestResult = await pool.query(
      `SELECT id, gas_wallet_address, requested_amount_octas, approved_tx_hash, admin_address_requested_from 
       FROM gas_top_up_requests 
       WHERE id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error(`Top-up request ${requestId} not found`);
    }

    const request: TopUpRequest = requestResult.rows[0];

    if (!request.approved_tx_hash) {
      throw new Error('No transaction hash provided');
    }

    logger.info(`Starting verification watch for top-up request ${requestId}`, {
      txHash: request.approved_tx_hash,
      gasWallet: request.gas_wallet_address,
      expectedAmount: request.requested_amount_octas,
    });

    const startTime = Date.now();
    let attempts = 0;

    // Poll until verified or timeout
    while (Date.now() - startTime < this.verificationTimeoutMs) {
      attempts++;

      const result = await this.verifyTransaction(
        request.approved_tx_hash,
        request.gas_wallet_address,
        request.requested_amount_octas
      );

      if (result.verified) {
        // Success - mark as completed
        await this.markRequestCompleted(requestId, result);
        logger.info(`✅ Top-up request ${requestId} verified and completed`, {
          txHash: request.approved_tx_hash,
          verifiedAmount: result.verifiedAmountOctas,
          attempts,
        });
        return;
      }

      if (result.status === 'amount_mismatch') {
        // Failed - amount doesn't match
        await this.markRequestFailed(requestId, result);
        logger.error(`❌ Top-up request ${requestId} failed: amount mismatch`, {
          expected: request.requested_amount_octas,
          got: result.verifiedAmountOctas,
        });
        return;
      }

      if (result.status === 'tx_not_found') {
        // Transaction not found yet - keep polling
        logger.debug(`Transaction ${request.approved_tx_hash} not found yet, attempt ${attempts}`);
      }

      // Wait before next poll
      await this.sleep(this.pollingIntervalMs);
    }

    // Timeout reached
    await this.markRequestTimeout(requestId);
    logger.error(`⏱️ Top-up request ${requestId} verification timed out`, {
      txHash: request.approved_tx_hash,
      attempts,
      timeout: this.verificationTimeoutMs / 1000 + 's',
    });
  }

  /**
   * Mark request as completed
   */
  private async markRequestCompleted(requestId: string, result: VerificationResult): Promise<void> {
    await pool.query(
      `UPDATE gas_top_up_requests 
       SET status = 'completed',
           verification_status = 'verified',
           verified_amount_octas = $1,
           verified_at = NOW(),
           audit_metadata = audit_metadata || $2::jsonb
       WHERE id = $3`,
      [
        result.verifiedAmountOctas,
        JSON.stringify({
          verificationResult: result,
          verifiedAt: new Date().toISOString(),
        }),
        requestId,
      ]
    );

    // Log audit event
    await this.logAuditEvent(requestId, 'top_up_completed', {
      verifiedAmountOctas: result.verifiedAmountOctas,
      chainData: result.chainData,
    });

    // Update gas wallet cached balance
    await this.updateGasWalletBalance(requestId);
  }

  /**
   * Mark request as failed
   */
  private async markRequestFailed(requestId: string, result: VerificationResult): Promise<void> {
    await pool.query(
      `UPDATE gas_top_up_requests 
       SET status = 'failed',
           verification_status = $1,
           verified_amount_octas = $2,
           error_message = $3,
           verified_at = NOW(),
           audit_metadata = audit_metadata || $4::jsonb
       WHERE id = $5`,
      [
        result.status,
        result.verifiedAmountOctas || null,
        result.errorMessage,
        JSON.stringify({
          verificationResult: result,
          failedAt: new Date().toISOString(),
        }),
        requestId,
      ]
    );

    // Log audit event
    await this.logAuditEvent(requestId, 'top_up_failed', {
      reason: result.errorMessage,
      verifiedAmountOctas: result.verifiedAmountOctas,
      chainData: result.chainData,
    });
  }

  /**
   * Mark request as timed out
   */
  private async markRequestTimeout(requestId: string): Promise<void> {
    await pool.query(
      `UPDATE gas_top_up_requests 
       SET status = 'failed',
           verification_status = 'timeout',
           error_message = 'Transaction verification timed out',
           audit_metadata = audit_metadata || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          timeoutAt: new Date().toISOString(),
        }),
        requestId,
      ]
    );

    // Log audit event
    await this.logAuditEvent(requestId, 'top_up_failed', {
      reason: 'Verification timeout',
    });
  }

  /**
   * Update gas wallet cached balance after successful top-up
   */
  private async updateGasWalletBalance(requestId: string): Promise<void> {
    const result = await pool.query(
      `SELECT gas_wallet_id, gas_wallet_address FROM gas_top_up_requests WHERE id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) return;

    const { gas_wallet_id, gas_wallet_address } = result.rows[0];

    // Get fresh balance from blockchain
    const suiChainService = (await import('./sui-chain.service')).default;
    const balanceAPT = await suiChainService.getAccountBalance(gas_wallet_address);

    await pool.query(
      `UPDATE gas_wallets 
       SET current_balance_apt = $1, last_checked_at = NOW() 
       WHERE id = $2`,
      [balanceAPT, gas_wallet_id]
    );

    logger.info(`Updated gas wallet balance: ${balanceAPT.toFixed(6)} APT`);
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(requestId: string, eventType: string, data: any): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT gas_wallet_id FROM gas_top_up_requests WHERE id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) return;

      await pool.query(
        `INSERT INTO gas_wallet_audit_logs (
          gas_wallet_id,
          top_up_request_id,
          event_type,
          actor_type,
          data
        ) VALUES ($1, $2, $3, 'system', $4)`,
        [result.rows[0].gas_wallet_id, requestId, eventType, JSON.stringify(data)]
      );
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
const gasTopUpVerifierService = new GasTopUpVerifierService();

export default gasTopUpVerifierService;

