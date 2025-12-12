/**
 * Stripe Webhook Routes
 * 
 * IMPORTANT: These routes MUST come BEFORE express.json() middleware
 * Stripe requires raw body to verify webhook signatures
 */

import express from 'express';
import { handleStripeWebhook } from '../controllers/stripe-webhook.controller';

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 * 
 * This route expects raw body (not JSON parsed)
 */
router.post('/stripe', handleStripeWebhook);

export default router;

