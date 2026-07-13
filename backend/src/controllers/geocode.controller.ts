import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  GeocodeUpstreamError,
  reverseGeocodeCoarse,
  sanitizeGeocodeQuery,
  searchPlaces,
} from '../services/geocode.service';

export const searchGeocodePlaces = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const q = sanitizeGeocodeQuery(String(req.query.q || ''));
    if (q.length < 2) {
      throw new ApiError(400, 'Search query must be at least 2 characters');
    }

    const results = await searchPlaces(q);
    res.json({ success: true, data: results });
  } catch (error) {
    if (error instanceof GeocodeUpstreamError) {
      return next(new ApiError(error.statusCode, error.message));
    }
    next(error);
  }
};

export const reverseGeocodePlace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const latitude = parseFloat(String(req.query.lat));
    const longitude = parseFloat(String(req.query.lng));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new ApiError(400, 'Valid lat and lng query parameters are required');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new ApiError(400, 'Coordinates out of range');
    }

    // Public-facing reverse: city/town only (no street address)
    const place = await reverseGeocodeCoarse(latitude, longitude);
    if (!place) {
      throw new ApiError(404, 'Could not resolve a place name for those coordinates');
    }

    res.json({ success: true, data: place });
  } catch (error) {
    if (error instanceof GeocodeUpstreamError) {
      return next(new ApiError(error.statusCode, error.message));
    }
    next(error);
  }
};
