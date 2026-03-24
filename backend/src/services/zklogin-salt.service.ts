import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Backend salt for zkLogin address derivation (Mysten / Shinami pattern).
 * Never log raw secrets; salt is deterministic per OAuth subject.
 */
export function deriveZkLoginSalt(issuer: string, subject: string): string {
  const secret = process.env.SALT_SERVICE_SECRET;
  if (!secret) {
    logger.error('SALT_SERVICE_SECRET is not configured');
    throw new Error('Salt service unavailable');
  }
  return crypto.createHmac('sha256', secret).update(`${issuer}|${subject}`).digest('base64url');
}
