/**
 * Authentication Controller
 * 
 * Handles user authentication operations including registration, login, and token management.
 * 
 * ## JWT Authentication Flow:
 * 
 * ### 1. User Registration:
 * ```
 * POST /api/v1/auth/register
 * Body: { email, password, firstName, lastName, campusId, role }
 * 
 * Process:
 * - Validates campus email domain
 * - Hashes password with bcrypt (10 rounds)
 * - On-chain identity via zkLogin / Sui, optional legacy_wallet_address
 * - Stores user in database
 * - Generates JWT token
 * - Returns user data + token
 * ```
 * 
 * ### 2. User Login:
 * ```
 * POST /api/v1/auth/login
 * Body: { email, password }
 * 
 * Process:
 * - Finds user by email
 * - Verifies password with bcrypt.compare()
 * - Generates JWT token with user data
 * - Updates last_login timestamp
 * - Returns user data + token
 * ```
 * 
 * ### 3. Authenticated Request:
 * ```
 * GET /api/v1/bookings
 * Headers: { Authorization: "Bearer <token>" }
 * 
 * Process:
 * - auth.middleware.ts extracts and verifies token
 * - Token payload decoded to req.user
 * - Route handler accesses req.user for user info
 * ```
 * 
 * ## JWT Token Structure:
 * 
 * ### Header:
 * ```json
 * {
 *   "alg": "HS256",  // HMAC with SHA-256
 *   "typ": "JWT"     // Token type
 * }
 * ```
 * 
 * ### Payload (JwtPayload):
 * ```json
 * {
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "email": "student@university.edu",
 *   "role": "student",
 *   "campusId": 1,
 *   "iat": 1704067200,  // Issued at (Unix timestamp)
 *   "exp": 1704672000   // Expiration (Unix timestamp)
 * }
 * ```
 * 
 * ### Signature:
 * ```
 * HMACSHA256(
 *   base64UrlEncode(header) + "." + base64UrlEncode(payload),
 *   JWT_SECRET
 * )
 * ```
 * 
 * ## Environment Variables Required:
 * - JWT_SECRET: Secret key for signing tokens (required, 32+ chars)
 * - JWT_EXPIRES_IN: Token expiration time (default: "7d")
 * - JWT_REFRESH_SECRET: Separate secret for refresh tokens (optional)
 * - JWT_REFRESH_EXPIRES_IN: Refresh token expiration (default: "30d")
 * 
 * ## Security Features:
 * 1. **Password Hashing**: bcrypt with 10 salt rounds
 * 2. **Token Signing**: HMAC-SHA256 signature verification
 * 3. **Token Expiration**: Automatic expiration (configurable)
 * 4. **Domain Validation**: Email must match campus domain
 * 5. **Account Status**: Checks is_active flag on login
 * 6. **Credential Obfuscation**: Same error for wrong email/password
 * 
 * @module auth.controller
 */

import { Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, JwtPayload } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyToken,
} from '../utils/jwt.utils';
import { resolveAccessTokenRole } from '../utils/access-token-role';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  isAutoVerifyEnabled
} from '../services/email.service';
import {
  createPendingRegistration,
  verifyCode,
  hasPendingRegistration,
  getPendingRegistration
} from '../services/verification.service';

/** Google ID token verification for Intera / mobile (JWT exchange). */
const googleIdTokenClient = new OAuth2Client();

function getGoogleJwtExchangeAudiences(): string[] {
  const raw = [
    process.env.GOOGLE_OAUTH_IOS_CLIENT_ID,
    process.env.GOOGLE_OAUTH_WEB_CLIENT_ID,
    process.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  ];
  const trimmed = raw.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  return [...new Set(trimmed)];
}
// Note: educationalDomainService removed - campus is now determined by user selection, not email domain

/**
 * Register New User - Step 1: Create Pending Registration
 * 
 * Creates a pending user registration and sends verification email.
 * User account is NOT created until email is verified.
 * 
 * ## Two-Step Registration Flow:
 * 1. POST /auth/register → Creates pending registration, sends verification email
 * 2. POST /auth/verify-email → Verifies code, creates user account, issues JWT
 * 
 * ## Request:
 * ```json
 * POST /api/v1/auth/register
 * {
 *   "email": "student@university.edu",
 *   "password": "SecurePassword123!",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "campusId": 1,
 *   "role": "student"
 * }
 * ```
 * 
 * ## Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Verification email sent. Please check your inbox.",
 *   "data": {
 *     "email": "student@university.edu",
 *     "expiresIn": 600
 *   }
 * }
 * ```
 * 
 * ## AUTO_VERIFY_EMAILS Mode (Development):
 * If AUTO_VERIFY_EMAILS=true, the verification code is logged instead of emailed.
 * 
 * @param req - Express request with registration data
 * @param res - Express response
 * @param next - Express next function
 */
export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role, campusId: requestedCampusId } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName || !role) {
      throw new ApiError(400, 'All fields are required');
    }

    // Validate email format
    const emailDomain = email.split('@')[1];
    if (!emailDomain) {
      throw new ApiError(400, 'Please provide a valid email address');
    }

    // Campus assignment: Use user-provided campusId if valid, otherwise leave as null
    // Consumers don't need to be tied to a university - they can browse barbers at any campus
    let campusId: string | null = null;
    
    if (requestedCampusId) {
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(requestedCampusId);
      
      let validCampus;
      if (isUuid) {
        // Look up by UUID
        validCampus = await pool.query(
          'SELECT id, name FROM campuses WHERE id = $1 AND is_active = TRUE',
          [requestedCampusId]
        );
      } else {
        // Look up by slug (convert slug to name pattern, e.g., "cal-poly" -> "%cal%poly%")
        // Or try exact name match first
        const slugPattern = requestedCampusId.replace(/-/g, '%');
        validCampus = await pool.query(
          `SELECT id, name FROM campuses 
           WHERE is_active = TRUE 
           AND (LOWER(name) LIKE $1 OR LOWER(REPLACE(name, ' ', '-')) = $2)
           ORDER BY name LIMIT 1`,
          [`%${slugPattern}%`, requestedCampusId.toLowerCase()]
        );
      }
      
      if (validCampus.rows.length > 0) {
        campusId = validCampus.rows[0].id;
        logger.info(`User selected campus: ${validCampus.rows[0].name} (ID: ${campusId})`);
      } else {
        logger.warn(`Invalid or inactive campusId provided: ${requestedCampusId}, proceeding without campus`);
      }
    }
    
    // No fallback campus - consumers can register without a campus affiliation
    if (!campusId) {
      logger.info('User registering without campus affiliation');
    }

    // Check if user already exists in database
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User with this email already exists');
    }

    // Check if there's already a pending registration
    if (await hasPendingRegistration(email)) {
      throw new ApiError(400, 'Verification already in progress. Please complete verification or wait 1 hour to try again.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create pending registration with email verification code
    const verificationCode = await createPendingRegistration({
      email,
      password: passwordHash,
      firstName,
      lastName,
      campusId,
      role
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationCode);
      
      logger.info(`Verification email sent to ${email}`);
      
      // In auto-verify mode, include code in response for testing
      if (isAutoVerifyEnabled()) {
        return res.status(200).json({
          success: true,
          message: 'Registration pending email verification (AUTO-VERIFY MODE)',
          data: {
            email,
            expiresIn: 600, // 10 minutes
            verificationCode: verificationCode // Only in dev mode!
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
        data: {
          email,
          expiresIn: 600 // 10 minutes
        }
      });
    } catch (emailError: any) {
      logger.error('Failed to send verification email:', emailError);
      throw new ApiError(500, 'Failed to send verification email. Please try again later.');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Email - Complete Registration
 * 
 * Verifies the 6-digit email code and creates the user account.
 * Creates the user row and issues JWT (no custodial chain wallet mint).
 * 
 * ## Request:
 * ```json
 * POST /api/v1/auth/verify-email
 * {
 *   "email": "student@university.edu",
 *   "code": "123456"
 * }
 * ```
 * 
 * ## Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Email verified successfully. Welcome to CampusCuts!",
 *   "data": {
 *     "user": {
 *       "id": "123e4567-e89b-12d3-a456-426614174000",
 *       "email": "student@university.edu",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "role": "student",
 *       "campusId": 1
 *     },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "suiAddress": null
 *   }
 * }
 * ```
 * 
 * @param req - Express request with email and verification code
 * @param res - Express response
 * @param next - Express next function
 */
export const verifyEmailRegistration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      throw new ApiError(400, 'Email and verification code are required');
    }

    // Verify email code
    const pendingReg = await verifyCode(email, code);

    if (!pendingReg) {
      throw new ApiError(400, 'Invalid or expired verification code');
    }

    // Check again if user was created in the meantime
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User already exists. Please log in.');
    }

    // Check if this email has an approved guest barber application
    const approvedGuestApp = await pool.query(
      `SELECT id, campus_id, specialties FROM guest_barber_applications 
       WHERE email = $1 AND status = 'approved' AND linked_user_id IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    const hasApprovedApplication = approvedGuestApp.rows.length > 0;

    // Map frontend role to database enum (student -> CONSUMER, barber -> BARBER)
    // If user has an approved guest application, make them a BARBER
    let dbRole: string;
    if (hasApprovedApplication) {
      dbRole = 'BARBER';
      logger.info(`User ${email} has an approved guest application - auto-promoting to BARBER`);
    } else {
      const roleMap: { [key: string]: string } = {
        'student': 'CONSUMER',
        'barber': 'BARBER',
        'admin': 'ADMIN'
      };
      dbRole = roleMap[pendingReg.role.toLowerCase()] || 'CONSUMER';
    }

    // Use campus from approved application if available, otherwise use the one from registration
    const campusId = hasApprovedApplication 
      ? approvedGuestApp.rows[0].campus_id 
      : pendingReg.campusId;

    // Log if user is registering without a campus (consumers can do this, barbers cannot)
    if (!campusId) {
      if (dbRole === 'BARBER') {
        logger.error(`Barber ${email} attempting to register without a campusId - this should not happen`);
        throw new ApiError(400, 'Campus selection is required for barber accounts. Please contact support.');
      }
      logger.info(`Consumer ${email} registering without campus affiliation`);
    }

    // Create user in database (off-chain for v1 - no blockchain wallets)
    // Note: Column names use camelCase in the database schema
    // id uses gen_random_uuid() since the column has no default
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, "campusId", role, email_verified, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::"UserRole", TRUE, NOW())
       RETURNING id, email, first_name, last_name, "campusId", role, "createdAt"`,
      [
        pendingReg.email,
        pendingReg.password,
        pendingReg.firstName,
        pendingReg.lastName,
        campusId,
        dbRole
      ]
    );

    const user = result.rows[0];

    // If user had an approved guest application, create their barber profile
    if (hasApprovedApplication) {
      const guestApp = approvedGuestApp.rows[0];
      const specialties = guestApp.specialties || [];
      
      // Generate pricing from specialties
      const SERVICE_BASE_PRICES: Record<string, number> = {
        'Buzz Cut': 23, 'Line Up': 23, 'Beard Trim': 23, 'Haircut': 28, 'Taper': 28,
        'Hot Shave': 28, 'Kids Cut': 28, 'Fade': 35, 'Haircut & Fade': 35, 'Mullet': 35,
        'Design/Art': 38, 'Afro Textures': 38, "Women's Cut": 40, 'Color Treatment': 45, 'Perm': 45,
      };
      const pricing = specialties.map((specialty: string) => ({
        name: specialty,
        price: SERVICE_BASE_PRICES[specialty] || 25,
      }));

      // Create barber profile
      await pool.query(
        `INSERT INTO barbers (
           id, "userId", "campusId", specialties, pricing, "isActive", "weeklySchedule",
           "currentMinPriceUsdCents", "currentMaxPriceUsdCents",
           "totalBookings", "completedBookings", "cancelledBookings", "totalReviews",
           "pricingMultiplier", "isCampusManager", "isOnboarded",
           "createdAt", "updatedAt"
         )
         VALUES (
           gen_random_uuid(), $1, $2, $3, $4, true, '{}',
           0, 0,
           0, 0, 0, 0,
           1.00, false, false,
           NOW(), NOW()
         )
         ON CONFLICT ("userId") DO UPDATE SET 
           specialties = EXCLUDED.specialties,
           pricing = EXCLUDED.pricing,
           "isActive" = true,
           "campusId" = EXCLUDED."campusId",
           "updatedAt" = NOW()`,
        [user.id, guestApp.campus_id, specialties, JSON.stringify(pricing)]
      );

      // Link the guest application to the new user
      await pool.query(
        'UPDATE guest_barber_applications SET linked_user_id = $1 WHERE id = $2',
        [user.id, guestApp.id]
      );

      logger.info(`Created barber profile for user ${user.id} from approved guest application ${guestApp.id}`);
    }

    const accessRole = await resolveAccessTokenRole(user.id, user.role);

    // Generate JWT tokens (role must match requireRole hierarchy, not raw DB enum)
    const token = generateAccessToken({
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

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.first_name).catch(err => {
      logger.error('Failed to send welcome email:', err);
    });

    logger.info(`New user registered and verified: ${user.email} (${user.role}, jwtRole=${accessRole})`);

    res.status(201).json({
      success: true,
      message: hasApprovedApplication 
        ? 'Email verified successfully. Welcome to CampusCuts! Your barber application has been linked to your account.'
        : 'Email verified successfully. Welcome to CampusCuts!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          campusId: user.campusId,
          emailVerified: true
        },
        accessToken: token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend Verification Code
 * 
 * Resends verification email with a new code to a pending registration.
 * 
 * ## Request:
 * ```json
 * POST /api/v1/auth/resend-verification
 * {
 *   "email": "student@university.edu"
 * }
 * ```
 * 
 * ## Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Verification email resent. Please check your inbox.",
 *   "data": {
 *     "email": "student@university.edu",
 *     "expiresIn": 600
 *   }
 * }
 * ```
 * 
 * @param req - Express request with email
 * @param res - Express response
 * @param next - Express next function
 */
export const resendVerificationCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    // Check if there's a pending registration
    const pendingReg = await getPendingRegistration(email);

    if (!pendingReg) {
      throw new ApiError(400, 'No pending registration found for this email. Please register first.');
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User already exists. Please log in.');
    }

    // Create new verification code (overwrites previous)
    const verificationCode = await createPendingRegistration({
      email: pendingReg.email,
      password: pendingReg.password,
      firstName: pendingReg.firstName,
      lastName: pendingReg.lastName,
      campusId: pendingReg.campusId,
      role: pendingReg.role
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationCode);
      
      logger.info(`Verification code resent to ${email}`);
      
      // In auto-verify mode, include code in response
      if (isAutoVerifyEnabled()) {
        return res.status(200).json({
          success: true,
          message: 'Verification email resent (AUTO-VERIFY MODE)',
          data: {
            email,
            expiresIn: 600,
            verificationCode: verificationCode // Only in dev mode!
          }
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Verification email resent. Please check your inbox.',
        data: {
          email,
          expiresIn: 600
        }
      });
    } catch (emailError: any) {
      logger.error('Failed to resend verification email:', emailError);
      throw new ApiError(500, 'Failed to resend verification email. Please try again later.');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, "campusId", role, "isBlocked", "isBanned", email_verified, "avatarUrl", sui_address
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new ApiError(401, 'Account not found', 'ACCOUNT_NOT_FOUND');
    }

    const user = result.rows[0];

    if (user.isBlocked || user.isBanned) {
      throw new ApiError(403, 'Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid password', 'INVALID_PASSWORD');
    }

    // Update last login
    await pool.query('UPDATE users SET "lastActiveAt" = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Check if user has an ACTIVE barber profile (demoted barbers have isActive = false)
    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1 AND "isActive" = true',
      [user.id]
    );
    const hasBarberProfile = barberCheck.rows.length > 0;

    const accessRole = await resolveAccessTokenRole(user.id, user.role);

    const token = generateAccessToken({
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

    logger.info(`User logged in: ${user.email} (jwtRole=${accessRole}, dbRole=${user.role})`);

    res.json({
      success: true,
      data: {
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
          suiAddress: user.sui_address ?? null,
        },
        accessToken: token,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange a Google ID token for CampusCuts JWTs (same shape as POST /auth/login).
 * Used by Intera (iOS) and any client using Google Sign-In.
 */
export const googleIdTokenLogin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const raw =
      (req.body?.idToken ?? req.body?.id_token) as string | undefined;
    const idToken = typeof raw === 'string' ? raw.trim() : '';
    if (!idToken) {
      throw new ApiError(400, 'idToken is required');
    }

    const audiences = getGoogleJwtExchangeAudiences();
    if (audiences.length === 0) {
      throw new ApiError(
        500,
        'Google sign-in is not configured. Set GOOGLE_OAUTH_IOS_CLIENT_ID and/or GOOGLE_OAUTH_WEB_CLIENT_ID (or VITE_GOOGLE_OAUTH_CLIENT_ID) on the server.'
      );
    }

    let ticket;
    try {
      ticket = await googleIdTokenClient.verifyIdToken({
        idToken,
        audience: audiences.length === 1 ? audiences[0]! : audiences,
      });
    } catch {
      throw new ApiError(401, 'Invalid or expired Google token');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new ApiError(401, 'Invalid Google token payload');
    }
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      throw new ApiError(401, 'Google token did not include a verified email');
    }
    if (payload.email_verified === false) {
      throw new ApiError(401, 'Google email is not verified');
    }

    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, "campusId", role, "isBlocked", "isBanned", email_verified, "avatarUrl", sui_address
       FROM users WHERE LOWER(TRIM(email)) = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new ApiError(401, 'Account not found', 'ACCOUNT_NOT_FOUND');
    }

    const user = result.rows[0];

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

    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: accessRole,
      campusId: user.campusId,
    });

    const refreshTokenJwt = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: accessRole,
      campusId: user.campusId,
    });

    logger.info(`User logged in via Google ID token: ${user.email} (jwtRole=${accessRole}, dbRole=${user.role})`);

    res.json({
      success: true,
      data: {
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
          suiAddress: user.sui_address ?? null,
        },
        accessToken: token,
        refreshToken: refreshTokenJwt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email with token
 */
export const verifyEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ApiError(400, 'Verification token required');
    }

    // Verify JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as { userId: string };

    // Update user's email_verified status
    await pool.query(
      'UPDATE users SET email_verified = TRUE WHERE id = $1',
      [decoded.userId]
    );

    logger.info(`Email verified for user: ${decoded.userId}`);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If email exists, reset instructions have been sent',
      });
      return;
    }

    // Generate reset token and send email
    const userId = result.rows[0].id;
    const resetToken = generatePasswordResetToken(userId);
    const frontendUrl = process.env.FRONTEND_URL || 'https://campuscut.com';
    const resetLink = `${frontendUrl}/web/reset-password?token=${resetToken}`;
    
    // Send password reset email (non-blocking)
    sendPasswordResetEmail(email, resetLink).catch((err) => {
      logger.error('Failed to send password reset email:', err.message);
    });

    res.json({
      success: true,
      message: 'If email exists, reset instructions have been sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 */
export const resetPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as { userId: string };
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, decoded.userId]
    );

    logger.info(`Password reset for user: ${decoded.userId}`);

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token required');
    }

    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT secrets not configured');

    const decoded = jwt.verify(refreshToken, secret) as JwtPayload;

    const userResult = await pool.query(
      `SELECT email, role, "campusId" FROM users WHERE id = $1`,
      [decoded.userId]
    );
    if (userResult.rows.length === 0) {
      throw new ApiError(401, 'User no longer exists');
    }
    const u = userResult.rows[0];
    const accessRole = await resolveAccessTokenRole(decoded.userId, u.role);

    const newToken = generateAccessToken({
      userId: decoded.userId,
      email: u.email,
      role: accessRole,
      campusId: u.campusId,
    });

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    next(new ApiError(401, 'Invalid refresh token'));
  }
};

/**
 * Get current user profile
 * Returns the authenticated user's data including role information
 */
export const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const result = await pool.query(
      `SELECT 
        id, email, first_name, last_name, role, "campusId", 
        email_verified, "avatarUrl", "displayName", bio,
        "isBlocked", "isBanned", "createdAt", sui_address
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = result.rows[0];

    // Check if user has an ACTIVE barber profile (demoted barbers have isActive = false)
    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1 AND "isActive" = true',
      [userId]
    );
    const hasBarberProfile = barberCheck.rows.length > 0;

    // Map database role to frontend role
    let frontendRole: 'student' | 'barber' | 'campus_manager' | 'admin';
    switch (user.role) {
      case 'CONSUMER':
        frontendRole = 'student';
        break;
      case 'BARBER':
        frontendRole = 'barber';
        break;
      case 'CAMPUS_MANAGER':
        frontendRole = 'campus_manager';
        break;
      case 'ADMIN':
        frontendRole = 'admin';
        break;
      default:
        frontendRole = 'student';
    }

    if (hasBarberProfile && frontendRole === 'student') {
      frontendRole = 'barber';
    }

    // Admins have all privileges including campus manager at all campuses
    const isAdmin = frontendRole === 'admin';
    const isCampusManager = frontendRole === 'campus_manager' || isAdmin;
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: frontendRole,
        is_admin: isAdmin,
        is_campus_manager: isCampusManager,
        has_barber_profile: hasBarberProfile,
        is_verified: user.email_verified,
        profile_picture_url: user.avatarUrl,
        display_name: user.displayName,
        bio: user.bio,
        campus_id: user.campusId,
        created_at: user.createdAt,
        sui_address: user.sui_address ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * JWT token generation and verification is now handled by utils/jwt.utils.ts
 * See that file for comprehensive JWT documentation and helper functions.
 */

