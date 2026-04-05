import { Response, NextFunction } from 'express';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { SmsProvider } from '../services/intera/SmsProvider';
import {
  normalizeE164Phone,
  isValidE164,
  generateSixDigitCode,
  savePhoneOtp,
  deletePhoneOtp,
  verifyPhoneOtpCode,
  isRedisReadyForOtp,
} from '../services/intera/phone-otp.service';

let smsProvider: SmsProvider | null = null;

function getSmsProvider(): SmsProvider {
  if (!smsProvider) {
    smsProvider = new SmsProvider();
  }
  return smsProvider;
}

function readPhoneFromBody(body: Record<string, unknown>): string | null {
  const raw = body.phoneNumber ?? body.phone;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return s.length ? s : null;
}

/**
 * POST /auth/request-otp
 * Body: { phoneNumber: string } (or `phone`)
 */
export const requestPhoneOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isRedisReadyForOtp()) {
      throw new ApiError(
        503,
        'SMS verification is temporarily unavailable (Redis required). Configure REDIS_URL.'
      );
    }

    const raw = readPhoneFromBody(req.body as Record<string, unknown>);
    if (!raw) {
      throw new ApiError(400, 'Phone number is required (phoneNumber or phone)');
    }

    const phone = normalizeE164Phone(raw);
    if (!isValidE164(phone)) {
      throw new ApiError(400, 'Invalid phone number. Use E.164 format (e.g. +14089219541)');
    }

    const code = generateSixDigitCode();
    const stored = await savePhoneOtp(phone, code);
    if (!stored) {
      throw new ApiError(503, 'Could not store verification code. Please try again.');
    }

    try {
      await getSmsProvider().sendVerificationSMS(phone, code);
    } catch (err: unknown) {
      await deletePhoneOtp(phone);
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Intera SMS send failed:', msg);
      throw new ApiError(502, 'Failed to send verification SMS. Please try again.');
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent.',
      data: {
        phoneNumber: phone,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/verify-otp
 * Body: { phoneNumber: string, code: string } (phone alias supported)
 */
export const verifyPhoneOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isRedisReadyForOtp()) {
      throw new ApiError(
        503,
        'SMS verification is temporarily unavailable (Redis required). Configure REDIS_URL.'
      );
    }

    const raw = readPhoneFromBody(req.body as Record<string, unknown>);
    if (!raw) {
      throw new ApiError(400, 'Phone number is required (phoneNumber or phone)');
    }

    const { code: codeRaw } = req.body as { code?: string };
    if (codeRaw === undefined || codeRaw === null) {
      throw new ApiError(400, 'Verification code is required');
    }
    const code = String(codeRaw).trim();
    if (!/^[0-9]{6}$/.test(code)) {
      throw new ApiError(400, 'Verification code must be 6 digits');
    }

    const phone = normalizeE164Phone(raw);
    if (!isValidE164(phone)) {
      throw new ApiError(400, 'Invalid phone number');
    }

    const ok = await verifyPhoneOtpCode(phone, code);
    if (!ok) {
      throw new ApiError(400, 'Invalid or expired verification code');
    }

    res.status(200).json({
      success: true,
      message: 'Phone number verified.',
      data: {
        phoneNumber: phone,
        verified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
