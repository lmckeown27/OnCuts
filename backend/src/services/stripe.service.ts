import Stripe from 'stripe';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

dotenv.config();

class StripeService {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    logger.info('💳 Stripe Service initialized');
  }

  /**
   * Create a payment intent for booking
   */
  async createPaymentIntent(params: {
    amount: number; // Amount in cents
    clientId: string;
    barberId: string;
    bookingId: number;
    description: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      const { amount, clientId, barberId, bookingId, description } = params;

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          client_id: clientId,
          barber_id: barberId,
          booking_id: bookingId.toString(),
          platform: 'CampusCuts',
        },
        description,
        // Capture manually after service completion
        capture_method: 'manual',
      });

      logger.info(`Payment intent created: ${paymentIntent.id} for $${amount / 100}`);

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      throw new ApiError(500, 'Payment processing failed');
    }
  }

  /**
   * Capture payment (after service completion)
   */
  async capturePayment(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.capture(paymentIntentId);
      logger.info(`Payment captured: ${paymentIntentId}`);
    } catch (error) {
      logger.error(`Failed to capture payment ${paymentIntentId}:`, error);
      throw new ApiError(500, 'Payment capture failed');
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number
  ): Promise<string> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount, // Optional: partial refund
      });

      logger.info(`Refund created: ${refund.id} for payment ${paymentIntentId}`);
      return refund.id;
    } catch (error) {
      logger.error(`Failed to refund payment ${paymentIntentId}:`, error);
      throw new ApiError(500, 'Refund failed');
    }
  }

  // === CUSTOMER MANAGEMENT (Step 2 from user instructions) ===

  /**
   * Create Stripe customer for a user
   * Called when a student makes their first payment
   */
  async createCustomer(params: {
    userId: string;
    email: string;
    name: string;
  }): Promise<Stripe.Customer> {
    try {
      const { userId, email, name } = params;

      logger.info('Creating Stripe customer', {
        user_id: userId,
        email,
      });

      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          platform: 'CampusCuts',
          user_id: userId,
        },
      });

      logger.info(`✅ Stripe customer created: ${customer.id} for user ${userId}`);
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw new ApiError(500, 'Customer creation failed');
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
    } catch (error) {
      logger.error(`Failed to retrieve customer ${customerId}:`, error);
      throw new ApiError(500, 'Failed to retrieve customer');
    }
  }

  /**
   * Get Payment Intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error(`Failed to retrieve payment intent ${paymentIntentId}:`, error);
      throw new ApiError(500, 'Failed to retrieve payment');
    }
  }

  /**
   * Create connected account for barber (Stripe Connect)
   */
  async createConnectedAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<string> {
    try {
      const { email, firstName, lastName } = params;

      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          first_name: firstName,
          last_name: lastName,
          email,
        },
      });

      logger.info(`Connected account created: ${account.id} for ${email}`);
      return account.id;
    } catch (error) {
      logger.error('Failed to create connected account:', error);
      throw new ApiError(500, 'Failed to create payment account');
    }
  }

  /**
   * Create account link for barber onboarding
   */
  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      logger.error('Failed to create account link:', error);
      throw new ApiError(500, 'Failed to create onboarding link');
    }
  }

  /**
   * Transfer funds to barber (instant payout)
   * Step 6: Distribute payment (minus 15% CampusCuts fee) to barber
   */
  async transferToBarber(params: {
    amount: number; // Amount in cents (after platform fee deduction)
    barberStripeAccountId: string;
    bookingId: number;
    description: string;
    sourceTransaction?: string; // Payment Intent ID for tracking
  }): Promise<string> {
    try {
      const { amount, barberStripeAccountId, bookingId, description, sourceTransaction } = params;

      logger.info('Transferring funds to barber', {
        amount_dollars: amount / 100,
        barber_account: barberStripeAccountId,
        booking_id: bookingId,
        source_transaction: sourceTransaction,
      });

      const transfer = await this.stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: barberStripeAccountId,
        source_transaction: sourceTransaction, // Link to original payment
        metadata: {
          booking_id: bookingId.toString(),
          platform: 'CampusCuts',
        },
        description,
      });

      logger.info(`✅ Transfer created: ${transfer.id} for $${amount / 100} to barber`);
      return transfer.id;
    } catch (error) {
      logger.error('Failed to transfer to barber:', error);
      throw new ApiError(500, 'Payout failed');
    }
  }

  /**
   * Create instant payout to barber's bank account
   */
  async createPayout(params: {
    amount: number;
    barberStripeAccountId: string;
  }): Promise<string> {
    try {
      const { amount, barberStripeAccountId } = params;

      const payout = await this.stripe.payouts.create(
        {
          amount,
          currency: 'usd',
          method: 'instant',
        },
        {
          stripeAccount: barberStripeAccountId,
        }
      );

      logger.info(`Instant payout created: ${payout.id} for $${amount / 100}`);
      return payout.id;
    } catch (error) {
      logger.error('Failed to create payout:', error);
      throw new ApiError(500, 'Instant payout failed');
    }
  }

  /**
   * Get account status
   */
  async getAccountStatus(accountId: string): Promise<{
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      return {
        detailsSubmitted: account.details_submitted || false,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
      };
    } catch (error) {
      logger.error(`Failed to get account status for ${accountId}:`, error);
      throw new ApiError(500, 'Failed to retrieve account status');
    }
  }

  /**
   * Create Express dashboard login link
   */
  async createExpressLoginLink(accountId: string): Promise<string> {
    try {
      const loginLink = await this.stripe.accounts.createLoginLink(accountId);
      logger.info(`Created Express login link for account: ${accountId}`);
      return loginLink.url;
    } catch (error) {
      logger.error(`Failed to create login link for ${accountId}:`, error);
      throw new ApiError(500, 'Failed to create dashboard login link');
    }
  }

  /**
   * Calculate platform fee (15%)
   */
  calculateFees(amount: number): { platformFee: number; barberPayout: number } {
    const platformFee = Math.floor(amount * 0.15); // 15%
    const barberPayout = amount - platformFee;

    return { platformFee, barberPayout };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new ApiError(400, 'Invalid webhook signature');
    }
  }
}

export default new StripeService();

