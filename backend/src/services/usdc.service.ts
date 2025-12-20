/**
 * USDC Service
 * 
 * Handles USD ↔ USDC conversions via Circle API
 * Circle provides the infrastructure for converting fiat to USDC and back
 * 
 * Architecture:
 * - Consumer pays $25 USD via Stripe → CampusCuts bank account
 * - This service converts $25 → 25 USDC (1:1) via Circle
 * - USDC sent to platform's Aptos custodial wallet
 * - After service: 23.75 USDC converted back to $23.75 → Barber bank account
 * 
 * Why Circle?
 * - Industry standard for USDC on/off ramp
 * - 1:1 USD-USDC guarantee
 * - Regulatory compliant (licensed as a money transmitter)
 * - No price slippage (unlike DEX swaps)
 * - Instant settlement
 * 
 * Gas fees: Paid separately in APT by platform (not from USDC)
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

interface CircleTransferResponse {
  id: string;
  source: {
    type: string;
    id: string;
  };
  destination: {
    type: string;
    chain: string;
    address: string;
  };
  amount: {
    amount: string;
    currency: string;
  };
  status: 'pending' | 'complete' | 'failed';
  createDate: string;
}

interface UsdcConversionResult {
  transferId: string;
  amountUsdc: number;
  amountUsd: number;
  status: string;
  destinationAddress: string;
}

class UsdcService {
  private circleApiKey: string;
  private circleApiUrl: string;
  private platformWalletAddress: string;

  constructor() {
    this.circleApiKey = process.env.CIRCLE_API_KEY || '';
    this.circleApiUrl = process.env.CIRCLE_API_URL || 'https://api-sandbox.circle.com';
    this.platformWalletAddress = process.env.APTOS_PLATFORM_ADDRESS || '';

    if (!this.circleApiKey) {
      logger.warn('⚠️  CIRCLE_API_KEY not configured - USDC conversions will fail');
    }
  }

  /**
   * Convert USD to USDC and send to Aptos wallet
   * Called after Stripe payment succeeds
   * 
   * Flow:
   * 1. Stripe confirms $25 USD payment
   * 2. Circle converts $25 → 25 USDC
   * 3. Circle sends 25 USDC to platform's Aptos wallet
   * 4. Backend creates escrow on-chain
   * 
   * @param amountUsd - Amount in USD (e.g., 25.00)
   * @param destinationAddress - Aptos wallet address to receive USDC
   * @param metadata - Additional tracking data (booking ID, user ID, etc.)
   */
  async convertUsdToUsdc(
    amountUsd: number,
    destinationAddress: string,
    metadata?: {
      bookingId?: string;
      userId?: string;
      description?: string;
    }
  ): Promise<UsdcConversionResult> {
    try {
      if (!this.circleApiKey) {
        throw new ApiError(500, 'Circle API not configured');
      }

      const idempotencyKey = uuidv4();

      // Circle API: Create USDC transfer
      const response = await axios.post<CircleTransferResponse>(
        `${this.circleApiUrl}/v1/transfers`,
        {
          idempotencyKey,
          source: {
            type: 'wallet',
            id: process.env.CIRCLE_WALLET_ID, // CampusCuts' Circle master wallet
          },
          destination: {
            type: 'blockchain',
            chain: 'APT', // Aptos blockchain
            address: destinationAddress,
          },
          amount: {
            amount: amountUsd.toFixed(2),
            currency: 'USD', // Circle auto-converts to USDC
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.circleApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const transfer = response.data;

      logger.info('💰 USD → USDC conversion initiated', {
        transfer_id: transfer.id,
        amount_usd: amountUsd,
        amount_usdc: amountUsd, // 1:1 conversion
        destination: destinationAddress,
        booking_id: metadata?.bookingId,
        user_id: metadata?.userId,
      });

      return {
        transferId: transfer.id,
        amountUsdc: amountUsd, // Circle guarantees 1:1
        amountUsd: amountUsd,
        status: transfer.status,
        destinationAddress: transfer.destination.address,
      };
    } catch (error: any) {
      logger.error('❌ Failed to convert USD to USDC', {
        amount_usd: amountUsd,
        destination: destinationAddress,
        error: error.response?.data || error.message,
      });

      throw new ApiError(
        500,
        `Failed to convert USD to USDC: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Convert USDC back to USD and send to bank account
   * Called when barber requests payout
   * 
   * Flow:
   * 1. Escrow releases 23.75 USDC to barber's Aptos wallet
   * 2. Backend calls this method to cash out
   * 3. Circle converts 23.75 USDC → $23.75 USD
   * 4. Circle deposits $23.75 to barber's bank account
   * 
   * @param amountUsdc - Amount in USDC (e.g., 23.75)
   * @param barberBankAccountId - Circle bank account ID (linked in barber profile)
   * @param sourceAddress - Aptos wallet holding USDC (barber's wallet)
   * @param metadata - Tracking data
   */
  async convertUsdcToUsd(
    amountUsdc: number,
    barberBankAccountId: string,
    sourceAddress: string,
    metadata?: {
      barberId?: string;
      bookingId?: string;
      description?: string;
    }
  ): Promise<UsdcConversionResult> {
    try {
      if (!this.circleApiKey) {
        throw new ApiError(500, 'Circle API not configured');
      }

      const idempotencyKey = uuidv4();

      // Circle API: Transfer USDC to bank account (auto-converts to USD)
      const response = await axios.post<CircleTransferResponse>(
        `${this.circleApiUrl}/v1/transfers`,
        {
          idempotencyKey,
          source: {
            type: 'blockchain',
            chain: 'APT',
            address: sourceAddress,
          },
          destination: {
            type: 'wire',
            id: barberBankAccountId, // Barber's linked bank account
          },
          amount: {
            amount: amountUsdc.toFixed(2),
            currency: 'USD', // Circle auto-converts USDC → USD
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.circleApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const transfer = response.data;

      logger.info('💸 USDC → USD conversion initiated', {
        transfer_id: transfer.id,
        amount_usdc: amountUsdc,
        amount_usd: amountUsdc, // 1:1 conversion
        barber_id: metadata?.barberId,
        booking_id: metadata?.bookingId,
      });

      return {
        transferId: transfer.id,
        amountUsdc: amountUsdc,
        amountUsd: amountUsdc, // Circle guarantees 1:1
        status: transfer.status,
        destinationAddress: barberBankAccountId,
      };
    } catch (error: any) {
      logger.error('❌ Failed to convert USDC to USD', {
        amount_usdc: amountUsdc,
        barber_bank_account: barberBankAccountId,
        error: error.response?.data || error.message,
      });

      throw new ApiError(
        500,
        `Failed to convert USDC to USD: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Check status of a Circle transfer
   * Use this to verify when USDC arrives on-chain
   */
  async getTransferStatus(transferId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const response = await axios.get<CircleTransferResponse>(
        `${this.circleApiUrl}/v1/transfers/${transferId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.circleApiKey}`,
          },
        }
      );

      const transfer = response.data;

      return {
        status: transfer.status,
        amount: parseFloat(transfer.amount.amount),
        currency: transfer.amount.currency,
      };
    } catch (error: any) {
      logger.error('❌ Failed to fetch transfer status', {
        transfer_id: transferId,
        error: error.response?.data || error.message,
      });

      throw new ApiError(
        500,
        `Failed to fetch transfer status: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Link barber's bank account to Circle
   * Called when barber adds payout method
   * 
   * @param barberUserId - CampusCuts user ID
   * @param bankAccountDetails - ACH routing + account number
   */
  async linkBankAccount(
    barberUserId: string,
    bankAccountDetails: {
      accountNumber: string;
      routingNumber: string;
      accountType: 'checking' | 'savings';
      billingDetails: {
        name: string;
        line1: string;
        city: string;
        postalCode: string;
        country: string;
      };
    }
  ): Promise<{ circleBankAccountId: string }> {
    try {
      if (!this.circleApiKey) {
        throw new ApiError(500, 'Circle API not configured');
      }

      const idempotencyKey = uuidv4();

      const response = await axios.post(
        `${this.circleApiUrl}/v1/banks/wires`,
        {
          idempotencyKey,
          accountNumber: bankAccountDetails.accountNumber,
          routingNumber: bankAccountDetails.routingNumber,
          billingDetails: bankAccountDetails.billingDetails,
          bankAddress: {
            country: bankAccountDetails.billingDetails.country,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.circleApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const bankAccount = response.data;

      logger.info('🏦 Bank account linked to Circle', {
        user_id: barberUserId,
        circle_account_id: bankAccount.id,
      });

      return {
        circleBankAccountId: bankAccount.id,
      };
    } catch (error: any) {
      logger.error('❌ Failed to link bank account', {
        user_id: barberUserId,
        error: error.response?.data || error.message,
      });

      throw new ApiError(
        500,
        `Failed to link bank account: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get USDC balance on Aptos for a given address
   * Uses Aptos node RPC to check USDC coin balance
   */
  async getUsdcBalance(aptosAddress: string): Promise<number> {
    try {
      const nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
      
      const response = await axios.get(
        `${nodeUrl}/accounts/${aptosAddress}/resource/0x1::coin::CoinStore<USDC_MODULE_ADDRESS::USDC>`
      );

      const coinValue = response.data.data.coin.value;
      
      // USDC has 6 decimals (e.g., 25_000000 = 25.00 USDC)
      return parseInt(coinValue) / 1_000_000;
    } catch (error: any) {
      logger.error('❌ Failed to fetch USDC balance', {
        address: aptosAddress,
        error: error.message,
      });

      return 0;
    }
  }

  /**
   * Estimate conversion time for planning
   * Circle transfers typically complete in:
   * - USD → USDC: 1-5 minutes
   * - USDC → USD: 1-2 business days (ACH)
   */
  getEstimatedConversionTime(direction: 'usd-to-usdc' | 'usdc-to-usd'): string {
    if (direction === 'usd-to-usdc') {
      return '1-5 minutes'; // On-chain settlement
    } else {
      return '1-2 business days'; // Bank ACH transfer
    }
  }
}

export default new UsdcService();


