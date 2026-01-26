/**
 * Payment Service V2
 * 
 * Direct payment flow (no escrow):
 * 1. Consumer pays via Stripe
 * 2. Barber receives payment directly (minus platform fee)
 * 3. No funds held by platform
 * 
 * Uses Stripe Connect for direct transfers to barber accounts.
 */

import Stripe from 'stripe';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import transactionService, { TransactionType } from './transaction.service';
// ESCROW DISABLED - Direct payments only
// import escrowService from './escrow.service';
import auditService from './audit.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Platform fee rate (15% - covers Stripe's ~4% processing fee, nets ~11%)
const PLATFORM_FEE_RATE = 0.15;

export interface DepositInput {
  userId: string;
  amountCents: number;
  paymentMethodId: string;
  description?: string;
}

export interface BookingPaymentInput {
  bookingId: string;
  consumerId: string;
  barberId: string;
  amountCents: number;
  serviceDescription?: string;
}

export interface CompleteBookingInput {
  bookingId: string;
  tipCents?: number;
  platformFeeRate?: number;
}

class PaymentServiceV2 {
  /**
   * Create payment intent for booking (direct payment to barber)
   * Flow: Consumer pays → Barber receives (minus fee) → Done
   */
  async createBookingPaymentIntent(input: BookingPaymentInput): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amountCents: number;
    platformFeeCents: number;
    barberReceivesCents: number;
  }> {
    try {
      // Calculate platform fee
      const platformFeeCents = Math.floor(input.amountCents * PLATFORM_FEE_RATE);
      const barberReceivesCents = input.amountCents - platformFeeCents;

      // Get barber's Stripe account ID (if they have one)
      const barberResult = await pool.query(
        `SELECT u.stripe_account_id, u.email, u."firstName", u."lastName"
         FROM users u
         WHERE u.id = $1`,
        [input.barberId]
      );

      const barber = barberResult.rows[0];
      const barberStripeAccountId = barber?.stripe_account_id;

      // Create payment intent
      // If barber has connected Stripe account, use Stripe Connect for direct transfer
      // Otherwise, payment goes to platform and is tracked for manual payout
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: input.amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          booking_id: input.bookingId,
          consumer_id: input.consumerId,
          barber_id: input.barberId,
          type: 'booking_payment',
          platform_fee_cents: platformFeeCents.toString(),
          barber_receives_cents: barberReceivesCents.toString(),
        },
        description: input.serviceDescription || 'CampusCuts booking payment',
      };

      // If barber has Stripe Connect account, set up direct transfer
      if (barberStripeAccountId) {
        paymentIntentParams.transfer_data = {
          destination: barberStripeAccountId,
          amount: barberReceivesCents, // Barber receives amount minus platform fee
        };
        paymentIntentParams.application_fee_amount = platformFeeCents;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      logger.info('Booking payment intent created', {
        payment_intent_id: paymentIntent.id,
        booking_id: input.bookingId,
        amount_dollars: input.amountCents / 100,
        platform_fee_dollars: platformFeeCents / 100,
        barber_receives_dollars: barberReceivesCents / 100,
        direct_transfer: !!barberStripeAccountId,
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amountCents: input.amountCents,
        platformFeeCents,
        barberReceivesCents,
      };
    } catch (error: any) {
      logger.error('Failed to create booking payment intent', {
        booking_id: input.bookingId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to create payment intent');
    }
  }

  /**
   * Process booking payment confirmation (called after Stripe confirms payment)
   * Records the transaction in our system
   */
  async processBookingPayment(input: BookingPaymentInput & { stripePaymentIntentId?: string }): Promise<{
    success: boolean;
    transactionId: number;
  }> {
    try {
      const platformFeeCents = Math.floor(input.amountCents * PLATFORM_FEE_RATE);
      const barberReceivesCents = input.amountCents - platformFeeCents;

      // 1. Record consumer payment transaction
      const consumerTx = await transactionService.createTransaction({
        user_id: input.consumerId,
        type: TransactionType.CHARGE,
        amount: -input.amountCents, // Debit from consumer
        related_booking_id: input.bookingId,
        stripe_payment_intent_id: input.stripePaymentIntentId,
        metadata: {
          barber_id: input.barberId,
          type: 'booking_payment',
        },
      });

      // 2. Record barber earning transaction (amount after platform fee)
      await transactionService.createTransaction({
        user_id: input.barberId,
        type: TransactionType.EARNING,
        amount: barberReceivesCents, // Credit to barber
        related_booking_id: input.bookingId,
        stripe_payment_intent_id: input.stripePaymentIntentId,
        metadata: {
          consumer_id: input.consumerId,
          gross_amount: input.amountCents,
          platform_fee: platformFeeCents,
          type: 'booking_earning',
        },
      });

      // 3. Record platform fee
      await pool.query(
        `INSERT INTO platform_fees (amount, currency, booking_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [platformFeeCents, 'USD', input.bookingId]
      ).catch(() => {
        // Table might not exist, log but continue
        logger.warn('platform_fees table may not exist');
      });

      // 4. Update booking status to paid
      await pool.query(
        `UPDATE bookings SET 
          status = 'paid',
          payment_status = 'completed',
          stripe_payment_intent_id = $1,
          updated_at = NOW()
         WHERE id = $2`,
        [input.stripePaymentIntentId, input.bookingId]
      );

      // 5. Audit log
      await auditService.log({
        actor_user_id: input.consumerId,
        action: 'booking_payment_processed',
        object_type: 'booking',
        object_id: input.bookingId,
        details: {
          amount_cents: input.amountCents,
          platform_fee_cents: platformFeeCents,
          barber_receives_cents: barberReceivesCents,
          stripe_payment_intent_id: input.stripePaymentIntentId,
        },
      });

      logger.info('Booking payment processed (direct)', {
        booking_id: input.bookingId,
        consumer_id: input.consumerId,
        barber_id: input.barberId,
        amount_dollars: input.amountCents / 100,
        fee_dollars: platformFeeCents / 100,
        barber_receives_dollars: barberReceivesCents / 100,
      });

      return {
        success: true,
        transactionId: consumerTx.id,
      };
    } catch (error: any) {
      logger.error('Booking payment processing failed', {
        booking_id: input.bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process deposit via Stripe (for wallet top-up)
   */
  async processDeposit(input: DepositInput): Promise<{
    success: boolean;
    transactionId: number;
    stripePaymentIntentId: string;
  }> {
    try {
      // 1. Create and confirm Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: input.amountCents,
        currency: 'usd',
        payment_method: input.paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        description: input.description || 'CampusCuts wallet deposit',
        metadata: {
          user_id: input.userId,
          type: 'deposit',
        },
      });

      if (paymentIntent.status !== 'succeeded') {
        throw new ApiError(400, 'Payment failed');
      }

      // 2. Credit user's available balance
      const transaction = await transactionService.createTransaction({
        user_id: input.userId,
        type: TransactionType.CHARGE,
        amount: input.amountCents,
        stripe_payment_intent_id: paymentIntent.id,
        metadata: {
          payment_method_id: input.paymentMethodId,
          stripe_status: paymentIntent.status,
        },
      });

      // 3. Audit log
      await auditService.log({
        actor_user_id: input.userId,
        action: 'deposit_processed',
        object_type: 'transaction',
        object_id: transaction.id.toString(),
        details: {
          amount_cents: input.amountCents,
          stripe_payment_intent_id: paymentIntent.id,
        },
      });

      logger.info('Deposit processed', {
        user_id: input.userId,
        amount_dollars: input.amountCents / 100,
        payment_intent_id: paymentIntent.id,
        transaction_id: transaction.id,
      });

      return {
        success: true,
        transactionId: transaction.id,
        stripePaymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      logger.error('Deposit processing failed', {
        user_id: input.userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create payment intent for deposit (for Stripe Elements frontend)
   */
  async createDepositIntent(
    userId: string,
    amountCents: number
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
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
   * Confirm deposit from Stripe webhook
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
      await transactionService.createTransaction({
        user_id: userId,
        type: TransactionType.CHARGE,
        amount: paymentIntent.amount,
        stripe_payment_intent_id: paymentIntentId,
        metadata: {
          confirmed_via_webhook: true,
        },
      });

      logger.info('Deposit confirmed via webhook', {
        user_id: userId,
        amount_dollars: paymentIntent.amount / 100,
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
   * Process refund for cancelled booking
   */
  async processRefund(params: {
    bookingId: string;
    consumerId: string;
    barberId: string;
    amountCents: number;
    stripePaymentIntentId?: string;
    reason: string;
  }): Promise<{ success: boolean; refundId?: string }> {
    try {
      // If we have a Stripe payment intent, refund via Stripe
      if (params.stripePaymentIntentId) {
        const refund = await stripe.refunds.create({
          payment_intent: params.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            booking_id: params.bookingId,
            reason: params.reason,
          },
        });

        logger.info('Stripe refund processed', {
          refund_id: refund.id,
          booking_id: params.bookingId,
          amount_dollars: refund.amount / 100,
        });

        // Record refund transaction
        await transactionService.createTransaction({
          user_id: params.consumerId,
          type: TransactionType.REFUND,
          amount: params.amountCents,
          related_booking_id: params.bookingId,
          metadata: {
            stripe_refund_id: refund.id,
            reason: params.reason,
          },
        });

        return { success: true, refundId: refund.id };
      }

      // No Stripe payment to refund (might be internal balance payment)
      await transactionService.createTransaction({
        user_id: params.consumerId,
        type: TransactionType.REFUND,
        amount: params.amountCents,
        related_booking_id: params.bookingId,
        metadata: {
          reason: params.reason,
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error('Refund processing failed', {
        booking_id: params.bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process tip (direct transfer)
   */
  async processTip(params: {
    fromUserId: string;
    toUserId: string;
    amountCents: number;
    bookingId?: string;
  }): Promise<void> {
    try {
      await transactionService.transfer({
        from_user_id: params.fromUserId,
        to_user_id: params.toUserId,
        amount: params.amountCents,
        type: TransactionType.TIP,
        related_booking_id: params.bookingId,
      });

      logger.info('Tip processed', {
        from: params.fromUserId,
        to: params.toUserId,
        amount_dollars: params.amountCents / 100,
        booking_id: params.bookingId,
      });
    } catch (error: any) {
      logger.error('Tip processing failed', error);
      throw error;
    }
  }

  /**
   * Issue promotional credit (admin)
   */
  async issuePromotionalCredit(params: {
    userId: string;
    amountCents: number;
    description: string;
    adminId?: string;
  }): Promise<void> {
    try {
      await transactionService.createTransaction({
        user_id: params.userId,
        type: TransactionType.ADJUSTMENT,
        amount: params.amountCents,
        metadata: {
          promo_type: 'platform_credit',
          description: params.description,
          issued_by: params.adminId,
        },
      });

      await auditService.log({
        actor_user_id: params.adminId,
        action: 'promotional_credit_issued',
        object_type: 'transaction',
        object_id: params.userId,
        details: {
          amount_cents: params.amountCents,
          description: params.description,
        },
      });

      logger.info('Promotional credit issued', {
        user_id: params.userId,
        amount_dollars: params.amountCents / 100,
        admin_id: params.adminId,
      });
    } catch (error: any) {
      logger.error('Failed to issue promotional credit', error);
      throw error;
    }
  }

  // ============================================================
  // ESCROW METHODS - DISABLED
  // Platform uses direct payments, no escrow holding
  // ============================================================

  /**
   * @deprecated - Escrow disabled. Use processBookingPayment instead.
   */
  async completeBookingPayment(_input: CompleteBookingInput): Promise<{
    released: boolean;
    netToBarber: number;
    platformFee: number;
  }> {
    logger.warn('completeBookingPayment called but escrow is disabled');
    throw new ApiError(501, 'Escrow is disabled. Payments are processed directly.');
  }

  /**
   * @deprecated - Escrow disabled. Use processRefund instead.
   */
  async cancelBookingPayment(
    _bookingId: string,
    _reason: string
  ): Promise<{ refunded: boolean; amount: number }> {
    logger.warn('cancelBookingPayment called but escrow is disabled');
    throw new ApiError(501, 'Escrow is disabled. Use processRefund instead.');
  }
}

export default new PaymentServiceV2();
