import express from 'express';
import { reverseGeocodePlace, searchGeocodePlaces } from '../controllers/geocode.controller';

const router = express.Router();

// Public: coarse place search / reverse only (city/campus — no street addresses).
// Needed for signed-out Discover browse and map area labels.
router.get('/search', searchGeocodePlaces);
router.get('/reverse', reverseGeocodePlace);

export default router;
