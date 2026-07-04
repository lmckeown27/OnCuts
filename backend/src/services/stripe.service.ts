import Stripe from 'stripe';
import { getConnectBusinessProfileUrl } from '../config/stripe-connect';
import {
  formatStripeSecretKeyForSafeLog,
  getDefaultStripeClient,
  getDefaultStripeSecretKey,
  getOptionalStatementDescriptor,
  getStripeClientForLivemode,
} from '../config/stripe';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

function stripeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Platform owner must finish Connect questionnaire before live connected accounts can be created. */
function isStripeConnectPlatformProfileIncompleteError(error: unknown): boolean {
  return /complete your platform profile to use Connect/i.test(stripeErrorMessage(error));
}

function connectOperationalApiError(error: unknown, fallback: string): ApiError {
  if (error instanceof ApiError) return error;
  const msg = stripeErrorMessage(error);
  if (isStripeConnectPlatformProfileIncompleteError(error)) {
    return new ApiError(
      503,
      'OnCuts must finish Stripe Connect platform setup before barbers can onboard. ' +
        'A platform admin needs to open https://dashboard.stripe.com/connect/accounts/overview (live mode), ' +
        'complete the Connect profile questionnaire, then try again.',
      'STRIPE_CONNECT_PLATFORM_PROFILE_INCOMPLETE'
    );
  }
  if (isStripeTestKeyLiveAccountError(error) || isStripeLiveKeyTestAccountError(error)) {
    return new ApiError(400, msg, 'STRIPE_CONNECT_KEY_MODE_MISMATCH');
  }
  logger.error(fallback, { stripeError: msg });
  return new ApiError(500, fallback);
}

/** Test API key used against a live-mode Connect account (common prod misconfig). */
function isStripeTestKeyLiveAccountError(error: unknown): boolean {
  const msg = stripeErrorMessage(error);
  return /testmode API key/i.test(msg) && /live account/i.test(msg);
}

/** Live API key used against a test-mode Connect account. */
function isStripeLiveKeyTestAccountError(error: unknown): boolean {
  const msg = stripeErrorMessage(error);
  return /livemode API key/i.test(msg) && /test account/i.test(msg);
}

/** Connected account cannot be used with the platform's current Stripe account/mode. */
export function isStaleConnectAccountError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === 'STRIPE_CONNECT_STALE_ACCOUNT') return true;
    if (error.code === 'STRIPE_CONNECT_KEY_MODE_MISMATCH') return true;
    if (error.statusCode === 400 && /not valid for (this )?platform Stripe account|not valid for server Stripe key/i.test(error.message)) {
      return true;
    }
  }
  const msg = stripeErrorMessage(error);
  return (
    /no such destination|resource_missing|does not exist/i.test(msg) ||
    isStripeTestKeyLiveAccountError(error) ||
    isStripeLiveKeyTestAccountError(error)
  );
}

function staleConnectAccountApiError(accountId: string, cause: unknown): ApiError {
  const stripeKey = formatStripeSecretKeyForSafeLog(getDefaultStripeSecretKey());
  logger.warn('Stale Stripe Connect account for current platform', {
    accountId,
    stripeKey,
    stripeError: stripeErrorMessage(cause),
  });
  return new ApiError(
    400,
    `Barber payout account ${accountId} is not valid for this platform Stripe account (${stripeKey}). ` +
      'It may be from test mode, a previous platform account, or was deleted in Stripe. ' +
      'The platform cleared the saved account ID — complete Connect onboarding again.',
    'STRIPE_CONNECT_STALE_ACCOUNT'
  );
}

class StripeService {
  private getStripe(): Stripe {
    return getDefaultStripeClient();
  }

  /**
   * Run a Connect account API call with the default Stripe client; on test/live key mismatch,
   * retry once with the matching client (fixes production using sk_test while acct_* is live).
   */
  private async withConnectAccountStripeRetry<T>(
    accountId: string,
    operationLabel: string,
    fn: (stripe: Stripe) => Promise<T>
  ): Promise<T> {
    try {
      return await fn(this.getStripe());
    } catch (error) {
      if (isStripeTestKeyLiveAccountError(error)) {
        try {
          const liveStripe = getStripeClientForLivemode(true);
          logger.warn('Stripe Connect: default client is test; retrying with live secret for live account', {
            accountId,
            operation: operationLabel,
          });
          return await fn(liveStripe);
        } catch (retryErr) {
          logger.error(`Stripe Connect live retry failed for ${accountId} (${operationLabel}):`, retryErr);
          throw new ApiError(
            503,
            'This barber Connect account is live, but the server default Stripe key is test (sk_test). Production: set STRIPE_SECRET_KEY to your live secret (sk_live_…). Optional: STRIPE_SECRET_KEY_LIVE + STRIPE_MODE=live. Webhooks: STRIPE_WEBHOOK_SECRET must be the live endpoint signing secret.'
          );
        }
      }
      if (isStripeLiveKeyTestAccountError(error)) {
        try {
          const testStripe = getStripeClientForLivemode(false);
          logger.warn('Stripe Connect: default client is live; retrying with test secret for test account', {
            accountId,
            operation: operationLabel,
          });
          return await fn(testStripe);
        } catch (retryErr) {
          logger.error(`Stripe Connect test retry failed for ${accountId} (${operationLabel}):`, retryErr);
          throw new ApiError(
            503,
            'This barber account is a test Stripe Connect account, but the server only has a live API key configured. Add STRIPE_SECRET_KEY_TEST or STRIPE_MODE=test with a sk_test_… key.'
          );
        }
      }
      throw error;
    }
  }

  constructor() {
    logger.info('💳 Stripe Service initialized (Stripe client loads on first use)');
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

      const st = getOptionalStatementDescriptor();
      const paymentIntent = await this.getStripe().paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card'], // Only card (includes Apple Pay, Google Pay) - excludes Klarna, Amazon Pay, Cash App
        metadata: {
          client_id: clientId,
          barber_id: barberId,
          booking_id: bookingId.toString(),
          platform: 'OnCuts',
        },
        description,
        // Capture manually after service completion
        capture_method: 'manual',
        ...(st ? { statement_descriptor: st } : {}),
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
      await this.getStripe().paymentIntents.capture(paymentIntentId);
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
      const refund = await this.getStripe().refunds.create({
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

      const customer = await this.getStripe().customers.create({
        email,
        name,
        metadata: {
          platform: 'OnCuts',
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
      return await this.getStripe().customers.retrieve(customerId) as Stripe.Customer;
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
      return await this.getStripe().paymentIntents.retrieve(paymentIntentId);
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

      const businessProfileUrl = getConnectBusinessProfileUrl();

      const account = await this.getStripe().accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          url: businessProfileUrl,
        },
        individual: {
          first_name: firstName,
          last_name: lastName,
          email,
        },
      });

      logger.info(`Connected account created: ${account.id} for ${email}`);
      return account.id;
    } catch (error) {
      throw connectOperationalApiError(error, 'Failed to create payment account');
    }
  }

  /**
   * Create account link for barber onboarding
   */
  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
    try {
      return await this.withConnectAccountStripeRetry(accountId, 'account link', async (stripe) => {
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding',
        });
        return accountLink.url;
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw connectOperationalApiError(error, 'Failed to create onboarding link');
    }
  }

  /**
   * Transfer funds to barber (instant payout)
   * Step 6: Distribute payment (minus 15% OnCuts fee) to barber
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

      const transfer = await this.getStripe().transfers.create({
        amount,
        currency: 'usd',
        destination: barberStripeAccountId,
        source_transaction: sourceTransaction, // Link to original payment
        metadata: {
          booking_id: bookingId.toString(),
          platform: 'OnCuts',
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

      const payout = await this.getStripe().payouts.create(
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
   * Strict Connect validation for onboarding/status: uses the platform default key only
   * (no test/live cross-retry) so stale test or foreign-platform accounts are detected.
   */
  async validateConnectAccountForCurrentPlatform(accountId: string): Promise<void> {
    try {
      await this.getStripe().accounts.retrieve(accountId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isStaleConnectAccountError(error)) {
        throw staleConnectAccountApiError(accountId, error);
      }
      throw connectOperationalApiError(error, 'Failed to validate Connect account');
    }
  }

  /**
   * Ensure a Connect account exists for the server's default Stripe secret key (test/live).
   * PaymentIntent destination charges fail with opaque "No such destination" if the DB holds a stale acct_*.
   */
  async validateConnectDestination(accountId: string): Promise<void> {
    try {
      await this.withConnectAccountStripeRetry(accountId, 'validate Connect destination', async (stripe) => {
        await stripe.accounts.retrieve(accountId);
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const msg = stripeErrorMessage(error);
      const stripeKey = formatStripeSecretKeyForSafeLog(getDefaultStripeSecretKey());
      logger.error('Stripe Connect destination invalid', { accountId, stripeKey, error: msg });
      if (/no such destination|resource_missing|does not exist/i.test(msg)) {
        throw new ApiError(
          400,
          `Barber payout account is not valid for server Stripe key (${stripeKey}). ` +
            'The saved Connect account ID is missing or was created under a different Stripe mode/account. ' +
            'Clear users.stripe_account_id for this barber and complete Stripe Connect onboarding again with test keys (sk_test/pk_test) or live keys (sk_live/pk_live) matching the server.'
        );
      }
      throw error;
    }
  }

  /**
   * Get account status
   */
  async getAccountStatus(accountId: string): Promise<{
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirements?: {
      currently_due: string[];
      eventually_due: string[];
      past_due: string[];
      disabled_reason: string | null;
    };
  }> {
    try {
      const account = await this.getStripe().accounts.retrieve(accountId);

      // Log requirements for debugging
      if (account.requirements) {
        logger.info(`Stripe account ${accountId} requirements:`, {
          currently_due: account.requirements.currently_due,
          eventually_due: account.requirements.eventually_due,
          past_due: account.requirements.past_due,
          disabled_reason: account.requirements.disabled_reason,
        });
      }

      return {
        detailsSubmitted: account.details_submitted || false,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
        requirements: account.requirements ? {
          currently_due: account.requirements.currently_due || [],
          eventually_due: account.requirements.eventually_due || [],
          past_due: account.requirements.past_due || [],
          disabled_reason: account.requirements.disabled_reason || null,
        } : undefined,
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
      const url = await this.withConnectAccountStripeRetry(accountId, 'Express login link', async (stripe) => {
        const loginLink = await stripe.accounts.createLoginLink(accountId);
        return loginLink.url;
      });
      logger.info(`Created Express login link for account: ${accountId}`);
      return url;
    } catch (error) {
      if (error instanceof ApiError) throw error;
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
      return this.getStripe().webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new ApiError(400, 'Invalid webhook signature');
    }
  }
}

export default new StripeService();

