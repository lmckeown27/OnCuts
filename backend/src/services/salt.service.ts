import crypto from 'crypto';
import { logger } from '../utils/logger';

function getMasterSeed(): string {
  const s = process.env.MASTER_SEED?.trim() || process.env.SALT_SERVICE_SECRET?.trim();
  if (!s) {
    logger.error('MASTER_SEED (or SALT_SERVICE_SECRET fallback) is not configured');
    throw new Error('Salt service unavailable');
  }
  return s;
}

/**
 * Deterministic zkLogin salt per Google subject: SHA256(MASTER_SEED + google_sub).
 * Returned as a decimal string compatible with @mysten/sui/zklogin `BigInt(salt)`.
 */
export function deriveZkLoginSaltFromGoogleSub(googleSub: string): string {
  if (!googleSub?.trim()) {
    throw new Error('Google subject (sub) required');
  }
  const seed = getMasterSeed();
  const hashHex = crypto.createHash('sha256').update(`${seed}${googleSub}`, 'utf8').digest('hex');
  // jwtToAddress → genAddressSeed uses BigInt(salt): must be base-10 digits only (never return hex).
  return BigInt(`0x${hashHex}`).toString(10);
}

/**
 * Public salt API still accepts iss + sub; derivation uses `sub` only (Google identity).
 */
export function deriveZkLoginSalt(_issuer: string, subject: string): string {
  return deriveZkLoginSaltFromGoogleSub(subject);
}
