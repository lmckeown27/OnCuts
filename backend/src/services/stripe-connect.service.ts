/**
 * Stripe Connect Service
 * 
 * Handles barber onboarding and payouts via Stripe Connect
 */

import Stripe from 'stripe';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2023-10-16',
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface CreateConnectAccountParams {
  email: string;
  userId: string;
  firstName?: string;
  lastName?: string;
}

interface AccountLinkResult {
  url: string;
  accountId: string;
}

class StripeConnectService {
  /**
   * Create Stripe Connect account for barber
   */
  async createConnectAccount(params: CreateConnectAccountParams): Promise<string> {
    try {
      const { email, userId, firstName, lastName } = params;

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          userId,
        },
        ...(firstName && lastName && {
          individual: {
            first_name: firstName,
            last_name: lastName,
            email,
          },
        }),
      });

      logger.info(`Created Stripe Connect account: ${account.id} for user: ${userId}`);
      return account.id;
    } catch (error: any) {
      logger.error('Error creating Stripe Connect account:', error);
      throw new Error(`Failed to create Connect account: ${error.message}`);
    }
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(accountId: string, returnPath = '/barber/dashboard'): Promise<AccountLinkResult> {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${FRONTEND_URL}/barber/onboarding/refresh`,
        return_url: `${FRONTEND_URL}${returnPath}`,
        type: 'account_onboarding',
      });

      logger.info(`Created account link for: ${accountId}`);

      return {
        url: accountLink.url,
        accountId,
      };
    } catch (error: any) {
      logger.error('Error creating account link:', error);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    try {
      return await stripe.accounts.retrieve(accountId);
    } catch (error: any) {
      logger.error('Error retrieving account:', error);
      throw new Error(`Failed to retrieve account: ${error.message}`);
    }
  }

  /**
   * Check if account is fully onboarded
   */
  async isAccountOnboarded(accountId: string): Promise<boolean> {
    try {
      const account = await this.getAccount(accountId);
      return account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create payout to barber
   */
  async createPayout(accountId: string, amount: number, metadata: Record<string, string> = {}): Promise<Stripe.Transfer> {
    try {
      const amountCents = Math.round(amount * 100);

      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: accountId,
        metadata,
      });

      logger.info(`Created payout: ${transfer.id} for ${amount} to account: ${accountId}`);
      return transfer;
    } catch (error: any) {
      logger.error('Error creating payout:', error);
      throw new Error(`Failed to create payout: ${error.message}`);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<{ available: number; pending: number }> {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: accountId,
      });

      const available = balance.available.reduce((sum, bal) => sum + bal.amount, 0) / 100;
      const pending = balance.pending.reduce((sum, bal) => sum + bal.amount, 0) / 100;

      return { available, pending };
    } catch (error: any) {
      logger.error('Error retrieving account balance:', error);
      throw new Error(`Failed to retrieve balance: ${error.message}`);
    }
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(accountId: string, limit = 10): Promise<Stripe.Transfer[]> {
    try {
      const transfers = await stripe.transfers.list({
        destination: accountId,
        limit,
      });

      return transfers.data;
    } catch (error: any) {
      logger.error('Error retrieving payout history:', error);
      throw new Error(`Failed to retrieve payout history: ${error.message}`);
    }
  }

  /**
   * Create login link for dashboard
   */
  async createLoginLink(accountId: string): Promise<string> {
    try {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      logger.info(`Created login link for account: ${accountId}`);
      return loginLink.url;
    } catch (error: any) {
      logger.error('Error creating login link:', error);
      throw new Error(`Failed to create login link: ${error.message}`);
    }
  }

  /**
   * Delete Connect account (for testing)
   */
  async deleteAccount(accountId: string): Promise<void> {
    try {
      await stripe.accounts.del(accountId);
      logger.info(`Deleted Stripe Connect account: ${accountId}`);
    } catch (error: any) {
      logger.error('Error deleting account:', error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Update account (for testing/admin)
   */
  async updateAccount(accountId: string, updates: Partial<Stripe.AccountUpdateParams>): Promise<Stripe.Account> {
    try {
      const account = await stripe.accounts.update(accountId, updates);
      logger.info(`Updated Stripe Connect account: ${accountId}`);
      return account;
    } catch (error: any) {
      logger.error('Error updating account:', error);
      throw new Error(`Failed to update account: ${error.message}`);
    }
  }
}

export const stripeConnectService = new StripeConnectService();
export default stripeConnectService;

