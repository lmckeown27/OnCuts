/**
 * Barber Connect Routes
 * 
 * Handles Stripe Connect onboarding for barbers
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createConnectAccount,
  getConnectStatus,
  refreshOnboardingLink,
  handleOnboardingReturn,
} from '../controllers/barber-connect.controller';

const router = express.Router();

/**
 * Create Stripe Connect account
 * POST /api/barber/connect/create
 */
router.post('/connect/create', authenticate, requireRole('barber'), createConnectAccount);

/**
 * Get Connect account status
 * GET /api/barber/connect/status
 */
router.get('/connect/status', authenticate, requireRole('barber'), getConnectStatus);

/**
 * Refresh onboarding link
 * POST /api/barber/connect/refresh
 */
router.post('/connect/refresh', authenticate, requireRole('barber'), refreshOnboardingLink);

/**
 * Handle onboarding return
 * GET /api/barber/connect/return
 */
router.get('/connect/return', authenticate, handleOnboardingReturn);

export default router;

