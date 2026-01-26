/**
 * Fiat ↔ Blockchain Bridge Service
 * 
 * THE MAGIC MONEY BRIDGE 💰
 * 
 * This service connects the fiat world (Stripe) to the blockchain world (Aptos).
 * Users pay with credit cards, we credit their on-chain USDC balance.
 * Barbers withdraw earnings, we deduct on-chain and send via Stripe.
 * 
 * Flow 1: Deposit (User adds funds)
 * ════════════════════════════════
 * 1. User enters credit card: "Add $100"
 * 2. Stripe charges card: $100 + fees
 * 3. Platform receives fiat → converts to USDC (or uses USDC pool)
 * 4. Submit blockchain transaction → credit user's on-chain balance
 * 5. User sees: "Balance: $100" (they have no idea it's USDC on blockchain!)
 * 
 * Flow 2: Withdrawal (Barber cashes out)
 * ═══════════════════════════════════════
 * 1. Barber clicks "Withdraw $500"
 * 2. Check on-chain balance >= $500
 * 3. Submit blockchain transaction → deduct from on-chain balance
 * 4. Send $500 to barber's bank via Stripe
 * 5. Platform absorbs USDC→Fiat conversion
 * 
 * Platform Economics:
 * - User deposits: Free (no fee)
 * - Booking fee: 15% (collected on-chain)
 * - Withdrawal: $1 flat fee (covers Stripe payout + conversion)
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';
import custodialSignerService from './custodial-signer.service';
import blockchainQueryService from './blockchain-query.service';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// USDC conversion rate (in production, fetch from real-time oracle)
const USDC_TO_USD_RATE = 1.0; // 1 USDC = $1 USD (stablecoin)
const APT_TO_USD_RATE = 10.0; // Example: 1 APT = $10 USD (fetch from oracle in production)

// Platform fee settings
const BOOKING_FEE_PERCENT = 15; // 15% platform fee on bookings
const WITHDRAWAL_FEE_USD = 1.00; // $1 flat withdrawal fee

// Octas conversion (Aptos native unit)
const OCTAS_PER_APT = 100_000_000; // 1 APT = 100,000,000 octas

class FiatBlockchainBridgeService {
  /**
   * Handle Stripe payment success → Credit on-chain balance
   * 
   * Called by Stripe webhook when payment_intent.succeeded
   */
  async handleDeposit(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const amountUSD = paymentIntent.amount / 100; // Stripe amount is in cents
      const customerEmail = paymentIntent.metadata.email;
      
      if (!customerEmail) {
        throw new Error('Customer email not found in payment metadata');
      }

      logger.info(`💰 Deposit initiated: ${customerEmail} → $${amountUSD}`);

      // Step 1: Get user's Aptos address
      const userAddress = custodialSignerService.getUserAddress(customerEmail);

      // Step 2: Convert USD to APT (in octas)
      const amountAPT = amountUSD / APT_TO_USD_RATE;
      const amountOctas = Math.floor(amountAPT * OCTAS_PER_APT);

      // Step 3: Submit blockchain transaction to credit balance
      // Platform signs this transaction (depositing into user's account)
      const tx = await custodialSignerService.signAndSubmitOptimistic('platform@campuscuts.com', {
        function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::deposit_funds`,
        arguments: [
          userAddress,   // user_address
          amountOctas,   // amount (in octas)
        ],
      });

      logger.info(`✅ Deposit completed: ${tx.txHash} - ${customerEmail} +$${amountUSD}`);

      // Step 4: Invalidate user cache (force balance refresh)
      await blockchainQueryService.invalidateUserCache(userAddress);

      // Step 5: Store deposit record (optional - for accounting)
      await this.recordDeposit({
        user_email: customerEmail,
        user_address: userAddress,
        amount_usd: amountUSD,
        amount_octas: amountOctas,
        stripe_payment_intent_id: paymentIntent.id,
        blockchain_tx_hash: tx.txHash,
        timestamp: new Date(),
      });

      logger.info(`📝 Deposit recorded: ${paymentIntent.id}`);
    } catch (error) {
      logger.error('Failed to handle deposit:', error);
      throw error;
    }
  }

  /**
   * Handle withdrawal → Deduct on-chain balance, send fiat via Stripe
   * 
   * Called when barber requests to cash out earnings
   */
  async handleWithdrawal(
    email: string,
    password: string,
    amountUSD: number,
    stripeConnectAccountId: string
  ): Promise<{ success: boolean; txHash?: string; transferId?: string }> {
    try {
      logger.info(`💸 Withdrawal initiated: ${email} → $${amountUSD}`);

      // Step 1: Get user's Aptos address
      const userAddress = custodialSignerService.getUserAddress(email);

      // Step 2: Check on-chain balance
      const balance = await blockchainQueryService.getUserBalance(userAddress);
      if (!balance) {
        throw new Error('User balance not found on blockchain');
      }

      const availableOctas = parseInt(balance.available);
      const availableUSD = (availableOctas / OCTAS_PER_APT) * APT_TO_USD_RATE;

      // Step 3: Validate withdrawal amount (including fee)
      const totalWithFee = amountUSD + WITHDRAWAL_FEE_USD;
      if (availableUSD < totalWithFee) {
        throw new Error(`Insufficient balance. Available: $${availableUSD.toFixed(2)}, Required: $${totalWithFee.toFixed(2)}`);
      }

      // Step 4: Convert USD to octas
      const withdrawalOctas = Math.floor((amountUSD / APT_TO_USD_RATE) * OCTAS_PER_APT);
      const feeOctas = Math.floor((WITHDRAWAL_FEE_USD / APT_TO_USD_RATE) * OCTAS_PER_APT);
      const totalOctas = withdrawalOctas + feeOctas;

      // Step 5: Submit blockchain transaction to deduct balance
      const account = await custodialSignerService.createUserAccount(email, password);
      const tx = await custodialSignerService.signAndSubmitOptimistic(email, {
        function: `${process.env.APTOS_MODULE_ADDRESS}::user_accounts::withdraw_funds`,
        arguments: [
          userAddress,   // user_address
          totalOctas,    // amount (withdrawal + fee)
        ],
      });

      logger.info(`✅ On-chain withdrawal: ${tx.txHash} - ${email} -$${amountUSD}`);

      // Step 6: Send fiat to barber via Stripe (Stripe Connect transfer)
      const transfer = await stripe.transfers.create({
        amount: Math.floor(amountUSD * 100), // Stripe amount in cents
        currency: 'usd',
        destination: stripeConnectAccountId,
        description: `CampusCuts withdrawal - $${amountUSD}`,
        metadata: {
          user_email: email,
          user_address: userAddress,
          blockchain_tx_hash: tx.txHash,
        },
      });

      logger.info(`✅ Stripe transfer sent: ${transfer.id} - $${amountUSD} to ${stripeConnectAccountId}`);

      // Step 7: Invalidate cache
      await blockchainQueryService.invalidateUserCache(userAddress);

      // Step 8: Record withdrawal
      await this.recordWithdrawal({
        user_email: email,
        user_address: userAddress,
        amount_usd: amountUSD,
        fee_usd: WITHDRAWAL_FEE_USD,
        amount_octas: totalOctas,
        stripe_transfer_id: transfer.id,
        stripe_connect_account_id: stripeConnectAccountId,
        blockchain_tx_hash: tx.txHash,
        timestamp: new Date(),
      });

      return {
        success: true,
        txHash: tx.txHash,
        transferId: transfer.id,
      };
    } catch (error) {
      logger.error('Failed to handle withdrawal:', error);
      throw error;
    }
  }

  /**
   * Calculate platform fee for a booking
   * 
   * Example: $30 haircut → $2.70 platform fee (9%)
   */
  calculatePlatformFee(bookingAmountUSD: number): {
    totalAmount: number;
    barberAmount: number;
    platformFee: number;
    amountOctas: number;
    barberOctas: number;
    feeOctas: number;
  } {
    const platformFee = bookingAmountUSD * (BOOKING_FEE_PERCENT / 100);
    const barberAmount = bookingAmountUSD - platformFee;

    // Convert to octas
    const amountOctas = Math.floor((bookingAmountUSD / APT_TO_USD_RATE) * OCTAS_PER_APT);
    const feeOctas = Math.floor((platformFee / APT_TO_USD_RATE) * OCTAS_PER_APT);
    const barberOctas = amountOctas - feeOctas;

    return {
      totalAmount: bookingAmountUSD,
      barberAmount,
      platformFee,
      amountOctas,
      barberOctas,
      feeOctas,
    };
  }

  /**
   * Get user's balance in USD (for display)
   */
  async getUserBalanceUSD(userAddress: string): Promise<{
    available: number;
    locked: number;
    total: number;
  } | null> {
    try {
      const balance = await blockchainQueryService.getUserBalance(userAddress);
      if (!balance) return null;

      const availableOctas = parseInt(balance.available);
      const lockedOctas = parseInt(balance.locked);

      const availableAPT = availableOctas / OCTAS_PER_APT;
      const lockedAPT = lockedOctas / OCTAS_PER_APT;

      const availableUSD = availableAPT * APT_TO_USD_RATE;
      const lockedUSD = lockedAPT * APT_TO_USD_RATE;
      const totalUSD = availableUSD + lockedUSD;

      return {
        available: parseFloat(availableUSD.toFixed(2)),
        locked: parseFloat(lockedUSD.toFixed(2)),
        total: parseFloat(totalUSD.toFixed(2)),
      };
    } catch (error) {
      logger.error(`Failed to get balance for ${userAddress}:`, error);
      return null;
    }
  }

  /**
   * Record deposit transaction (for audit trail)
   * In production, this would go to an accounting database or blockchain event log
   */
  private async recordDeposit(deposit: {
    user_email: string;
    user_address: string;
    amount_usd: number;
    amount_octas: number;
    stripe_payment_intent_id: string;
    blockchain_tx_hash: string;
    timestamp: Date;
  }): Promise<void> {
    // In production, store in accounting database or emit event
    logger.info(`📝 Deposit recorded:`, deposit);
    
    // TODO: Store in database or event log for compliance
    // await pool.query('INSERT INTO deposits (...) VALUES (...)');
  }

  /**
   * Record withdrawal transaction (for audit trail)
   */
  private async recordWithdrawal(withdrawal: {
    user_email: string;
    user_address: string;
    amount_usd: number;
    fee_usd: number;
    amount_octas: number;
    stripe_transfer_id: string;
    stripe_connect_account_id: string;
    blockchain_tx_hash: string;
    timestamp: Date;
  }): Promise<void> {
    // In production, store in accounting database or emit event
    logger.info(`📝 Withdrawal recorded:`, withdrawal);
    
    // TODO: Store in database or event log for compliance
    // await pool.query('INSERT INTO withdrawals (...) VALUES (...)');
  }

  /**
   * Get current conversion rates (for display)
   * In production, fetch from real-time oracle
   */
  getConversionRates(): {
    usdcToUsd: number;
    aptToUsd: number;
    bookingFeePercent: number;
    withdrawalFeeUsd: number;
  } {
    return {
      usdcToUsd: USDC_TO_USD_RATE,
      aptToUsd: APT_TO_USD_RATE,
      bookingFeePercent: BOOKING_FEE_PERCENT,
      withdrawalFeeUsd: WITHDRAWAL_FEE_USD,
    };
  }

  /**
   * Create Stripe PaymentIntent for deposit
   * 
   * Frontend calls this to initiate a deposit
   */
  async createDepositIntent(
    email: string,
    amountUSD: number
  ): Promise<Stripe.PaymentIntent> {
    try {
      const amountCents = Math.floor(amountUSD * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        metadata: {
          email,
          type: 'balance_deposit',
          amount_usd: amountUSD.toString(),
        },
        description: `CampusCuts balance deposit - $${amountUSD}`,
      });

      logger.info(`💳 Payment intent created: ${paymentIntent.id} for ${email} ($${amountUSD})`);

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new FiatBlockchainBridgeService();

