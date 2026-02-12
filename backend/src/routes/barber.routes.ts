import express, { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getAllBarbers,
  getBarberById,
  getBarberByUserId,
  getMyBarberProfile,
  createBarberProfile,
  updateBarberProfile,
  deleteBarberProfile,
  removeBarber,
  getBarberPortfolio,
  addPortfolioImage,
  deletePortfolioImage,
  updateAvailability,
  getBarberAvailability,
  getBarberEarnings,
  getBarberAnalytics,
} from '../controllers/barber.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { upload } from '../middleware/upload';

const router: Router = express.Router();

/**
 * @route   GET /api/barbers
 * @desc    Get all barbers (with filters)
 * @access  Public
 */
router.get(
  '/',
  [
    query('campusId').optional().isString(), // Accept UUID or slug
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('maxPrice').optional().isInt(),
    query('specialty').optional().isString(),
    validate,
  ],
  getAllBarbers
);

/**
 * @route   GET /api/barbers/me
 * @desc    Get current user's barber profile
 * @access  Private (Barbers only)
 */
router.get('/me', authenticate, getMyBarberProfile);

/**
 * @route   GET /api/barbers/user/:userId
 * @desc    Get barber by user ID
 * @access  Public
 */
router.get('/user/:userId', getBarberByUserId);

/**
 * @route   GET /api/barbers/:id
 * @desc    Get barber by ID
 * @access  Public
 */
router.get('/:id', getBarberById); // Removed UUID validation for demo

/**
 * @route   POST /api/barbers
 * @desc    Create barber profile
 * @access  Private (Barbers only)
 */
router.post(
  '/',
  authenticate,
  requireRole('barber'),
  [
    body('bio').notEmpty().withMessage('Bio required'),
    body('pricing').isObject().withMessage('Pricing object required'),
    body('specialties').isArray().withMessage('Specialties array required'),
    body('yearsExperience').optional().isInt(),
    validate,
  ],
  createBarberProfile
);

/**
 * @route   PUT /api/barbers/:id
 * @desc    Update barber profile
 * @access  Private (Owner only)
 */
router.put(
  '/:id',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), validate],
  updateBarberProfile
);

/**
 * @route   DELETE /api/barbers/:id
 * @desc    Delete barber profile
 * @access  Private (Owner only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), validate],
  deleteBarberProfile
);

/**
 * @route   POST /api/barbers/:id/remove
 * @desc    Remove barber (demote to consumer) - Campus Manager only
 * @access  Private (Campus Manager or Admin)
 */
router.post(
  '/:id/remove',
  authenticate,
  [param('id').isUUID(), validate],
  removeBarber
);

/**
 * @route   GET /api/barbers/:id/portfolio
 * @desc    Get barber portfolio images
 * @access  Public
 */
router.get('/:id/portfolio', [param('id').isUUID(), validate], getBarberPortfolio);

/**
 * @route   POST /api/barbers/:id/portfolio
 * @desc    Add portfolio image
 * @access  Private (Owner only)
 */
router.post(
  '/:id/portfolio',
  authenticate,
  requireRole('barber'),
  upload.single('image'),
  [param('id').isUUID(), body('caption').optional().isString(), validate],
  addPortfolioImage
);

/**
 * @route   DELETE /api/barbers/:barberId/portfolio/:imageId
 * @desc    Delete portfolio image
 * @access  Private (Owner only)
 */
router.delete(
  '/:barberId/portfolio/:imageId',
  authenticate,
  requireRole('barber'),
  [param('barberId').isUUID(), param('imageId').isUUID(), validate],
  deletePortfolioImage
);

/**
 * @route   PUT /api/barbers/:id/availability
 * @desc    Update availability schedule
 * @access  Private (Owner only)
 */
router.put(
  '/:id/availability',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), body('schedule').isArray(), validate],
  updateAvailability
);

/**
 * @route   GET /api/barbers/:id/availability
 * @desc    Get barber availability
 * @access  Public
 */
router.get(
  '/:id/availability',
  [param('id').isUUID(), query('date').optional().isISO8601(), validate],
  getBarberAvailability
);

/**
 * @route   GET /api/barbers/:id/earnings
 * @desc    Get barber earnings summary
 * @access  Private (Owner only)
 */
router.get(
  '/:id/earnings',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), validate],
  getBarberEarnings
);

/**
 * @route   GET /api/barbers/:id/analytics
 * @desc    Get barber analytics dashboard
 * @access  Private (Owner only)
 */
router.get(
  '/:id/analytics',
  authenticate,
  requireRole('barber'),
  [param('id').isUUID(), validate],
  getBarberAnalytics
);

// =====================================================
// TIME BLOCKS - One-time date-specific availability blocks
// =====================================================

import {
  getTimeBlocks,
  createTimeBlock,
  deleteTimeBlock
} from '../controllers/barber.controller';

/**
 * @route   GET /api/barbers/:id/time-blocks
 * @desc    Get barber's time blocks (optionally filtered by date range)
 * @access  Private (Owner only)
 */
router.get(
  '/:id/time-blocks',
  authenticate,
  requireRole('barber'),
  [
    param('id').isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validate
  ],
  getTimeBlocks
);

/**
 * @route   POST /api/barbers/:id/time-blocks
 * @desc    Create a new time block for a specific date
 * @access  Private (Owner only)
 */
router.post(
  '/:id/time-blocks',
  authenticate,
  requireRole('barber'),
  [
    param('id').isUUID(),
    body('blockDate').isISO8601().withMessage('Valid date required (YYYY-MM-DD)'),
    body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time required (HH:MM)'),
    body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time required (HH:MM)'),
    body('reason').optional().isString().isLength({ max: 255 }),
    validate
  ],
  createTimeBlock
);

/**
 * @route   DELETE /api/barbers/:id/time-blocks/:blockId
 * @desc    Delete a time block
 * @access  Private (Owner only)
 */
router.delete(
  '/:id/time-blocks/:blockId',
  authenticate,
  requireRole('barber'),
  [
    param('id').isUUID(),
    param('blockId').isUUID(),
    validate
  ],
  deleteTimeBlock
);

export default router;

