/**
 * Barber Connect Controller
 * 
 * Step 5: Use Stripe Connect for barbers to receive payouts
 * Handles barber onboarding to Stripe Connect Express accounts
 */

import { Response, NextFunction } from 'express';
import {
  getConnectBusinessProfileUrl,
  getConnectRefreshUrl,
  getConnectReturnUrl,
} from '../config/stripe-connect';
import stripeService, { isStaleConnectAccountError } from '../services/stripe.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import type { AuthRequest } from '../middleware/auth';
import { isInstantPayoutsEnabled } from '../services/instant-payout.service';

async function getBarberUserRecord(userId: string) {
  const userResult = await pool.query(
    `SELECT stripe_account_id, email, first_name, last_name FROM users WHERE id = $1`,
    [userId]
  );
  if (userResult.rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }
  return userResult.rows[0] as {
    stripe_account_id: string | null;
    email: string;
    first_name: string;
    last_name: string;
  };
}

async function clearBarberConnectAccount(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET stripe_account_id = NULL,
         stripe_payouts_enabled = false,
         stripe_charges_enabled = false
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Returns a usable Connect account id, or null after clearing a stale id from the platform DB.
 */
async function resolveSavedConnectAccountId(userId: string, accountId: string | null): Promise<string | null> {
  if (!accountId) return null;

  try {
    await stripeService.validateConnectAccountForCurrentPlatform(accountId);
    return accountId;
  } catch (error) {
    if (!isStaleConnectAccountError(error)) {
      throw error;
    }
    logger.warn('Clearing stale Stripe Connect account from platform database', {
      user_id: userId,
      stale_account_id: accountId,
    });
    await clearBarberConnectAccount(userId);
    return null;
  }
}

async function createFreshConnectAccountForUser(userId: string, user: {
  email: string;
  first_name: string;
  last_name: string;
}) {
  const accountId = await stripeService.createConnectedAccount({
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
  });

  await pool.query(
    `UPDATE users
     SET stripe_account_id = $1,
         stripe_payouts_enabled = false,
         stripe_charges_enabled = false
     WHERE id = $2`,
    [accountId, userId]
  );

  const onboardingUrl = await stripeService.createAccountLink(
    accountId,
    getConnectRefreshUrl(),
    getConnectReturnUrl()
  );

  return { accountId, onboardingUrl };
}

/**
 * Create Stripe Connect account for barber
 * POST /api/barber/connect/create
 * 
 * Step 5 from instructions: Onboard each barber with Stripe connected account
 */
export const createConnectAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    // Role check is handled by requireRole middleware in routes

    logger.info('Creating Stripe Connect account for barber', {
      user_id: userId,
    });

    const user = await getBarberUserRecord(userId);
    const resolvedAccountId = await resolveSavedConnectAccountId(userId, user.stripe_account_id);

    if (resolvedAccountId) {
      const accountLink = await stripeService.createAccountLink(
        resolvedAccountId,
        getConnectRefreshUrl(),
        getConnectReturnUrl()
      );

      return res.status(200).json({
        success: true,
        message: 'Connect account already exists',
        data: {
          account_id: resolvedAccountId,
          onboarding_url: accountLink,
        },
      });
    }

    const { accountId, onboardingUrl } = await createFreshConnectAccountForUser(userId, user);

    // Audit log
    logger.info('Stripe Connect account created', {
      user_id: userId,
      action: 'STRIPE_CONNECT_ACCOUNT_CREATED',
      account_id: accountId,
    });

    logger.info('✅ Stripe Connect account created', {
      user_id: userId,
      account_id: accountId,
    });

    res.status(201).json({
      success: true,
      message: 'Connect account created successfully',
      data: {
        account_id: accountId,
        onboarding_url: onboardingUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Connect account and start onboarding on the current platform Stripe account.
 * POST /api/barber/connect/reset
 *
 * Use after the platform moves to a new Stripe account / bank — old acct_* IDs are invalid.
 */
export const resetConnectAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const user = await getBarberUserRecord(userId);
    const previousAccountId = user.stripe_account_id;

    await clearBarberConnectAccount(userId);
    const { accountId, onboardingUrl } = await createFreshConnectAccountForUser(userId, user);

    logger.info('Stripe Connect account reset for platform migration', {
      user_id: userId,
      previous_account_id: previousAccountId,
      new_account_id: accountId,
    });

    res.status(200).json({
      success: true,
      message: 'Connect account reset — complete onboarding for the new platform payout account',
      data: {
        previous_account_id: previousAccountId,
        account_id: accountId,
        onboarding_url: onboardingUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Connect account status
 * GET /api/barber/connect/status
 */
export const getConnectStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    // Role check is handled by requireRole middleware in routes

    const userResult = await pool.query(
      `SELECT stripe_account_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const stripeAccountId = userResult.rows[0].stripe_account_id;

    if (!stripeAccountId) {
      return res.status(200).json({
        success: true,
        data: {
          has_account: false,
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
          instantPayoutsEnabled: isInstantPayoutsEnabled(),
        },
      });
    }

    const resolvedAccountId = await resolveSavedConnectAccountId(userId, stripeAccountId);

    if (!resolvedAccountId) {
      return res.status(200).json({
        success: true,
        data: {
          has_account: false,
          needs_reconnect: true,
          stale_account_cleared: true,
          detailsSubmitted: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          instantPayoutsEnabled: isInstantPayoutsEnabled(),
        },
      });
    }

    const status = await stripeService.getAccountStatus(resolvedAccountId);

    // Sync database with current Stripe status
    await pool.query(
      `UPDATE users 
       SET stripe_payouts_enabled = $1, stripe_charges_enabled = $2 
       WHERE id = $3`,
      [status.payoutsEnabled, status.chargesEnabled, userId]
    );

    res.status(200).json({
      success: true,
      data: {
        has_account: true,
        account_id: resolvedAccountId,
        needs_reconnect: false,
        instantPayoutsEnabled: isInstantPayoutsEnabled(),
        ...status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh onboarding link
 * POST /api/barber/connect/refresh
 */
export const refreshOnboardingLink = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    // Role check is handled by requireRole middleware in routes

    const userResult = await pool.query(
      `SELECT stripe_account_id FROM users WHERE id = $1`,
      [userId]
    );

    const stripeAccountId = userResult.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      throw new ApiError(400, 'No Connect account found. Create one first.');
    }

    const resolvedAccountId = await resolveSavedConnectAccountId(userId, stripeAccountId);

    if (!resolvedAccountId) {
      throw new ApiError(
        400,
        'Your saved Stripe connection was invalid and has been cleared. Use Continue with Stripe to start again.',
        'STRIPE_CONNECT_STALE_ACCOUNT'
      );
    }

    // Create new account link
    const accountLink = await stripeService.createAccountLink(
      resolvedAccountId,
      getConnectRefreshUrl(),
      getConnectReturnUrl()
    );

    res.status(200).json({
      success: true,
      message: 'Onboarding link refreshed',
      data: {
        onboarding_url: accountLink,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle successful onboarding return
 * GET /api/barber/connect/return
 */
export const handleOnboardingReturn = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;

    logger.info('Barber returned from Stripe onboarding', {
      user_id: userId,
    });

    // Get updated account status
    const userResult = await pool.query(
      `SELECT stripe_account_id FROM users WHERE id = $1`,
      [userId]
    );

    const stripeAccountId = userResult.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      throw new ApiError(400, 'No Connect account found');
    }

    const resolvedAccountId = await resolveSavedConnectAccountId(userId, stripeAccountId);

    if (!resolvedAccountId) {
      throw new ApiError(
        400,
        'Your saved Stripe connection was invalid and has been cleared. Use Continue with Stripe to start again.',
        'STRIPE_CONNECT_STALE_ACCOUNT'
      );
    }

    const status = await stripeService.getAccountStatus(resolvedAccountId);

    // Update the database with current Stripe status
    await pool.query(
      `UPDATE users 
       SET stripe_payouts_enabled = $1, stripe_charges_enabled = $2 
       WHERE id = $3`,
      [status.payoutsEnabled, status.chargesEnabled, userId]
    );

    // Audit log
    logger.info('Stripe Connect onboarding completed', {
      user_id: userId,
      action: 'STRIPE_CONNECT_ONBOARDING_COMPLETED',
      account_id: resolvedAccountId,
      status,
    });

    res.status(200).json({
      success: true,
      message: 'Onboarding status retrieved',
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Stripe Express dashboard login link
 * GET /api/barber/connect/dashboard
 * POST /api/create-stripe-login-link (alias — see index.ts)
 */
export const getDashboardLink = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const user = await getBarberUserRecord(userId);

    if (!user.stripe_account_id) {
      throw new ApiError(400, 'No Connect account found. Complete onboarding first.');
    }

    const resolvedAccountId = await resolveSavedConnectAccountId(userId, user.stripe_account_id);

    if (!resolvedAccountId) {
      throw new ApiError(
        400,
        'Your saved Stripe connection was invalid and has been cleared. Complete Connect onboarding again.',
        'STRIPE_CONNECT_STALE_ACCOUNT'
      );
    }

    const loginLink = await stripeService.createExpressLoginLink(resolvedAccountId);

    res.status(200).json({
      success: true,
      data: {
        dashboard_url: loginLink,
        url: loginLink,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Stripe Express dashboard login link (mobile-friendly POST).
 * POST /api/create-stripe-login-link
 *
 * Uses the authenticated barber's saved Connect account. Optional `connectedAccountId`
 * in the body must match that saved ID — arbitrary account IDs are rejected.
 */
export const createStripeLoginLink = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const connectedAccountId =
      typeof req.body?.connectedAccountId === 'string'
        ? req.body.connectedAccountId.trim()
        : '';

    const user = await getBarberUserRecord(userId);
    const stripeAccountId = user.stripe_account_id;

    if (!stripeAccountId) {
      throw new ApiError(
        400,
        'No Connect account found. Call POST /api/v1/barber/connect/create or POST /api/v1/barber/connect/reset to onboard on the current platform Stripe account.'
      );
    }

    if (connectedAccountId && connectedAccountId !== stripeAccountId) {
      throw new ApiError(
        403,
        'connectedAccountId does not match your saved Connect account. Use POST /api/v1/barber/connect/reset after a platform Stripe migration.'
      );
    }

    const resolvedAccountId = await resolveSavedConnectAccountId(userId, stripeAccountId);

    if (!resolvedAccountId) {
      throw new ApiError(
        400,
        'Your saved Stripe connection was invalid and has been cleared. Complete Connect onboarding again.',
        'STRIPE_CONNECT_STALE_ACCOUNT'
      );
    }

    const url = await stripeService.createExpressLoginLink(resolvedAccountId);

    res.status(200).json({
      success: true,
      url,
      data: {
        url,
        dashboard_url: url,
        account_id: resolvedAccountId,
      },
    });
  } catch (error) {
    next(error);
  }
};

