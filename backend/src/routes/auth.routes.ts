import express, { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  verifyEmail,
  verifyEmailRegistration,
  checkPendingRegistrationCredentials,
  confirmRegistrationVerificationCode,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  refreshToken,
  getCurrentUser,
} from '../controllers/auth.controller';
import { requestPhoneOtp, verifyPhoneOtp } from '../controllers/intera-otp.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
const router: Router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (creates pending registration, sends email verification)
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('phoneNumber').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('role').isIn(['student', 'barber']).withMessage('Role must be student or barber'),
    validate,
  ],
  register
);

/**
 * @route   POST /api/auth/confirm-verification-code
 * @desc    Validate 6-digit code only (no account created)
 * @access  Public
 */
router.post(
  '/confirm-verification-code',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
    validate,
  ],
  confirmRegistrationVerificationCode
);

/**
 * @route   POST /api/auth/request-otp
 * @desc    Intera: send 6-digit SMS code (Pinpoint Notify); stored in Redis until expiry
 * @access  Public
 */
router.post(
  '/request-otp',
  [
    body('phoneNumber').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    validate,
  ],
  requestPhoneOtp
);

/**
 * @route   POST /api/auth/signup/send-phone-code
 * @desc    Same as request-otp (alias for iOS / Intera clients that use this path during sign-up)
 * @access  Public
 */
router.post(
  '/signup/send-phone-code',
  [
    body('phoneNumber').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    validate,
  ],
  requestPhoneOtp
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Intera: verify SMS code; if users.phone_e164 matches, returns JWTs (same shape as login)
 * @access  Public
 */
router.post(
  '/verify-otp',
  [
    body('phoneNumber').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('code')
      .notEmpty()
      .withMessage('Verification code is required')
      .matches(/^[0-9]{6}$/)
      .withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyPhoneOtp
);

/**
 * @route   POST /api/auth/signup/verify-phone-code
 * @desc    Same as verify-otp (alias for iOS / Intera sign-up flows)
 * @access  Public
 */
router.post(
  '/signup/verify-phone-code',
  [
    body('phoneNumber').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('code')
      .notEmpty()
      .withMessage('Verification code is required')
      .matches(/^[0-9]{6}$/)
      .withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyPhoneOtp
);

/**
 * @route   POST /api/auth/check-pending-credentials
 * @desc    Verify email/password against pending registration (verification page gate)
 * @access  Public
 */
router.post(
  '/check-pending-credentials',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate,
  ],
  checkPendingRegistrationCredentials
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Completes registration after code confirmation (or email + code in one request)
 * @access  Public
 */
router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('code')
      .optional()
      .custom((value) => {
        if (value === undefined || value === null || value === '') return true;
        return /^[0-9]{6}$/.test(String(value).trim());
      })
      .withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyEmailRegistration
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification code
 * @access  Public
 */
router.post(
  '/resend-verification',
  [
    body('email').isEmail().withMessage('Valid email required'),
    validate,
  ],
  resendVerificationCode
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    validate,
  ],
  login
);

/**
 * Google ID token login: POST /api/v1/auth/google and POST /api/auth/google are registered in index.ts
 * (after rate limiters) so deploys cannot miss the route if dist/auth.routes.js is stale.
 */

/**
 * @route   POST /api/auth/verify-email-token
 * @desc    Verify email with JWT token (legacy, for existing users)
 * @access  Public
 */
router.post('/verify-email-token', verifyEmail);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  '/request-password-reset',
  [body('email').isEmail().withMessage('Valid email required'), validate],
  requestPasswordReset
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate,
  ],
  resetPassword
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

export default router;
