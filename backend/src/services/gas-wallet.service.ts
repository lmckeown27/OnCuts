/**
 * Gas Wallet Service
 * 
 * Manages the platform's APT wallet used for paying gas fees
 * 
 * Architecture:
 * - Platform holds a separate APT wallet for gas only
 * - All smart contract transactions (create escrow, release payment, etc.) paid by this wallet
 * - USDC and APT are separate: USDC for payments, APT for gas
 * - Admin can monitor and top-up via admin dashboard
 * 
 * Gas Fee Economics:
 * - Aptos gas is extremely cheap (~$0.0001 per transaction)
 * - Platform pays all gas fees (not users)
 * - Example: 1000 bookings ≈ $0.10 in gas fees
 * - Auto-alerts when balance drops below threshold
 * 
 * Security:
 * - Gas wallet private key stored in .env (encrypted in production)
 * - Only backend has access
 * - Cannot be drained by users
 */

import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

interface GasWalletStatus {
  address: string;
  balance_apt: number;
  balance_usd_estimate: number;
  estimated_transactions_remaining: number;
  needs_refill: boolean;
  last_checked_at: string;
}

class GasWalletService {
  private gasWalletAddress: string = '';
  private isEnabled: boolean = false;
  
  // Thresholds for alerts
  private readonly MIN_BALANCE_APT = 10; // Alert when below 10 APT
  private readonly CRITICAL_BALANCE_APT = 2; // Critical alert when below 2 APT
  private readonly AVG_GAS_PER_TX_APT = 0.0001; // Approximate gas cost per transaction

  constructor() {
    this.gasWalletAddress =
      process.env.SUI_GAS_WALLET_ADDRESS ||
      process.env.GAS_WALLET_ADDRESS ||
      '';
    this.isEnabled = false;
    logger.warn(
      'Gas Wallet Service: legacy Aptos gas wallet removed — use Sui sponsored txs (GAS_SPONSOR_SECRET)'
    );
  }

  /**
   * Check if gas wallet service is enabled
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Ensure service is configured, throw if not
   */
  private ensureConfigured(): never {
    throw new Error('Gas Wallet Service is not configured. Use Sui gas sponsorship.');
  }

  /**
   * Get current gas wallet status
   * Called by admin dashboard to display gas meter
   */
  async getGasWalletStatus(): Promise<GasWalletStatus> {
    if (!this.isEnabled) {
      return {
        address: 'Not configured',
        balance_apt: 0,
        balance_usd_estimate: 0,
        estimated_transactions_remaining: 0,
        needs_refill: false,
        last_checked_at: new Date().toISOString(),
      };
    }

    try {
      const balance = await this.getBalance();
      const aptPrice = await this.getAptPrice();
      const balanceUsd = balance * aptPrice;
      const estimatedTxRemaining = Math.floor(balance / this.AVG_GAS_PER_TX_APT);
      const needsRefill = balance < this.MIN_BALANCE_APT;

      return {
        address: this.gasWalletAddress,
        balance_apt: balance,
        balance_usd_estimate: balanceUsd,
        estimated_transactions_remaining: estimatedTxRemaining,
        needs_refill: needsRefill,
        last_checked_at: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('❌ Failed to get gas wallet status', { error: error.message });
      throw new ApiError(500, 'Failed to get gas wallet status');
    }
  }

  /**
   * Get gas wallet APT balance
   */
  async getBalance(): Promise<number> {
    return 0;
  }

  /**
   * Check if gas wallet needs refill
   * Returns alert level: 'ok' | 'low' | 'critical'
   */
  async checkBalanceStatus(): Promise<{
    status: 'ok' | 'low' | 'critical';
    balance_apt: number;
    message: string;
  }> {
    const balance = await this.getBalance();

    if (balance < this.CRITICAL_BALANCE_APT) {
      return {
        status: 'critical',
        balance_apt: balance,
        message: `🚨 CRITICAL: Gas wallet has only ${balance.toFixed(4)} APT. Platform may stop processing bookings!`,
      };
    } else if (balance < this.MIN_BALANCE_APT) {
      return {
        status: 'low',
        balance_apt: balance,
        message: `⚠️  LOW: Gas wallet has ${balance.toFixed(4)} APT. Consider refilling soon.`,
      };
    } else {
      return {
        status: 'ok',
        balance_apt: balance,
        message: `✅ OK: Gas wallet has ${balance.toFixed(4)} APT.`,
      };
    }
  }

  /**
   * Estimate gas cost for a transaction
   * Used for budgeting and monitoring
   */
  estimateGasCost(transactionType: 'create_escrow' | 'release_payment' | 'refund'): number {
    // Average gas costs per transaction type
    const gasCosts = {
      create_escrow: 0.00012, // APT
      release_payment: 0.00015, // APT (two coin transfers)
      refund: 0.00010, // APT (single transfer)
    };

    return gasCosts[transactionType] || this.AVG_GAS_PER_TX_APT;
  }

  /**
   * Get gas wallet address (for admin to send APT)
   */
  getGasWalletAddress(): string {
    return this.gasWalletAddress;
  }

  /**
   * Get current APT price in USD (approximate)
   * Uses CoinGecko API or fallback to fixed estimate
   */
  async getAptPrice(): Promise<number> {
    try {
      // Try CoinGecko API
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd'
      );
      const data = await response.json() as { aptos?: { usd?: number } };
      
      if (data.aptos && data.aptos.usd) {
        return data.aptos.usd;
      }

      // Fallback: use approximate price
      return 10.0; // $10 per APT (update manually)
    } catch (error) {
      logger.warn('⚠️  Failed to fetch APT price, using fallback', { error });
      return 10.0; // Fallback estimate
    }
  }

  /**
   * Log gas usage for a transaction
   * Used for analytics and cost tracking
   */
  async logGasUsage(params: {
    transaction_hash: string;
    transaction_type: string;
    gas_used_apt: number;
    booking_id?: string;
  }): Promise<void> {
    const aptPrice = await this.getAptPrice();
    const gasUsd = params.gas_used_apt * aptPrice;

    logger.info('⛽ Gas used for transaction', {
      tx_hash: params.transaction_hash,
      type: params.transaction_type,
      gas_apt: params.gas_used_apt.toFixed(6),
      gas_usd: gasUsd.toFixed(4),
      booking_id: params.booking_id,
    });

    // TODO: Store in database for analytics
    // await prisma.gasLog.create({
    //   data: {
    //     transaction_hash: params.transaction_hash,
    //     transaction_type: params.transaction_type,
    //     gas_used_apt: params.gas_used_apt,
    //     gas_used_usd: gasUsd,
    //     booking_id: params.booking_id,
    //     created_at: new Date(),
    //   },
    // });
  }

  /**
   * Fund gas wallet from faucet (devnet only)
   * Use for testing on devnet
   */
  async fundFromFaucet(): Promise<void> {
    if (process.env.APTOS_NETWORK === 'mainnet') {
      throw new ApiError(400, 'Cannot use faucet on mainnet');
    }

    try {
      const faucetUrl = process.env.APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com';
      
      const response = await fetch(
        `${faucetUrl}/mint?amount=100000000&address=${this.gasWalletAddress}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Faucet request failed');
      }

      logger.info('✅ Funded gas wallet from faucet (+1 APT)', {
        address: this.gasWalletAddress,
      });
    } catch (error: any) {
      logger.error('❌ Failed to fund from faucet', { error: error.message });
      throw new ApiError(500, 'Failed to fund from faucet');
    }
  }

  /**
   * Get refill instructions for admin
   * Shows how to top-up the gas wallet
   */
  getRefillInstructions(): {
    method: string;
    instructions: string[];
    address: string;
    recommended_amount_apt: number;
  } {
    const isMainnet = process.env.APTOS_NETWORK === 'mainnet';

    if (isMainnet) {
      return {
        method: 'exchange_transfer',
        instructions: [
          '1. Log into your Coinbase/Binance account',
          '2. Navigate to Aptos (APT) wallet',
          '3. Click "Send" or "Withdraw"',
          `4. Enter destination address: ${this.gasWalletAddress}`,
          '5. Enter amount (recommended: 50-100 APT)',
          '6. Confirm transaction',
          '7. Wait 1-2 minutes for confirmation',
        ],
        address: this.gasWalletAddress,
        recommended_amount_apt: 100,
      };
    } else {
      return {
        method: 'faucet',
        instructions: [
          '1. Visit https://www.aptosfaucet.com',
          `2. Enter address: ${this.gasWalletAddress}`,
          '3. Click "Fund Account"',
          '4. Wait ~30 seconds for confirmation',
          '5. Alternatively, call POST /admin/gas-wallet/fund-faucet from API',
        ],
        address: this.gasWalletAddress,
        recommended_amount_apt: 10,
      };
    }
  }

  /**
   * Legacy hook — Aptos removed; use GAS_SPONSOR_SECRET + Sui PTB.
   */
  getGasWalletAccount(): never {
    this.ensureConfigured();
  }
}

export default new GasWalletService();

