/**
 * MoonPay partner webhooks (JSON). Mounted with express.json + rawBody capture for optional HMAC verify.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import moonPayOfframpService from '../services/moonpay-offramp.service';

function verifySignatureIfConfigured(req: Request, rawBody: Buffer | undefined): boolean {
  const secret = process.env.MOONPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return true;
  }
  const sigHeader =
    req.headers['moonpay-signature'] ||
    req.headers['x-moonpay-signature'] ||
    req.headers['x-signature'];
  const sig = typeof sigHeader === 'string' ? sigHeader : Array.isArray(sigHeader) ? sigHeader[0] : '';
  if (!rawBody?.length || !sig) {
    logger.warn('MoonPay webhook: missing signature or body for verification');
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(sig.replace(/^sha256=/i, '').trim(), 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function handleMoonPayWebhook(req: Request, res: Response): Promise<void> {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!verifySignatureIfConfigured(req, rawBody)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    await moonPayOfframpService.handleWebhookPayload(req.body);
    res.sendStatus(200);
  } catch (e) {
    logger.error('MoonPay webhook handler error', e);
    res.sendStatus(500);
  }
}
