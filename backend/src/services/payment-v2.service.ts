/**
 * Payment Service V2
 * 
 * Integrates Stripe with the production escrow-based custodial wallet.
 * 
 * Flow:
 * 1. Deposit: Stripe charge → Credit user balance
 * 2. Booking: User pays → Escrow hold created
 * 3. Completion: Escrow released → Barber gets funds (minus fee)
 * 4. Cancellation: Escrow refunded → User gets money back
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import transactionService, { TransactionType } from './transaction.service';
import escrowService from './escrow.service';
import onchainAnchorService, { RecordType } from './onchain-anchor.service';
import auditService from './audit.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

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
  expiresHours?: number;
}

export interface CompleteBookingInput {
  bookingId: string;
  tipCents?: number;
  platformFeeRate?: number;
}

class PaymentServiceV2 {
  /**
   * Process deposit via Stripe
   * Flow: Stripe charge → User balance increased
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
   * Process booking payment (create escrow hold)
   * Flow: Check balance → Debit user → Create escrow hold
   */
  async processBookingPayment(input: BookingPaymentInput): Promise<{
    escrowId: string;
    transactionId: number;
  }> {
    try {
      // 1. Verify consumer has sufficient balance
      const balance = await transactionService.getUserBalance(input.consumerId);
      
      if (balance.available_amount < input.amountCents) {
        throw new ApiError(
          400,
          `Insufficient balance. Required: $${input.amountCents / 100}, Available: $${balance.available_amount / 100}`
        );
      }

      // 2. Create escrow hold (this debits consumer and credits barber.pending)
      const escrow = await escrowService.createHold({
        booking_id: input.bookingId,
        consumer_id: input.consumerId,
        barber_id: input.barberId,
        amount: input.amountCents,
        expires_hours: input.expiresHours || 48,
      });

      logger.info('Booking payment processed via escrow', {
        booking_id: input.bookingId,
        consumer_id: input.consumerId,
        barber_id: input.barberId,
        amount_dollars: input.amountCents / 100,
        escrow_id: escrow.id,
      });

      return {
        escrowId: escrow.id,
        transactionId: 0, // TODO: Get transaction ID from escrow
      };
    } catch (error: any) {
      logger.error('Booking payment failed', {
        booking_id: input.bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Complete booking and release funds to barber
   * Flow: Release escrow → Barber.pending → Barber.available (minus fee)
   */
  async completeBookingPayment(input: CompleteBookingInput): Promise<{
    released: boolean;
    netToBarber: number;
    platformFee: number;
  }> {
    try {
      // 1. Release escrow
      const result = await escrowService.releaseHold({
        booking_id: input.bookingId,
        tip_cents: input.tipCents,
        platform_fee_rate: input.platformFeeRate || 0.05,
      });

      // 2. Anchor booking completion on-chain (hash proof)
      await onchainAnchorService.anchorBookingCompletion(input.bookingId, {
        barber_id: result.escrow.barber_id,
        consumer_id: result.escrow.consumer_id,
        amount: result.escrow.amount,
        net_to_barber: result.net_to_barber,
        completed_at: new Date().toISOString(),
      });

      const platformFee = result.escrow.amount - result.net_to_barber;

      logger.info('Booking payment completed', {
        booking_id: input.bookingId,
        gross_dollars: result.escrow.amount / 100,
        fee_dollars: platformFee / 100,
        net_dollars: result.net_to_barber / 100,
      });

      return {
        released: true,
        netToBarber: result.net_to_barber,
        platformFee,
      };
    } catch (error: any) {
      logger.error('Booking completion failed', {
        booking_id: input.bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel booking and refund consumer
   * Flow: Refund escrow → Consumer gets money back
   */
  async cancelBookingPayment(
    bookingId: string,
    reason: string
  ): Promise<{ refunded: boolean; amount: number }> {
    try {
      const escrow = await escrowService.refundHold(bookingId, reason);

      logger.info('Booking payment cancelled', {
        booking_id: bookingId,
        consumer_id: escrow.consumer_id,
        amount_dollars: escrow.amount / 100,
        reason,
      });

      return {
        refunded: true,
        amount: escrow.amount,
      };
    } catch (error: any) {
      logger.error('Booking cancellation failed', {
        booking_id: bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process tip (instant internal transfer)
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
}

export default new PaymentServiceV2();

