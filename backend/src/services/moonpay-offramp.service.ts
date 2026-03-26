/**
 * MoonPay off-ramp helpers: gross-up USDC so barber receives target net USD after MoonPay fees.
 * Fees are absorbed by the platform (treasury sends extra on-chain USDC; ledger debits net only).
 */

import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { pool } from '../database/connection';
import transactionService, { TransactionStatus, TransactionType } from './transaction.service';
import suiRelayerService from './sui-relayer.service';

const MOONPAY_MIN_FEE_USD = 3.99;
const MOONPAY_PERCENT_FEE = 0.01;

/** Net USD barber should receive to bank after MoonPay takes its cut. */
export function calculateGrossUsdForMoonPayOfframp(netUsdAmount: number): number {
  if (!Number.isFinite(netUsdAmount) || netUsdAmount <= 0) {
    throw new ApiError(400, 'netUsdAmount must be a positive number');
  }
  const amountWithPercent = netUsdAmount / (1 - MOONPAY_PERCENT_FEE);
  const amountWithMinimum = netUsdAmount + MOONPAY_MIN_FEE_USD;
  return Math.max(amountWithPercent, amountWithMinimum);
}

export function netUsdToUsdcBaseUnits(netUsd: number): bigint {
  const gross = calculateGrossUsdForMoonPayOfframp(netUsd);
  return BigInt(Math.round(gross * 1e6));
}

/** MoonPay sell widget expects crypto amount as decimal string (e.g. USDC), not raw base units. */
export function usdcBaseUnitsToDecimalString(baseUnits: bigint): string {
  if (baseUnits <= 0n) {
    return '0';
  }
  const whole = baseUnits / 1_000_000n;
  const frac = baseUnits % 1_000_000n;
  if (frac === 0n) {
    return whole.toString();
  }
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export interface MoonPayPrepareResult {
  sessionId: string;
  netUsd: number;
  grossUsd: number;
  grossUsdcBaseUnits: string;
  walletAddress: string;
  externalCustomerId: string;
  moonpay: {
    publishableKey: string;
    environment: 'sandbox' | 'production';
    baseCurrencyCode: string;
    baseCurrencyAmount: string;
    lockAmount: string;
  };
  suiFundDigest: string;
}

class MoonPayOfframpService {
  /**
   * Debit barber's custodial balance by **net** USD, send **gross** USDC from treasury to their Sui wallet,
   * then return params for the MoonPay sell widget (overlay).
   */
  async prepareOfframp(userId: string, netUsd: number): Promise<MoonPayPrepareResult> {
    const publishableKey = process.env.MOONPAY_PUBLISHABLE_KEY?.trim();
    if (!publishableKey) {
      throw new ApiError(503, 'MoonPay is not configured (MOONPAY_PUBLISHABLE_KEY)');
    }

    if (!process.env.SUI_RPC_URL?.trim() || !process.env.SUI_TREASURY_ADDRESS?.trim()) {
      throw new ApiError(503, 'Sui treasury is not configured for on-chain funding');
    }

    const netCents = Math.round(netUsd * 100);
    if (netCents < 1000) {
      throw new ApiError(400, 'Minimum cash-out is $10');
    }

    const balance = await transactionService.getUserBalance(userId);
    if (balance.available_amount < netCents) {
      throw new ApiError(
        400,
        `Insufficient balance. Available: $${(balance.available_amount / 100).toFixed(2)}`
      );
    }

    const userRes = await pool.query<{ sui_address: string | null }>(
      `SELECT sui_address AS sui_address FROM users WHERE id = $1`,
      [userId]
    );
    const suiWallet = userRes.rows[0]?.sui_address?.trim();
    if (!suiWallet) {
      throw new ApiError(400, 'Set your Sui payout address under Payment Management before cashing out.');
    }

    const grossUsd = calculateGrossUsdForMoonPayOfframp(netUsd);
    const grossBaseUnits = netUsdToUsdcBaseUnits(netUsd);

    let ledgerTxId: number | null = null;
    try {
      const ledgerTx = await transactionService.createTransaction({
        user_id: userId,
        type: TransactionType.ONCHAIN_WITHDRAWAL,
        amount: -netCents,
        status: TransactionStatus.COMPLETED,
        metadata: {
          moonpay_offramp: true,
          net_usd: netUsd,
          gross_usd: grossUsd,
          gross_usdc_base_units: grossBaseUnits.toString(),
          sui_wallet: suiWallet,
        },
      });
      ledgerTxId = ledgerTx.id;
    } catch (e) {
      throw e;
    }

    let digest: string;
    try {
      const out = await suiRelayerService.executeDirectTreasuryUsdcTransfer(suiWallet, grossBaseUnits);
      digest = out.digest;
    } catch (chainErr) {
      logger.error('MoonPay prepare: on-chain funding failed, reversing ledger debit', {
        userId,
        ledgerTxId,
        error: chainErr,
      });
      try {
        await transactionService.createTransaction({
          user_id: userId,
          type: TransactionType.ADJUSTMENT,
          amount: netCents,
          status: TransactionStatus.COMPLETED,
          metadata: {
            moonpay_offramp_reversal: true,
            reason: 'sui_fund_failed',
            original_tx_id: ledgerTxId,
          },
        });
      } catch (revErr) {
        logger.error('MoonPay prepare: ledger reversal failed — manual fix required', {
          userId,
          ledgerTxId,
          revErr,
        });
      }
      throw chainErr;
    }

    const externalCustomerId = userId;
    const sessionInsert = await pool.query<{ id: string }>(
      `INSERT INTO moonpay_offramp_sessions (
        user_id, transaction_id, net_amount_cents, gross_usdc_base_units,
        sui_wallet_address, external_customer_id, status, sui_fund_digest
      ) VALUES ($1, $2, $3, $4, $5, $6, 'funded', $7)
      RETURNING id`,
      [
        userId,
        ledgerTxId,
        netCents,
        grossBaseUnits.toString(),
        suiWallet,
        externalCustomerId,
        digest,
      ]
    );
    const sessionId = sessionInsert.rows[0].id;

    const envRaw = (process.env.MOONPAY_ENVIRONMENT || 'sandbox').toLowerCase();
    const environment = envRaw === 'production' ? 'production' : 'sandbox';
    const baseCurrencyCode = (process.env.MOONPAY_SUI_USDC_CODE || 'usdc_sui').trim();

    logger.info('MoonPay off-ramp session funded', {
      sessionId,
      userId,
      netUsd,
      grossUsd,
      digest,
    });

    return {
      sessionId,
      netUsd,
      grossUsd,
      grossUsdcBaseUnits: grossBaseUnits.toString(),
      walletAddress: suiWallet,
      externalCustomerId,
      moonpay: {
        publishableKey,
        environment,
        baseCurrencyCode,
        baseCurrencyAmount: usdcBaseUnitsToDecimalString(grossBaseUnits),
        lockAmount: 'true',
      },
      suiFundDigest: digest,
    };
  }

  /**
   * Webhook: mark session completed when MoonPay reports a finished sell transaction.
   * Payload shape varies; we accept common `type` + nested `data` patterns.
   */
  async handleWebhookPayload(body: unknown): Promise<void> {
    const rec = body as Record<string, unknown>;
    const type = typeof rec.type === 'string' ? rec.type : '';
    const data = rec.data && typeof rec.data === 'object' && rec.data !== null ? (rec.data as Record<string, unknown>) : rec;

    const status = typeof data.status === 'string' ? data.status : '';
    const externalCustomerId =
      (typeof data.externalCustomerId === 'string' && data.externalCustomerId) ||
      (typeof data.external_customer_id === 'string' && data.external_customer_id) ||
      '';

    const txId =
      (typeof data.id === 'string' && data.id) ||
      (typeof data.transactionId === 'string' && data.transactionId) ||
      (typeof data.transaction_id === 'string' && data.transaction_id) ||
      null;

    const completed =
      status === 'completed' ||
      status === 'complete' ||
      type === 'transaction_completed' ||
      (type === 'transaction_updated' && status === 'completed');

    if (!completed || !externalCustomerId) {
      logger.debug('MoonPay webhook: ignored or incomplete payload', { type, status });
      return;
    }

    const update = await pool.query(
      `UPDATE moonpay_offramp_sessions
       SET status = 'moonpay_completed',
           moonpay_transaction_id = COALESCE($2, moonpay_transaction_id),
           moonpay_payload = $3::jsonb,
           updated_at = NOW()
       WHERE external_customer_id = $1 AND status = 'funded'
       RETURNING id`,
      [externalCustomerId, txId, JSON.stringify(rec)]
    );

    if (update.rowCount === 0) {
      logger.warn('MoonPay webhook: no matching funded session', { externalCustomerId, txId });
      return;
    }

    logger.info('MoonPay off-ramp marked completed', {
      sessionId: update.rows[0]?.id,
      externalCustomerId,
      moonpayTransactionId: txId,
    });
  }
}

export default new MoonPayOfframpService();
