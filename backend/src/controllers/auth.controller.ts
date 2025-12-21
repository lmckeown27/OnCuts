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

/**
 * Register New User
 * 
 * Creates a new user account with email/password authentication.
 * Also generates an Aptos wallet for blockchain transactions.
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
 *   "role": "student",
 *   "phone": "+1234567890"
 * }
 * ```
 * 
 * ## Response:
 * ```json
 * {
 *   "success": true,
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
 *   },
 *   "message": "Registration successful. Please verify your email."
 * }
 * ```
 * 
 * @param req - Express request with registration data
 * @param res - Express response
 * @param next - Express next function
 */
export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, campusId, role, phone } = req.body;

    // Verify email domain matches campus
    const campusResult = await pool.query('SELECT domain FROM campuses WHERE id = $1', [campusId]);
    
    if (campusResult.rows.length === 0) {
      throw new ApiError(400, 'Invalid campus ID');
    }

    const campusDomain = campusResult.rows[0].domain;
    const emailDomain = email.split('@')[1];

    if (emailDomain !== campusDomain) {
      throw new ApiError(400, `Email must be from ${campusDomain}`);
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate Aptos wallet for user (custodial)
    const aptosAccount = aptosService.generateAccount();

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, campus_id, role, aptos_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, campus_id, role, aptos_address, created_at`,
      [email, passwordHash, firstName, lastName, phone, campusId, role, aptosAccount.address]
    );

    const user = result.rows[0];

    // Generate JWT access token
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campus_id,
    });

    // Send verification email (implement separately)
    // await sendVerificationEmail(user.email, user.id);

    logger.info(`New user registered: ${user.email} (${role})`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          campusId: user.campus_id,
        },
        token,
        aptosAddress: aptosAccount.address,
      },
      message: 'Registration successful. Please verify your email.',
    });
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

