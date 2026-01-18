/**
 * Location Routes
 * 
 * API endpoints for managing service locations and barber location assignments
 * 
 * Uses new tables:
 * - service_locations: Predefined locations created by campus managers
 * - barber_service_locations: Which locations each barber works at
 */

import { Router, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ============================================================================
// SERVICE LOCATIONS (Campus Manager / Admin)
// ============================================================================

/**
 * GET /api/v1/locations/campus/:campusId
 * Get all locations for a campus
 */
router.get('/campus/:campusId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;
    const { activeOnly } = req.query;
    
    let whereClause = 'campus_id = $1';
    if (activeOnly === 'true') {
      whereClause += ' AND is_active = true';
    }
    
    const result = await pool.query(
      `SELECT 
        sl.id,
        sl.campus_id,
        sl.name,
        sl.description,
        sl.is_active,
        sl.created_at,
        sl.updated_at,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM barber_service_locations bsl WHERE bsl.location_id = sl.id) as barber_count
      FROM service_locations sl
      LEFT JOIN users u ON sl.created_by = u.id
      WHERE ${whereClause}
      ORDER BY sl.name ASC`,
      [campusId]
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Error fetching campus locations:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/locations/campus/:campusId
 * Create a new location for a campus (Campus Manager / Admin only)
 */
router.post('/campus/:campusId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { campusId } = req.params;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Location name is required',
      });
    }
    
    // Check if user is campus manager or admin
    const authCheck = await pool.query(
      `SELECT u.role, b."isCampusManager", b."campusId"
       FROM users u
       LEFT JOIN barbers b ON u.id = b."userId"
       WHERE u.id = $1`,
      [userId]
    );
    
    const user = authCheck.rows[0];
    const isAdmin = user?.role === 'ADMIN';
    const isCampusManager = user?.isCampusManager && user?.campusId === campusId;
    
    if (!isAdmin && !isCampusManager) {
      return res.status(403).json({
        success: false,
        error: 'Only campus managers and admins can create locations',
      });
    }
    
    // Check for duplicate name
    const duplicateCheck = await pool.query(
      `SELECT id FROM service_locations WHERE campus_id = $1 AND LOWER(name) = LOWER($2)`,
      [campusId, name.trim()]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A location with this name already exists for this campus',
      });
    }
    
    const result = await pool.query(
      `INSERT INTO service_locations (campus_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [campusId, name.trim(), description || null, userId]
    );
    
    logger.info(`Location created: ${name} for campus ${campusId} by user ${userId}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error creating location:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/locations/barber/create
 * Create a new location and assign it to the barber (Barber can create locations)
 */
router.post('/barber/create', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Location name is required',
      });
    }
    
    // Get barber info
    const barberCheck = await pool.query(
      `SELECT b.id, b."campusId", b."isActive"
       FROM barbers b
       WHERE b."userId" = $1`,
      [userId]
    );
    
    if (barberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Barber profile not found',
      });
    }
    
    const barberId = barberCheck.rows[0].id;
    const campusId = barberCheck.rows[0].campusId;
    
    if (!barberCheck.rows[0].isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your barber account is not active',
      });
    }
    
    // Check for duplicate name
    const duplicateCheck = await pool.query(
      `SELECT id FROM service_locations WHERE campus_id = $1 AND LOWER(name) = LOWER($2)`,
      [campusId, name.trim()]
    );
    
    if (duplicateCheck.rows.length > 0) {
      // Location already exists, just assign it to the barber
      const existingLocationId = duplicateCheck.rows[0].id;
      
      await pool.query(
        `INSERT INTO barber_service_locations (barber_id, location_id, is_primary)
         VALUES ($1, $2, false)
         ON CONFLICT (barber_id, location_id) DO NOTHING`,
        [barberId, existingLocationId]
      );
      
      return res.json({
        success: true,
        data: { id: existingLocationId, name: name.trim(), description },
        message: 'Location already exists and has been added to your profile',
      });
    }
    
    // Create new location
    const locationResult = await pool.query(
      `INSERT INTO service_locations (campus_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [campusId, name.trim(), description || null, userId]
    );
    
    const newLocation = locationResult.rows[0];
    
    // Assign to barber
    await pool.query(
      `INSERT INTO barber_service_locations (barber_id, location_id, is_primary)
       VALUES ($1, $2, false)`,
      [barberId, newLocation.id]
    );
    
    logger.info(`Location created by barber: ${name} for campus ${campusId} by user ${userId}`);
    
    res.status(201).json({
      success: true,
      data: newLocation,
    });
  } catch (error: any) {
    logger.error('Error creating barber location:', error.message || error);
    next(error);
  }
});

/**
 * PUT /api/v1/locations/:locationId
 * Update a location (Campus Manager / Admin only)
 */
router.put('/:locationId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { locationId } = req.params;
    const { name, description, isActive } = req.body;
    
    // Get the location to check campus
    const locationCheck = await pool.query(
      `SELECT campus_id FROM service_locations WHERE id = $1`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }
    
    const campusId = locationCheck.rows[0].campus_id;
    
    // Check if user is campus manager or admin
    const authCheck = await pool.query(
      `SELECT u.role, b."isCampusManager", b."campusId"
       FROM users u
       LEFT JOIN barbers b ON u.id = b."userId"
       WHERE u.id = $1`,
      [userId]
    );
    
    const user = authCheck.rows[0];
    const isAdmin = user?.role === 'ADMIN';
    const isCampusManager = user?.isCampusManager && user?.campusId === campusId;
    
    if (!isAdmin && !isCampusManager) {
      return res.status(403).json({
        success: false,
        error: 'Only campus managers and admins can update locations',
      });
    }
    
    const result = await pool.query(
      `UPDATE service_locations
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, description, isActive, locationId]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error updating location:', error.message || error);
    next(error);
  }
});

/**
 * DELETE /api/v1/locations/:locationId
 * Delete a location (Campus Manager / Admin only)
 */
router.delete('/:locationId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { locationId } = req.params;
    
    // Get the location to check campus
    const locationCheck = await pool.query(
      `SELECT campus_id, name FROM service_locations WHERE id = $1`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }
    
    const campusId = locationCheck.rows[0].campus_id;
    const locationName = locationCheck.rows[0].name;
    
    // Check if user is campus manager or admin
    const authCheck = await pool.query(
      `SELECT u.role, b."isCampusManager", b."campusId"
       FROM users u
       LEFT JOIN barbers b ON u.id = b."userId"
       WHERE u.id = $1`,
      [userId]
    );
    
    const user = authCheck.rows[0];
    const isAdmin = user?.role === 'ADMIN';
    const isCampusManager = user?.isCampusManager && user?.campusId === campusId;
    
    if (!isAdmin && !isCampusManager) {
      return res.status(403).json({
        success: false,
        error: 'Only campus managers and admins can delete locations',
      });
    }
    
    // Delete associated barber_service_locations first
    await pool.query(`DELETE FROM barber_service_locations WHERE location_id = $1`, [locationId]);
    
    // Delete the location
    await pool.query(`DELETE FROM service_locations WHERE id = $1`, [locationId]);
    
    logger.info(`Location deleted: ${locationName} (${locationId}) by user ${userId}`);
    
    res.json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting location:', error.message || error);
    next(error);
  }
});

// ============================================================================
// BARBER LOCATIONS
// ============================================================================

/**
 * GET /api/v1/locations/barber/:barberId
 * Get locations assigned to a barber
 */
router.get('/barber/:barberId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        bsl.id as assignment_id,
        bsl.is_primary,
        bsl.created_at as assigned_at,
        sl.id as location_id,
        sl.name,
        sl.description,
        sl.is_active
      FROM barber_service_locations bsl
      JOIN service_locations sl ON bsl.location_id = sl.id
      WHERE bsl.barber_id = $1 AND sl.is_active = true
      ORDER BY bsl.is_primary DESC, sl.name ASC`,
      [barberId]
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Error fetching barber locations:', error.message || error);
    next(error);
  }
});

/**
 * GET /api/v1/locations/my-locations
 * Get locations for the logged-in barber
 */
router.get('/my-locations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    
    // Get barber ID for this user
    const barberCheck = await pool.query(
      `SELECT id, "campusId" FROM barbers WHERE "userId" = $1`,
      [userId]
    );
    
    if (barberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Barber profile not found',
      });
    }
    
    const barberId = barberCheck.rows[0].id;
    const campusId = barberCheck.rows[0].campusId;
    
    // Get assigned locations
    const assignedResult = await pool.query(
      `SELECT 
        bsl.id as assignment_id,
        bsl.is_primary,
        sl.id as location_id,
        sl.name,
        sl.description
      FROM barber_service_locations bsl
      JOIN service_locations sl ON bsl.location_id = sl.id
      WHERE bsl.barber_id = $1 AND sl.is_active = true
      ORDER BY bsl.is_primary DESC, sl.name ASC`,
      [barberId]
    );
    
    // Get all available locations for this campus (for adding new ones)
    const availableResult = await pool.query(
      `SELECT id, name, description
       FROM service_locations
       WHERE campus_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [campusId]
    );
    
    res.json({
      success: true,
      data: {
        assigned: assignedResult.rows,
        available: availableResult.rows,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching my locations:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/locations/barber/assign
 * Assign a location to a barber
 */
router.post('/barber/assign', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { locationId, isPrimary } = req.body;
    
    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'Location ID is required',
      });
    }
    
    // Get barber ID for this user
    const barberCheck = await pool.query(
      `SELECT b.id, b."campusId" FROM barbers b WHERE b."userId" = $1`,
      [userId]
    );
    
    if (barberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Barber profile not found',
      });
    }
    
    const barberId = barberCheck.rows[0].id;
    const barberCampusId = barberCheck.rows[0].campusId;
    
    // Verify the location belongs to the barber's campus
    const locationCheck = await pool.query(
      `SELECT campus_id FROM service_locations WHERE id = $1 AND is_active = true`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found or inactive',
      });
    }
    
    if (locationCheck.rows[0].campus_id !== barberCampusId) {
      return res.status(400).json({
        success: false,
        error: 'This location is not available for your campus',
      });
    }
    
    // If setting as primary, unset other primary locations
    if (isPrimary) {
      await pool.query(
        `UPDATE barber_service_locations SET is_primary = false WHERE barber_id = $1`,
        [barberId]
      );
    }
    
    // Insert or update the assignment
    const result = await pool.query(
      `INSERT INTO barber_service_locations (barber_id, location_id, is_primary)
       VALUES ($1, $2, $3)
       ON CONFLICT (barber_id, location_id) 
       DO UPDATE SET is_primary = $3
       RETURNING *`,
      [barberId, locationId, isPrimary || false]
    );
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error assigning location:', error.message || error);
    next(error);
  }
});

/**
 * DELETE /api/v1/locations/barber/unassign/:locationId
 * Remove a location from a barber
 */
router.delete('/barber/unassign/:locationId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { locationId } = req.params;
    
    // Get barber ID for this user
    const barberCheck = await pool.query(
      `SELECT id FROM barbers WHERE "userId" = $1`,
      [userId]
    );
    
    if (barberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Barber profile not found',
      });
    }
    
    const barberId = barberCheck.rows[0].id;
    
    await pool.query(
      `DELETE FROM barber_service_locations WHERE barber_id = $1 AND location_id = $2`,
      [barberId, locationId]
    );
    
    res.json({
      success: true,
      message: 'Location removed from your profile',
    });
  } catch (error: any) {
    logger.error('Error unassigning location:', error.message || error);
    next(error);
  }
});

/**
 * GET /api/v1/locations/for-booking/:barberId
 * Get available locations for booking with a specific barber
 * (Used by consumers when scheduling a service)
 */
router.get('/for-booking/:barberId', async (req, res, next) => {
  try {
    const { barberId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        sl.id,
        sl.name,
        sl.description,
        bsl.is_primary
      FROM barber_service_locations bsl
      JOIN service_locations sl ON bsl.location_id = sl.id
      WHERE bsl.barber_id = $1 AND sl.is_active = true
      ORDER BY bsl.is_primary DESC, sl.name ASC`,
      [barberId]
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Error fetching locations for booking:', error.message || error);
    next(error);
  }
});

export default router;
