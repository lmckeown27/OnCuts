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
 * - Creates Aptos wallet for user
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
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest, JwtPayload } from '../middleware/auth';
import aptosService from '../services/aptos.service';
import { logger } from '../utils/logger';
import {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyToken,
} from '../utils/jwt.utils';
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
import educationalDomainService from '../services/educationalDomain.service';

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
    const { email, password, firstName, lastName, role } = req.body;

    // Validate input (campusId is now auto-detected from email domain)
    if (!email || !password || !firstName || !lastName || !role) {
      throw new ApiError(400, 'All fields are required');
    }

    // Step 1: Validate educational domain (.edu restriction for now)
    const emailDomain = email.split('@')[1];
    
    // For now, only allow .edu emails
    if (!emailDomain || !emailDomain.endsWith('.edu')) {
      throw new ApiError(400, 'Please use your university email address (.edu)');
    }

    // Step 2: Check if it's a valid educational domain
    const domainValidation = await educationalDomainService.validateEducationalDomain(email);
    
    if (!domainValidation.isValid) {
      if (domainValidation.isUnsupportedUniversity) {
        throw new ApiError(400, 
          `Your university (${emailDomain}) is not currently supported on CampusCut. ` +
          `Please email campuscuthelp@gmail.com to request that your university be added.`
        );
      }
      throw new ApiError(400, 'Please use a valid university email address (.edu)');
    }

    // Step 3: Look up or create campus based on email domain
    let campusId: string;
    const existingCampus = await pool.query(
      'SELECT id, name FROM campuses WHERE domain = $1',
      [emailDomain]
    );

    if (existingCampus.rows.length > 0) {
      campusId = existingCampus.rows[0].id;
      logger.info(`Found existing campus: ${existingCampus.rows[0].name} (ID: ${campusId})`);
    } else {
      // Create new campus entry for this domain
      // Generate slug from domain (e.g., "calpoly.edu" -> "calpoly")
      const slug = emailDomain.replace('.edu', '').replace(/\./g, '-');
      const universityName = domainValidation.university || emailDomain.replace('.edu', '').toUpperCase();
      
      const newCampus = await pool.query(
        `INSERT INTO campuses (id, slug, name, city, state, country, timezone, domain, "isActive", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'Unknown', 'XX', 'US', 'America/Los_Angeles', $3, TRUE, NOW())
         RETURNING id`,
        [slug, universityName, emailDomain]
      );
      campusId = newCampus.rows[0].id;
      logger.info(`Created new campus: ${emailDomain} (ID: ${campusId})`);
    }

    // Check if user already exists in database
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User with this email already exists');
    }

    // Check if there's already a pending registration
    if (hasPendingRegistration(email)) {
      throw new ApiError(400, 'Verification already in progress. Please complete verification or wait 10 minutes to try again.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create pending registration with email verification code
    const verificationCode = createPendingRegistration({
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
 * Generates Aptos wallet and issues JWT token.
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
 *     "aptosAddress": "0x1234..."
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
    const pendingReg = verifyCode(email, code);

    if (!pendingReg) {
      throw new ApiError(400, 'Invalid or expired verification code');
    }

    // Check again if user was created in the meantime
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User already exists. Please log in.');
    }

    // Map frontend role to database enum (student -> CONSUMER, barber -> BARBER)
    const roleMap: { [key: string]: string } = {
      'student': 'CONSUMER',
      'barber': 'BARBER',
      'admin': 'ADMIN'
    };
    const dbRole = roleMap[pendingReg.role.toLowerCase()] || 'CONSUMER';

    // Create user in database (off-chain for v1 - no blockchain wallets)
    // Note: Column names use camelCase in the database schema
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, "campusId", role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6::\"UserRole\", TRUE)
       RETURNING id, email, first_name, last_name, "campusId", role, "createdAt"`,
      [
        pendingReg.email,
        pendingReg.password,
        pendingReg.firstName,
        pendingReg.lastName,
        pendingReg.campusId,
        dbRole
      ]
    );

    const user = result.rows[0];

    // Generate JWT access token
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campus_id,
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.first_name).catch(err => {
      logger.error('Failed to send welcome email:', err);
    });

    logger.info(`New user registered and verified: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      message: 'Email verified successfully. Welcome to CampusCuts!',
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
        token
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
    const pendingReg = getPendingRegistration(email);

    if (!pendingReg) {
      throw new ApiError(400, 'No pending registration found for this email. Please register first.');
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User already exists. Please log in.');
    }

    // Create new verification code (overwrites previous)
    const verificationCode = createPendingRegistration({
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

    // Validate .edu email domain
    const emailDomain = email.split('@')[1];
    if (!emailDomain || !emailDomain.endsWith('.edu')) {
      throw new ApiError(400, 'Please use your university email address (.edu)');
    }

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, campus_id, role, is_active, email_verified
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new ApiError(403, 'Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate JWT access token
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campus_id,
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          campusId: user.campus_id,
          emailVerified: user.email_verified,
        },
        token,
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

    // Generate reset token (implement email sending separately)
    // const resetToken = generateResetToken(result.rows[0].id);
    // await sendPasswordResetEmail(email, resetToken);

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

    // Generate new access token
    const newToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      campusId: decoded.campusId,
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
 * JWT token generation and verification is now handled by utils/jwt.utils.ts
 * See that file for comprehensive JWT documentation and helper functions.
 */

