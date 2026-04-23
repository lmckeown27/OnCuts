/**
 * Public Stripe bootstrap (no auth).
 * Publishable keys are safe to expose to clients; they must match the server secret key mode.
 */

import express, { Request, Response } from 'express';
import { getStripeClientConfigPayload } from '../config/stripe';

const router = express.Router();

export function sendStripeClientConfig(res: Response): void {
  const data = getStripeClientConfigPayload();
  res.json({ success: true, data });
}

/**
 * GET /api/v1/stripe/client-config
 */
router.get('/client-config', (_req: Request, res: Response) => {
  sendStripeClientConfig(res);
});

export default router;
