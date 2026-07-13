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
import {
  barberServiceLocationLabelColumnExists,
  barberServiceLocationSourceColumnExists,
  barberServiceLocationWebOnlyColumnExists,
  normalizeServiceLocationSource,
  parseOptionalBoolean,
  warnIfBarberServiceLocationSourceMissing,
  warnIfBarberServiceLocationWebOnlyMissing,
} from '../services/barber-location-schema.service';
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

function mapServiceLocationRow(
  row: Record<string, unknown> | undefined,
  opts: {
    hasLabelColumn: boolean;
    hasSourceColumn: boolean;
    hasWebOnlyColumn: boolean;
    ignoredDeviceUpdate?: boolean;
  }
) {
  if (!row) {
    return {
      service_latitude: null,
      service_longitude: null,
      service_radius_km: null,
      service_location_label: undefined as string | undefined,
      service_location_source: undefined as string | undefined,
      service_location_updated_at: undefined as string | undefined,
      service_location_web_only: opts.hasWebOnlyColumn ? false : undefined,
      ...(opts.ignoredDeviceUpdate ? { ignored_device_update: true as const } : {}),
    };
  }

  return {
    service_latitude: row.service_latitude ?? null,
    service_longitude: row.service_longitude ?? null,
    service_radius_km: row.service_radius_km ?? null,
    service_location_label: opts.hasLabelColumn
      ? (row.service_location_label as string | null | undefined)
      : undefined,
    service_location_source: opts.hasSourceColumn
      ? (row.service_location_source as string | null | undefined)
      : undefined,
    service_location_updated_at: opts.hasSourceColumn
      ? (row.service_location_updated_at as string | null | undefined)
      : undefined,
    service_location_web_only: opts.hasWebOnlyColumn
      ? row.service_location_web_only === true
      : undefined,
    ...(opts.ignoredDeviceUpdate ? { ignored_device_update: true as const } : {}),
  };
}

/**
 * Get barber's current public service location pin
 * GET /api/barbers/service-location
 */
export const getBarberServiceLocation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const hasLabelColumn = await barberServiceLocationLabelColumnExists();
    const hasSourceColumn = await barberServiceLocationSourceColumnExists();
    const hasWebOnlyColumn = await barberServiceLocationWebOnlyColumnExists();

    const result = await pool.query(
      `SELECT service_latitude, service_longitude, service_radius_km
              ${hasLabelColumn ? ', service_location_label' : ''}
              ${hasSourceColumn ? ', service_location_source, service_location_updated_at' : ''}
              ${hasWebOnlyColumn ? ', service_location_web_only' : ''}
       FROM barbers
       WHERE "userId" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Barber profile not found');
    }

    res.json({
      success: true,
      data: mapServiceLocationRow(result.rows[0], {
        hasLabelColumn,
        hasSourceColumn,
        hasWebOnlyColumn,
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update barber's service location (where they provide services)
 * PUT /api/barbers/service-location
 *
 * Operator iOS (primary, unless web_only): { latitude, longitude, source: "device", label? }
 * Web PlaceSearch (backup / web-only): { latitude, longitude, source: "manual" | omitted, label? }
 * Opt out of iOS device pin: { web_only: true } (or false to re-enable device priority)
 *
 * Accepts label aliases: service_location_label | label
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

    const {
      latitude,
      longitude,
      service_radius_km,
      service_location_label,
      label: labelAlias,
      source: sourceRaw,
      web_only: webOnlyRaw,
      webOnly: webOnlyCamel,
    } = req.body;

    const webOnlyUpdate = parseOptionalBoolean(
      webOnlyRaw !== undefined ? webOnlyRaw : webOnlyCamel
    );

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

    if (service_radius_km !== undefined) {
      if (typeof service_radius_km !== 'number' || service_radius_km < 0 || service_radius_km > 100) {
        throw new ApiError(400, 'Service radius must be a number between 0 and 100 km');
      }
    }

    let label: string | null | undefined =
      service_location_label !== undefined ? service_location_label : labelAlias;
    if (label !== undefined) {
      if (label !== null && typeof label !== 'string') {
        throw new ApiError(400, 'label must be a string');
      }
      if (typeof label === 'string') {
        label = label.trim();
        if (label.length === 0) {
          throw new ApiError(400, 'label cannot be empty');
        }
        if (label.length > 500) {
          throw new ApiError(400, 'label is too long');
        }
      }
    }

    let source = normalizeServiceLocationSource(sourceRaw) ?? 'manual';
    if (source === 'campus_default') {
      throw new ApiError(400, 'source cannot be set to campus_default via this endpoint');
    }

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
    const hasWebOnlyColumn = await barberServiceLocationWebOnlyColumnExists();
    await warnIfBarberServiceLocationSourceMissing();
    await warnIfBarberServiceLocationWebOnlyMissing();

    if (label !== undefined && !hasLabelColumn) {
      label = undefined;
    }

    let currentWebOnly = false;
    if (hasWebOnlyColumn) {
      const wo = await pool.query(
        `SELECT service_location_web_only FROM barbers WHERE id = $1`,
        [barberId]
      );
      currentWebOnly = wo.rows[0]?.service_location_web_only === true;
    }

    const coordsProvided = latitude !== undefined || longitude !== undefined;
    if (
      webOnlyUpdate !== undefined &&
      !coordsProvided &&
      service_radius_km === undefined &&
      label === undefined
    ) {
      if (!hasWebOnlyColumn) {
        throw new ApiError(503, 'service_location_web_only is not available; run migration 043');
      }
      const prefResult = await pool.query(
        `UPDATE barbers
         SET service_location_web_only = $1,
             "updatedAt" = NOW()
         WHERE id = $2
         RETURNING id, service_latitude, service_longitude, service_radius_km,
                   service_location_label, service_location_source, service_location_updated_at,
                   service_location_web_only`,
        [webOnlyUpdate, barberId]
      );
      const row = prefResult.rows[0];
      return res.json({
        success: true,
        message: webOnlyUpdate
          ? 'Web-only location enabled; device location will not update your public pin'
          : 'Device location priority re-enabled for the Operator app',
        data: mapServiceLocationRow(row, {
          hasLabelColumn,
          hasSourceColumn,
          hasWebOnlyColumn: true,
        }),
      });
    }

    const effectiveWebOnly =
      webOnlyUpdate !== undefined ? webOnlyUpdate : currentWebOnly;

    if (source === 'device' && effectiveWebOnly) {
      const snap = await pool.query(
        `SELECT service_latitude, service_longitude, service_radius_km
                ${hasLabelColumn ? ', service_location_label' : ''}
                ${hasSourceColumn ? ', service_location_source, service_location_updated_at' : ''}
                ${hasWebOnlyColumn ? ', service_location_web_only' : ', false AS service_location_web_only'}
         FROM barbers WHERE id = $1`,
        [barberId]
      );
      return res.json({
        success: true,
        message: 'Device location ignored; operator selected web-only public location',
        data: mapServiceLocationRow(snap.rows[0], {
          hasLabelColumn,
          hasSourceColumn,
          hasWebOnlyColumn: true,
          ignoredDeviceUpdate: true,
        }),
      });
    }

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

    const nextWebOnly =
      hasWebOnlyColumn && webOnlyUpdate !== undefined
        ? webOnlyUpdate
        : hasWebOnlyColumn
          ? currentWebOnly
          : null;

    let result;
    if (hasLabelColumn && hasSourceColumn && hasWebOnlyColumn) {
      result = await pool.query(
        `UPDATE barbers
         SET service_latitude = COALESCE($1, service_latitude),
             service_longitude = COALESCE($2, service_longitude),
             service_radius_km = COALESCE($3, service_radius_km),
             service_location_label = COALESCE($4, service_location_label),
             service_location_source = $5,
             service_location_updated_at = NOW(),
             service_location_web_only = COALESCE($6, service_location_web_only),
             "updatedAt" = NOW()
         WHERE id = $7
         RETURNING id, service_latitude, service_longitude, service_radius_km,
                   service_location_label, service_location_source, service_location_updated_at,
                   service_location_web_only`,
        [latitude, longitude, service_radius_km, label, source, nextWebOnly, barberId]
      );
    } else if (hasLabelColumn && hasSourceColumn) {
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

    logger.info(
      `Barber ${barberId} service location updated (source=${source}, web_only=${result.rows[0].service_location_web_only ?? 'n/a'})`
    );

    const row = result.rows[0];
    res.json({
      success: true,
      message: 'Service location updated successfully',
      data: mapServiceLocationRow(row, {
        hasLabelColumn,
        hasSourceColumn,
        hasWebOnlyColumn,
      }),
    });
  } catch (error) {
    next(error);
  }
};
