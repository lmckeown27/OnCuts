import express, { Router } from 'express';
import { query } from 'express-validator';
import {
  getAllBarbers,
  getBarberById,
  getBarberByUserId,
  getMyBarberProfile,
  getBarberAvailability,
} from '../controllers/barber.controller';
import { optionalAuthenticate, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { transformServiceProviderJsonResponse } from '../middleware/service-provider-response.middleware';

const router: Router = express.Router();
const asProvider = transformServiceProviderJsonResponse;

/**
 * Service provider discovery & profile routes.
 * Reuses barber persistence and handlers; responses use the Intera ServiceProvider shape.
 */
router.get(
  '/',
  optionalAuthenticate,
  [
    query('campusId').optional().isString(),
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('maxPrice').optional().isInt(),
    query('specialty').optional().isString(),
    query('providerType').optional().isString(),
    query('category').optional().isIn(['Haircuts', 'Beauty', 'Wellness', 'Fitness']),
    query('lat').optional().isFloat(),
    query('lng').optional().isFloat(),
    query('maxDistance').optional().isFloat({ min: 0 }),
    query('constrainListByDistance').optional().isIn(['true', 'false', '1', '0']),
    validate,
  ],
  asProvider,
  getAllBarbers
);

/** Legacy Intera fallback path (`GET /providers/list`). */
router.get(
  '/list',
  optionalAuthenticate,
  [
    query('campusId').optional().isString(),
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('maxPrice').optional().isInt(),
    query('specialty').optional().isString(),
    query('providerType').optional().isString(),
    query('category').optional().isIn(['Haircuts', 'Beauty', 'Wellness', 'Fitness']),
    query('lat').optional().isFloat(),
    query('lng').optional().isFloat(),
    query('maxDistance').optional().isFloat({ min: 0 }),
    query('constrainListByDistance').optional().isIn(['true', 'false', '1', '0']),
    validate,
  ],
  asProvider,
  getAllBarbers
);

router.get('/me', authenticate, asProvider, getMyBarberProfile);

router.get('/user/:userId', asProvider, getBarberByUserId);

router.get('/:id/availability', asProvider, getBarberAvailability);

router.get('/:id', optionalAuthenticate, asProvider, getBarberById);

export default router;
