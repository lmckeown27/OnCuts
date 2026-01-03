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
    query('campusId').optional().isUUID(),
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

export default router;

