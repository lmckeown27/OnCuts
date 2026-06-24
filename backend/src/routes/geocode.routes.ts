import express from 'express';
import { authenticate } from '../middleware/auth';
import { reverseGeocodePlace, searchGeocodePlaces } from '../controllers/geocode.controller';

const router = express.Router();

router.get('/search', authenticate, searchGeocodePlaces);
router.get('/reverse', authenticate, reverseGeocodePlace);

export default router;
