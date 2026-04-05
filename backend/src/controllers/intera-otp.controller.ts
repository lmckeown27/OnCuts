import { Response, NextFunction } from 'express';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';
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
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';
import { resolveAccessTokenRole } from '../utils/access-token-role';

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
 *
 * On success: if `users.phone_e164` matches, returns JWTs and user (same shape as POST /auth/login).
 * Otherwise returns `accountExists: false` so the client can continue email registration with this phone.
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

    // Intera / phone-first: if this number is on an account, sign in (same tokens as email login).
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, "campusId", role, "isBlocked", "isBanned", email_verified, "avatarUrl", phone_e164
       FROM users WHERE phone_e164 = $1`,
      [phone]
    );

    if (userResult.rows.length === 0) {
      res.status(200).json({
        success: true,
        message: 'Phone verified. Create an account with email or complete signup to link this number.',
        data: {
          phoneNumber: phone,
          verified: true,
          accountExists: false,
        },
      });
      return;
    }

    const user = userResult.rows[0];

    if (user.isBlocked || user.isBanned) {
      throw new ApiError(403, 'Account is deactivated');
    }

    await pool.query('UPDATE users SET "lastActiveAt" = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1 AND "isActive" = true',
      [user.id]
    );
    const hasBarberProfile = barberCheck.rows.length > 0;

    const accessRole = await resolveAccessTokenRole(user.id, user.role);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: accessRole,
      campusId: user.campusId,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: accessRole,
      campusId: user.campusId,
    });

    logger.info(`Phone OTP login: ${phone} → user ${user.id} (jwtRole=${accessRole})`);

    res.status(200).json({
      success: true,
      message: 'Signed in with phone.',
      data: {
        phoneNumber: phone,
        verified: true,
        accountExists: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          campusId: user.campusId,
          emailVerified: user.email_verified,
          profile_picture_url: user.avatarUrl,
          hasBarberProfile,
          phoneNumber: user.phone_e164 ?? phone,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};
