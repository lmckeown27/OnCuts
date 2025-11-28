/**
 * Webhook Routes
 * 
 * Handles incoming webhooks from external services
 */

import express from 'express';
import { handleStripeWebhook } from '../controllers/webhook.controller';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * POST /api/webhooks/stripe
 * 
 * IMPORTANT: This route must use raw body, not JSON parsed body
 * Configure in index.ts BEFORE express.json() middleware:
 * 
 * app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);
 */
router.post('/stripe', handleStripeWebhook);

export default router;

