/**
 * Payment Service
 * 
 * Handles deposits into the custodial wallet and integrates Stripe with the ledger system
 * This is the bridge between external payment rails (Stripe) and internal balance tracking
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import ledgerService from './ledger.service';
import stripeService from './stripe.service';
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
   * Process booking payment through custodial wallet
   * Customer pays from their internal balance (not directly via Stripe)
   */
  async processBookingPayment(params: {
    bookingId: string;
    customerId: string;
    barberId: string;
    totalAmountCents: number;
    tipAmountCents?: number;
  }): Promise<void> {
    const { bookingId, customerId, barberId, totalAmountCents, tipAmountCents } = params;

    // Calculate platform fee (5%)
    const { platformFee } = stripeService.calculateFees(totalAmountCents);

    // Use ledger service to process the booking payment
    await ledgerService.processBookingPayment({
      booking_id: bookingId,
      customer_id: customerId,
      barber_id: barberId,
      total_amount: totalAmountCents,
      platform_fee: platformFee,
      tip_amount: tipAmountCents || 0,
    });

    logger.info('Booking payment processed through custodial wallet', {
      booking_id: bookingId,
      customer_id: customerId,
      barber_id: barberId,
      total_amount: centsToDollars(totalAmountCents),
      platform_fee: centsToDollars(platformFee),
    });
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
   * Release funds when service is completed
   * Moves funds from barber's pending to available
   */
  async releaseBookingFunds(params: {
    bookingId: string;
    barberId: string;
    amountCents: number;
  }): Promise<void> {
    const { bookingId, barberId, amountCents } = params;

    await ledgerService.releaseBookingFunds(bookingId, barberId, amountCents);

    logger.info('Booking funds released', {
      booking_id: bookingId,
      barber_id: barberId,
      amount: centsToDollars(amountCents),
    });
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

