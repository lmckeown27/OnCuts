/**
 * Payment Service
 * 
 * Orchestrates the USDC-based payment flow:
 * 1. Consumer pays USD via Stripe
 * 2. Convert USD → USDC via Circle
 * 3. Lock USDC in smart contract escrow
 * 4. Service happens
 * 5. Release USDC to barber (95%) and platform (5%)
 * 6. Convert USDC → USD for barber payout
 * 
 * Gas fees paid separately by platform's APT wallet
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import ledgerService from './ledger.service';
import stripeService from './stripe.service';
import usdcService from './usdc.service';
import gasWalletService from './gas-wallet.service';
import aptosService from './aptos.service';
import {
  TransactionType,
  BalanceType,
  dollarsToCents,
  centsToDollars,
} from '../types/wallet.types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

class PaymentService {
  /**
   * Process deposit (user adds funds via Stripe)
   * This is the ONLY way money enters the CampusCuts ecosystem
   */
  async processDeposit(params: {
    userId: string;
    amountCents: number;
    paymentMethodId: string;
    description?: string;
  }): Promise<{ success: boolean; ledgerEntryId: string; stripeChargeId: string }> {
    const { userId, amountCents, paymentMethodId, description } = params;

    try {
      // 1. Create and confirm Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        description: description || 'CampusCuts wallet deposit',
        metadata: {
          user_id: userId,
          type: 'deposit',
        },
      });

      if (paymentIntent.status !== 'succeeded') {
        throw new ApiError(400, 'Payment failed');
      }

      // 2. Credit user's available balance in ledger
      const ledgerEntry = await ledgerService.createLedgerEntry({
        user_id: userId,
        amount: amountCents,
        type: TransactionType.DEPOSIT,
        balance_type: BalanceType.AVAILABLE,
        reference_type: 'stripe_payment_intent',
        reference_id: paymentIntent.id,
        description: `Deposit via payment method ${paymentMethodId.substring(0, 10)}...`,
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          payment_method_id: paymentMethodId,
        },
      });

      logger.info('Deposit processed successfully', {
        user_id: userId,
        amount: centsToDollars(amountCents),
        payment_intent_id: paymentIntent.id,
        ledger_entry_id: ledgerEntry.id,
      });

      return {
        success: true,
        ledgerEntryId: ledgerEntry.id,
        stripeChargeId: paymentIntent.id,
      };
    } catch (error: any) {
      logger.error('Deposit processing failed', {
        user_id: userId,
        amount: centsToDollars(amountCents),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create payment intent for deposit (for use with Stripe Elements)
   */
  async createDepositIntent(params: {
    userId: string;
    amountCents: number;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const { userId, amountCents } = params;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          user_id: userId,
          type: 'deposit',
        },
        description: 'CampusCuts wallet deposit',
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      logger.error('Failed to create deposit intent', {
        user_id: userId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to create payment intent');
    }
  }

  /**
   * Handle deposit confirmation from Stripe webhook
   * Call this when receiving payment_intent.succeeded webhook
   */
  async confirmDeposit(paymentIntentId: string): Promise<void> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new ApiError(400, 'Payment not successful');
      }

      const userId = paymentIntent.metadata.user_id;
      if (!userId) {
        throw new ApiError(400, 'Missing user_id in payment metadata');
      }

      // Credit user's balance
      await ledgerService.createLedgerEntry({
        user_id: userId,
        amount: paymentIntent.amount,
        type: TransactionType.DEPOSIT,
        balance_type: BalanceType.AVAILABLE,
        reference_type: 'stripe_payment_intent',
        reference_id: paymentIntentId,
        description: 'Deposit confirmed',
        metadata: {
          stripe_payment_intent_id: paymentIntentId,
        },
      });

      logger.info('Deposit confirmed via webhook', {
        user_id: userId,
        amount: centsToDollars(paymentIntent.amount),
        payment_intent_id: paymentIntentId,
      });
    } catch (error: any) {
      logger.error('Failed to confirm deposit', {
        payment_intent_id: paymentIntentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process booking payment through USDC escrow
   * 
   * Full flow:
   * 1. Stripe payment confirmed ($25 USD)
   * 2. Convert $25 → 25 USDC via Circle
   * 3. Create escrow on Aptos smart contract (locks 25 USDC)
   * 4. Update booking status to "paid"
   * 
   * Gas: Paid by platform's APT wallet
   */
  async processBookingPayment(params: {
    bookingId: string;
    customerId: string;
    barberId: string;
    barberAptosAddress: string;
    consumerAptosAddress: string;
    totalAmountCents: number;
    stripePaymentIntentId: string;
  }): Promise<{ escrowTxHash: string; usdcAmount: number }> {
    const {
      bookingId,
      customerId,
      barberId,
      barberAptosAddress,
      consumerAptosAddress,
      totalAmountCents,
      stripePaymentIntentId,
    } = params;

    try {
      const amountUsd = centsToDollars(totalAmountCents);

      logger.info('💳 Starting USDC booking payment flow', {
        booking_id: bookingId,
        amount_usd: amountUsd,
        barber_id: barberId,
        consumer_id: customerId,
      });

      // Step 1: Convert USD to USDC via Circle
      const usdcConversion = await usdcService.convertUsdToUsdc(
        amountUsd,
        process.env.APTOS_PLATFORM_ADDRESS!, // Platform's custodial wallet
        {
          bookingId,
          userId: customerId,
          description: `Booking payment for ${bookingId}`,
        }
      );

      logger.info('✅ USD → USDC conversion successful', {
        transfer_id: usdcConversion.transferId,
        amount_usdc: usdcConversion.amountUsdc,
      });

      // Step 2: Wait for USDC to arrive on-chain (typically 1-5 minutes)
      // In production, use webhook to detect arrival. For now, poll.
      await this.waitForUsdcArrival(usdcConversion.transferId, 30000); // 30 sec timeout

      // Step 3: Create escrow on smart contract
      // This locks the USDC until service completion
      const escrowTxHash = await aptosService.createUsdcEscrow({
        bookingId,
        amountUsdc: usdcConversion.amountUsdc,
        barberAddress: barberAptosAddress,
        consumerAddress: consumerAptosAddress,
        stripePaymentId: stripePaymentIntentId,
      });

      logger.info('🔒 USDC locked in escrow', {
        booking_id: bookingId,
        tx_hash: escrowTxHash,
        amount_usdc: usdcConversion.amountUsdc,
      });

      // Step 4: Log gas usage
      await gasWalletService.logGasUsage({
        transaction_hash: escrowTxHash,
        transaction_type: 'create_escrow',
        gas_used_apt: gasWalletService.estimateGasCost('create_escrow'),
        booking_id: bookingId,
      });

      // Step 5: Update ledger for tracking (optional - blockchain is source of truth)
      await ledgerService.processBookingPayment({
        booking_id: bookingId,
        customer_id: customerId,
        barber_id: barberId,
        total_amount: totalAmountCents,
        platform_fee: Math.floor(totalAmountCents * 0.05),
        tip_amount: 0,
      });

      return {
        escrowTxHash,
        usdcAmount: usdcConversion.amountUsdc,
      };
    } catch (error: any) {
      logger.error('❌ USDC booking payment failed', {
        booking_id: bookingId,
        error: error.message,
      });
      throw new ApiError(500, `Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Wait for USDC to arrive on-chain after Circle transfer
   * Polls Circle API until status is 'complete'
   */
  private async waitForUsdcArrival(transferId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await usdcService.getTransferStatus(transferId);

      if (status.status === 'complete') {
        logger.info('✅ USDC transfer confirmed on-chain', { transfer_id: transferId });
        return;
      } else if (status.status === 'failed') {
        throw new ApiError(500, 'USDC transfer failed');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new ApiError(504, 'USDC transfer timeout - payment may still be processing');
  }

  /**
   * Process tip
   */
  async processTip(params: {
    fromUserId: string;
    toUserId: string;
    amountCents: number;
    bookingId?: string;
  }): Promise<void> {
    const { fromUserId, toUserId, amountCents, bookingId } = params;

    await ledgerService.internalTransfer({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: amountCents,
      type: TransactionType.TIP,
      reference_type: bookingId ? 'booking' : undefined,
      reference_id: bookingId,
      description: bookingId 
        ? `Tip for booking ${bookingId}` 
        : 'Tip',
    });

    logger.info('Tip processed', {
      from: fromUserId,
      to: toUserId,
      amount: centsToDollars(amountCents),
      booking_id: bookingId,
    });
  }

  /**
   * Refund booking payment
   */
  async refundBookingPayment(params: {
    bookingId: string;
    customerId: string;
    barberId: string;
    totalAmountCents: number;
    partialAmountCents?: number;
  }): Promise<void> {
    const { bookingId, customerId, barberId, totalAmountCents, partialAmountCents } = params;

    const refundAmount = partialAmountCents || totalAmountCents;

    await ledgerService.internalTransfer({
      from_user_id: barberId,
      to_user_id: customerId,
      amount: refundAmount,
      type: TransactionType.BOOKING_REFUND,
      reference_type: 'booking',
      reference_id: bookingId,
      description: `Refund for booking ${bookingId}`,
    });

    logger.info('Booking payment refunded', {
      booking_id: bookingId,
      customer_id: customerId,
      barber_id: barberId,
      refund_amount: centsToDollars(refundAmount),
    });
  }

  /**
   * Release USDC funds when service is completed
   * 
   * Flow:
   * 1. Call smart contract to release escrow
   * 2. USDC automatically splits: 95% barber, 5% platform
   * 3. Barber can request payout (USDC → USD) anytime
   * 
   * Gas: Paid by platform's APT wallet
   */
  async releaseBookingFunds(params: {
    bookingId: string;
    barberId: string;
    barberAptosAddress: string;
    amountCents: number;
  }): Promise<{ releaseTxHash: string }> {
    const { bookingId, barberId, barberAptosAddress, amountCents } = params;

    try {
      logger.info('💸 Releasing USDC escrow', {
        booking_id: bookingId,
        barber_id: barberId,
        amount_usd: centsToDollars(amountCents),
      });

      // Call smart contract to release USDC
      const releaseTxHash = await aptosService.releaseUsdcEscrow(bookingId);

      logger.info('✅ USDC released from escrow', {
        booking_id: bookingId,
        tx_hash: releaseTxHash,
        barber_payout_usd: centsToDollars(Math.floor(amountCents * 0.95)),
        platform_fee_usd: centsToDollars(Math.floor(amountCents * 0.05)),
      });

      // Log gas usage
      await gasWalletService.logGasUsage({
        transaction_hash: releaseTxHash,
        transaction_type: 'release_payment',
        gas_used_apt: gasWalletService.estimateGasCost('release_payment'),
        booking_id: bookingId,
      });

      // Update ledger (optional tracking)
      await ledgerService.releaseBookingFunds(bookingId, barberId, amountCents);

      return { releaseTxHash };
    } catch (error: any) {
      logger.error('❌ Failed to release USDC escrow', {
        booking_id: bookingId,
        error: error.message,
      });
      throw new ApiError(500, `Failed to release funds: ${error.message}`);
    }
  }

  /**
   * Request barber payout (USDC → USD)
   * Converts barber's USDC balance to USD and sends to bank account
   * 
   * Flow:
   * 1. Check barber's USDC balance on Aptos
   * 2. Call Circle to convert USDC → USD
   * 3. Circle deposits USD to barber's linked bank account
   * 4. Update barber's payout history
   */
  async requestBarberPayout(params: {
    barberId: string;
    barberAptosAddress: string;
    circleBankAccountId: string;
    amountUsdc: number;
  }): Promise<{ payoutTransferId: string; amountUsd: number }> {
    const { barberId, barberAptosAddress, circleBankAccountId, amountUsdc } = params;

    try {
      logger.info('💵 Processing barber payout', {
        barber_id: barberId,
        amount_usdc: amountUsdc,
      });

      // Convert USDC → USD via Circle
      const payout = await usdcService.convertUsdcToUsd(
        amountUsdc,
        circleBankAccountId,
        barberAptosAddress,
        {
          barberId,
          description: `CampusCuts payout for barber ${barberId}`,
        }
      );

      logger.info('✅ Barber payout initiated', {
        barber_id: barberId,
        transfer_id: payout.transferId,
        amount_usd: payout.amountUsd,
        eta: '1-2 business days',
      });

      return {
        payoutTransferId: payout.transferId,
        amountUsd: payout.amountUsd,
      };
    } catch (error: any) {
      logger.error('❌ Failed to process barber payout', {
        barber_id: barberId,
        error: error.message,
      });
      throw new ApiError(500, `Payout failed: ${error.message}`);
    }
  }

  /**
   * Issue promotional credit
   */
  async issuePromotionalCredit(params: {
    userId: string;
    amountCents: number;
    description: string;
    adminId?: string;
  }): Promise<void> {
    const { userId, amountCents, description, adminId } = params;

    await ledgerService.createLedgerEntry({
      user_id: userId,
      amount: amountCents,
      type: TransactionType.PROMOTIONAL_CREDIT,
      balance_type: BalanceType.AVAILABLE,
      description,
      created_by: adminId,
      metadata: {
        promo_type: 'platform_credit',
      },
    });

    logger.info('Promotional credit issued', {
      user_id: userId,
      amount: centsToDollars(amountCents),
      admin_id: adminId,
    });
  }

  /**
   * Get payment methods for a user
   */
  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error: any) {
      logger.error('Failed to retrieve payment methods', {
        customer_id: customerId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to retrieve payment methods');
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      logger.info('Payment method attached', {
        customer_id: customerId,
        payment_method_id: paymentMethodId,
      });
    } catch (error: any) {
      logger.error('Failed to attach payment method', {
        customer_id: customerId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to attach payment method');
    }
  }
}

export default new PaymentService();

