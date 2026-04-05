import { timingSafeEqual } from 'crypto';
import { redisDel, redisGet, redisSet, getRedisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

const OTP_KEY_PREFIX = 'intera:sms_otp:';

/** Default 10 minutes; override with INTERA_OTP_TTL_SECONDS */
export function getOtpTtlSeconds(): number {
  const raw = process.env.INTERA_OTP_TTL_SECONDS;
  const n = raw ? parseInt(raw, 10) : 600;
  return Number.isFinite(n) && n >= 60 && n <= 3600 ? n : 600;
}

export function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Normalize to E.164: leading +, digits only after. */
export function normalizeE164Phone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

/** Loose E.164 check (ITU-T E.164 length 7–15 after country code). */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

function otpRedisKey(e164: string): string {
  return `${OTP_KEY_PREFIX}${e164.toLowerCase()}`;
}

export function isRedisReadyForOtp(): boolean {
  const c = getRedisClient();
  return c !== null && c.isReady;
}

export async function savePhoneOtp(phoneE164: string, code: string): Promise<boolean> {
  if (!isRedisReadyForOtp()) {
    logger.warn('Phone OTP: Redis not available');
    return false;
  }
  const ttl = getOtpTtlSeconds();
  return redisSet(otpRedisKey(phoneE164), { code }, ttl);
}

export async function deletePhoneOtp(phoneE164: string): Promise<void> {
  await redisDel(otpRedisKey(phoneE164));
}

/**
 * Compare submitted code with stored value; on match, delete the key (one-time success).
 */
export async function verifyPhoneOtpCode(phoneE164: string, code: string): Promise<boolean> {
  if (!isRedisReadyForOtp()) {
    return false;
  }
  const key = otpRedisKey(phoneE164);
  const data = await redisGet(key);
  if (!data || typeof data !== 'object' || data === null) {
    return false;
  }
  const stored = (data as { code?: string }).code;
  if (typeof stored !== 'string' || stored.length !== 6) {
    return false;
  }
  const submitted = String(code).trim();
  if (!codesEqual(stored, submitted)) {
    return false;
  }
  await redisDel(key);
  return true;
}

function codesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
