/**
 * Location Routes
 * 
 * API endpoints for campus location management
 * 
 * Public endpoints:
 * - POST /locations/submit - Submit a new location
 * - GET /locations/search - Search locations
 * - GET /locations - Get all locations for university
 * 
 * Admin endpoints:
 * - GET /locations/unverified - Get unverified locations
 * - POST /locations/merge - Merge duplicate locations
 * - POST /locations/:id/verify - Manually verify location
 * - POST /locations/:id/enrich - Trigger AI enrichment
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { pool } from '../database/connection';
import { CampusLocationService } from '../services/campus-location.service';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const locationService = new CampusLocationService(pool);

/**
 * Validation helper
 */
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * POST /api/locations/submit
 * Submit a location from barber or consumer
 * Optional authentication - userId attached if user is logged in
 */
router.post(
  '/submit',
  optionalAuthenticate,
  [
    body('universityId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('University ID required'),
    body('locationName')
      .isString()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Location name must be 2-200 characters'),
    body('category')
      .isIn(['ON_CAMPUS', 'OFF_CAMPUS', 'DORM', 'APARTMENT', 'COMMON_AREA', 'OTHER'])
      .withMessage('Valid category required'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { universityId, locationName, category } = req.body;
      const userId = (req as any).user?.userId || null; // Optional userId

      logger.info('Location submission received', {
        userId: userId || 'anonymous',
        universityId,
        locationName,
        category,
      });

      const location = await locationService.submitLocation({
        universityId,
        locationName,
        category,
        userId,
      });

      res.status(201).json({
        success: true,
        data: {
          location,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/locations
 * Get locations for selection (e.g., when barber is scheduling)
 * Public endpoint - no auth required for browsing locations
 */
router.get(
  '/',
  [
    query('universityId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('University ID required'),
    query('category').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { universityId, category } = req.query;

      logger.debug('Fetching locations', { universityId, category });

      const locations = await locationService.getLocationsForSelection(
        universityId as string,
        category as string | undefined
      );

      logger.debug('Locations found', { count: locations.length });

      res.json({
        success: true,
        data: {
          locations,
          count: locations.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching locations:', error);
      next(error);
    }
  }
);

/**
 * GET /api/locations/search
 * Search locations by name (autocomplete)
 * Public endpoint - no auth required for searching locations
 */
router.get(
  '/search',
  [
    query('universityId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('University ID required'),
    query('q').isString().trim().isLength({ min: 1 }).withMessage('Search query required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { universityId, q, limit = 10 } = req.query;

      const locations = await locationService.searchLocations(
        universityId as string,
        q as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: {
          locations,
          count: locations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/locations/:id
 * Get single location by ID
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Valid location ID required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const location = await locationService.getLocationById(id);

      if (!location) {
        throw new ApiError(404, 'Location not found');
      }

      res.json({
        success: true,
        data: {
          location,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/locations/stats/university/:universityId
 * Get location statistics for a university
 */
router.get(
  '/stats/university/:universityId',
  authenticate,
  [param('universityId').isUUID().withMessage('Valid university ID required')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { universityId } = req.params;

      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_locations,
          COUNT(*) FILTER (WHERE is_verified = true) as verified_locations,
          COUNT(*) FILTER (WHERE is_verified = false) as unverified_locations,
          SUM(usage_count) as total_usage,
          AVG(confidence) as avg_confidence
         FROM campus_locations
         WHERE university_id = $1`,
        [universityId]
      );

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

