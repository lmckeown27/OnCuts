import express, { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  verifyEmail,
  verifyEmailRegistration,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  refreshToken,
  getCurrentUser,
} from '../controllers/auth.controller';
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
    body('firstName').notEmpty().withMessage('First name required'),
    body('lastName').notEmpty().withMessage('Last name required'),
    body('role').isIn(['student', 'barber']).withMessage('Role must be student or barber'),
    validate,
  ],
  register
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with 6-digit code (completes registration)
 * @access  Public
 */
router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
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
