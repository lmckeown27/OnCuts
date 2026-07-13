/**
 * User Location Controller
 * 
 * Handles updating and retrieving user location data
 * for proximity-based barber matching.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { barberServiceLocationLabelColumnExists, barberServiceLocationSourceColumnExists, normalizeServiceLocationSource, warnIfBarberServiceLocationSourceMissing } from '../services/barber-location-schema.service';
import { reverseGeocodeCoarse } from '../services/geocode.service';

interface UpdateLocationBody {
  latitude: number;
  longitude: number;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
}

/**
 * Update user's current location
 * PUT /api/users/location
 */
export const updateUserLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { latitude, longitude, permission }: UpdateLocationBody = req.body;

    // Validate permission value
    const validPermissions = ['granted', 'denied', 'prompt', 'unavailable'];
    if (!validPermissions.includes(permission)) {
      throw new ApiError(400, `Invalid permission value. Must be one of: ${validPermissions.join(', ')}`);
    }

    // If permission is granted, latitude and longitude are required
    if (permission === 'granted') {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new ApiError(400, 'Latitude and longitude are required when permission is granted');
      }

      // Validate coordinate ranges
      if (latitude < -90 || latitude > 90) {
        throw new ApiError(400, 'Latitude must be between -90 and 90');
      }
      if (longitude < -180 || longitude > 180) {
        throw new ApiError(400, 'Longitude must be between -180 and 180');
      }
    }

    // Update user location
    const result = await pool.query(
      `UPDATE users 
       SET latitude = $1,
           longitude = $2,
           location_permission = $3,
           location_updated_at = NOW(),
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING id, latitude, longitude, location_permission, location_updated_at`,
      [
        permission === 'granted' ? latitude : null,
        permission === 'granted' ? longitude : null,
        permission,
        userId
      ]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    logger.info(`User ${userId} location updated: permission=${permission}, lat=${latitude}, lng=${longitude}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        latitude: result.rows[0].latitude,
        longitude: result.rows[0].longitude,
        permission: result.rows[0].location_permission,
        updated_at: result.rows[0].location_updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's current location status
 * GET /api/users/location
 */
export const getUserLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const result = await pool.query(
      `SELECT latitude, longitude, location_permission, location_updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        latitude: user.latitude,
        longitude: user.longitude,
        permission: user.location_permission || 'prompt',
        updated_at: user.location_updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update barber's service location (where they provide services)
 * PUT /api/barbers/service-location
 *
 * Operator iOS (primary): { latitude, longitude, source: "device", service_location_label? }
 * Web PlaceSearch (backup): { latitude, longitude, source: "manual" | omitted, service_location_label }
 *
 * Do not use PUT /users/location for the public discovery pin — that updates users.latitude
 * which client browse distance does not use.
 */
export const updateBarberServiceLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { latitude, longitude, service_radius_km, service_location_label, source: sourceRaw } =
      req.body;

    // Validate coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new ApiError(400, 'Latitude and longitude must be numbers');
      }
      if (latitude < -90 || latitude > 90) {
        throw new ApiError(400, 'Latitude must be between -90 and 90');
      }
      if (longitude < -180 || longitude > 180) {
        throw new ApiError(400, 'Longitude must be between -180 and 180');
      }
    }

    // Validate service radius
    if (service_radius_km !== undefined) {
      if (typeof service_radius_km !== 'number' || service_radius_km < 0 || service_radius_km > 100) {
        throw new ApiError(400, 'Service radius must be a number between 0 and 100 km');
      }
    }

    // Validate display label
    let label: string | null | undefined = service_location_label;
    if (label !== undefined) {
      if (label !== null && typeof label !== 'string') {
        throw new ApiError(400, 'service_location_label must be a string');
      }
      if (typeof label === 'string') {
        label = label.trim();
        if (label.length === 0) {
          throw new ApiError(400, 'service_location_label cannot be empty');
        }
        if (label.length > 500) {
          throw new ApiError(400, 'service_location_label is too long');
        }
      }
    }

    // Default to manual for web / older clients; device is primary from Operator iOS.
    let source = normalizeServiceLocationSource(sourceRaw) ?? 'manual';
    if (source === 'campus_default') {
      throw new ApiError(400, 'source cannot be set to campus_default via this endpoint');
    }

    // Check if user has a barber profile
    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1',
      [userId]
    );

    if (barberCheck.rows.length === 0) {
      throw new ApiError(404, 'Barber profile not found');
    }

    const barberId = barberCheck.rows[0].id;
    const hasLabelColumn = await barberServiceLocationLabelColumnExists();
    const hasSourceColumn = await barberServiceLocationSourceColumnExists();
    await warnIfBarberServiceLocationSourceMissing();

    if (label !== undefined && !hasLabelColumn) {
      label = undefined;
    }

    // Device updates without a label: reverse-geocode to a coarse city/region name.
    if (
      source === 'device' &&
      hasLabelColumn &&
      (label === undefined || label === null) &&
      typeof latitude === 'number' &&
      typeof longitude === 'number'
    ) {
      try {
        const place = await reverseGeocodeCoarse(latitude, longitude);
        if (place?.label) {
          label = place.label;
        }
      } catch (geoErr) {
        logger.warn('Device service-location reverse geocode failed; saving coords without label', {
          barberId,
          err: geoErr instanceof Error ? geoErr.message : geoErr,
        });
      }
    }

    let result;
    if (hasLabelColumn && hasSourceColumn) {
      result = await pool.query(
        `UPDATE barbers
         SET service_latitude = COALESCE($1, service_latitude),
             service_longitude = COALESCE($2, service_longitude),
             service_radius_km = COALESCE($3, service_radius_km),
             service_location_label = COALESCE($4, service_location_label),
             service_location_source = $5,
             service_location_updated_at = NOW(),
             "updatedAt" = NOW()
         WHERE id = $6
         RETURNING id, service_latitude, service_longitude, service_radius_km,
                   service_location_label, service_location_source, service_location_updated_at`,
        [latitude, longitude, service_radius_km, label, source, barberId]
      );
    } else if (hasLabelColumn) {
      result = await pool.query(
        `UPDATE barbers
         SET service_latitude = COALESCE($1, service_latitude),
             service_longitude = COALESCE($2, service_longitude),
             service_radius_km = COALESCE($3, service_radius_km),
             service_location_label = COALESCE($4, service_location_label),
             "updatedAt" = NOW()
         WHERE id = $5
         RETURNING id, service_latitude, service_longitude, service_radius_km, service_location_label`,
        [latitude, longitude, service_radius_km, label, barberId]
      );
    } else {
      result = await pool.query(
        `UPDATE barbers
         SET service_latitude = COALESCE($1, service_latitude),
             service_longitude = COALESCE($2, service_longitude),
             service_radius_km = COALESCE($3, service_radius_km),
             "updatedAt" = NOW()
         WHERE id = $4
         RETURNING id, service_latitude, service_longitude, service_radius_km`,
        [latitude, longitude, service_radius_km, barberId]
      );
    }

    logger.info(`Barber ${barberId} service location updated (source=${source})`);

    const row = result.rows[0];
    res.json({
      success: true,
      message: 'Service location updated successfully',
      data: {
        service_latitude: row.service_latitude,
        service_longitude: row.service_longitude,
        service_radius_km: row.service_radius_km,
        service_location_label: hasLabelColumn ? row.service_location_label : undefined,
        service_location_source: hasSourceColumn ? row.service_location_source : undefined,
        service_location_updated_at: hasSourceColumn ? row.service_location_updated_at : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

