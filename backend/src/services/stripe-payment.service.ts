/**
 * Stripe Payment Service
 * 
 * Handles customer payments for bookings
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2024-11-20.acacia',
});

const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% platform fee

interface CreatePaymentIntentParams {
  amount: number; // in dollars
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  platformFee: number;
  barberAmount: number;
}

class StripePaymentService {
  /**
   * Create or get customer
   */
  async createOrGetCustomer(email: string, userId: string, name?: string): Promise<string> {
    try {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0].id;
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      logger.info(`Created Stripe customer: ${customer.id} for user: ${userId}`);
      return customer.id;
    } catch (error: any) {
      logger.error('Error creating/getting Stripe customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Create payment intent for booking
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    try {
      const { amount, currency = 'usd', customerId, metadata = {} } = params;

      // Calculate fees
      const amountCents = Math.round(amount * 100); // Convert to cents
      const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENTAGE);
      const barberAmountCents = amountCents - platformFeeCents;

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        customer: customerId,
        metadata: {
          ...metadata,
          platformFee: platformFeeCents.toString(),
          barberAmount: barberAmountCents.toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info(`Created payment intent: ${paymentIntent.id} for $${amount}`);

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: amountCents / 100,
        platformFee: platformFeeCents / 100,
        barberAmount: barberAmountCents / 100,
      };
    } catch (error: any) {
      logger.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm payment was successful
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      logger.error('Error retrieving payment intent:', error);
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Cancel payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
      logger.info(`Cancelled payment intent: ${paymentIntentId}`);
    } catch (error: any) {
      logger.error('Error cancelling payment intent:', error);
      throw new Error(`Failed to cancel payment intent: ${error.message}`);
    }
  }

  /**
   * Create refund
   */
  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      });

      logger.info(`Created refund: ${refund.id} for payment intent: ${paymentIntentId}`);
      return refund;
    } catch (error: any) {
      logger.error('Error creating refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Get customer payment methods
   */
  async getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error: any) {
      logger.error('Error retrieving payment methods:', error);
      throw new Error(`Failed to retrieve payment methods: ${error.message}`);
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<void> {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info(`Attached payment method: ${paymentMethodId} to customer: ${customerId}`);
    } catch (error: any) {
      logger.error('Error attaching payment method:', error);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  /**
   * Detach payment method from customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await stripe.paymentMethods.detach(paymentMethodId);
      logger.info(`Detached payment method: ${paymentMethodId}`);
    } catch (error: any) {
      logger.error('Error detaching payment method:', error);
      throw new Error(`Failed to detach payment method: ${error.message}`);
    }
  }
}

export const stripePaymentService = new StripePaymentService();
export default stripePaymentService;

