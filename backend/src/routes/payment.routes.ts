import express, { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createPaymentIntent,
  capturePayment,
  processRefund,
  getEarningsSummary,
  requestPayout,
  stripeWebhook,
} from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router: Router = express.Router();

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create Stripe payment intent for booking
 * @access  Private (Students)
 */
router.post(
  '/create-intent',
  authenticate,
  [
    body('bookingId').isInt().withMessage('Valid booking ID required'),
    body('amount').isInt({ min: 500 }).withMessage('Minimum amount is $5.00'),
    validate,
  ],
  createPaymentIntent
);

/**
 * @route   POST /api/payments/:id/capture
 * @desc    Capture payment after service completion
 * @access  Private (Platform or Barber)
 */
router.post(
  '/:id/capture',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), validate],
  capturePayment
);

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Process refund
 * @access  Private (Platform or authorized user)
 */
router.post(
  '/:id/refund',
  authenticate,
  [
    param('id').isUUID(),
    body('reason').optional().isString(),
    body('amount').optional().isInt(),
    validate,
  ],
  processRefund
);

/**
 * @route   GET /api/payments/earnings/summary
 * @desc    Get earnings summary for barber
 * @access  Private (Barber only)
 */
router.get(
  '/earnings/summary',
  authenticate,
  requireRole('barber'),
  getEarningsSummary
);

/**
 * @route   POST /api/payments/payout
 * @desc    Request instant payout
 * @access  Private (Barber only)
 */
router.post(
  '/payout',
  authenticate,
  requireRole('barber'),
  [body('amount').isInt({ min: 1000 }).withMessage('Minimum payout is $10.00'), validate],
  requestPayout
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Stripe webhook handler
 * @access  Public (Stripe only)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;

