/**
 * Location Routes
 * 
 * API endpoints for managing campus locations and barber location assignments
 * 
 * Uses existing campus_locations table schema:
 * - university_id (not campus_id)
 * - is_verified (not is_active)
 * - created_by_user_id (not created_by)
 * - normalized_name, category, cohort, usage_count, confidence columns
 */

import { Router, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Helper to normalize location name
const normalizeLocationName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

// ============================================================================
// CAMPUS LOCATIONS (Campus Manager / Admin)
// ============================================================================

/**
 * GET /api/v1/locations/campus/:campusId
 * Get all locations for a campus
 */
router.get('/campus/:campusId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;
    const { activeOnly } = req.query;
    
    let whereClause = 'university_id = $1';
    if (activeOnly === 'true') {
      whereClause += ' AND is_verified = true';
    }
    
    const result = await pool.query(
      `SELECT 
        cl.id,
        cl.university_id as campus_id,
        cl.name,
        cl.normalized_name as description,
        cl.category as address,
        cl.is_verified as is_active,
        cl.created_at,
        cl.updated_at,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM barber_locations bl WHERE bl.location_id = cl.id) as barber_count
      FROM campus_locations cl
      LEFT JOIN users u ON cl.created_by_user_id = u.id
      WHERE ${whereClause}
      ORDER BY cl.name ASC`,
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
    const { name, description, address } = req.body;
    
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
    
    const normalizedName = normalizeLocationName(name);
    
    // Check for duplicate name
    const duplicateCheck = await pool.query(
      `SELECT id FROM campus_locations WHERE university_id = $1 AND normalized_name = $2`,
      [campusId, normalizedName]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'A location with this name already exists for this campus',
      });
    }
    
    const result = await pool.query(
      `INSERT INTO campus_locations (university_id, name, normalized_name, category, cohort, usage_count, confidence, is_verified, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'UNKNOWN', 1, 0.80, true, $5)
       RETURNING id, university_id as campus_id, name, normalized_name as description, category as address, is_verified as is_active, created_at, updated_at`,
      [campusId, name.trim(), normalizedName, address || 'OTHER', userId]
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
 * PUT /api/v1/locations/:locationId
 * Update a location (Campus Manager / Admin only)
 */
router.put('/:locationId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { locationId } = req.params;
    const { name, description, address, isActive } = req.body;
    
    // Get the location to check campus
    const locationCheck = await pool.query(
      `SELECT university_id FROM campus_locations WHERE id = $1`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }
    
    const campusId = locationCheck.rows[0].university_id;
    
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
    
    const normalizedName = name ? normalizeLocationName(name) : null;
    
    const result = await pool.query(
      `UPDATE campus_locations
       SET name = COALESCE($1, name),
           normalized_name = COALESCE($2, normalized_name),
           category = COALESCE($3, category),
           is_verified = COALESCE($4, is_verified),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, university_id as campus_id, name, normalized_name as description, category as address, is_verified as is_active, created_at, updated_at`,
      [name, normalizedName, address, isActive, locationId]
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
      `SELECT university_id, name FROM campus_locations WHERE id = $1`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }
    
    const campusId = locationCheck.rows[0].university_id;
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
    
    // Delete associated barber_locations first (cascade should handle this but being explicit)
    await pool.query(`DELETE FROM barber_locations WHERE location_id = $1`, [locationId]);
    
    // Delete the location
    await pool.query(`DELETE FROM campus_locations WHERE id = $1`, [locationId]);
    
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
        bl.id as assignment_id,
        bl.is_primary,
        bl.created_at as assigned_at,
        cl.id as location_id,
        cl.name,
        cl.normalized_name as description,
        cl.category as address,
        cl.is_verified as is_active
      FROM barber_locations bl
      JOIN campus_locations cl ON bl.location_id = cl.id
      WHERE bl.barber_id = $1 AND cl.is_verified = true
      ORDER BY bl.is_primary DESC, cl.name ASC`,
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
        bl.id as assignment_id,
        bl.is_primary,
        cl.id as location_id,
        cl.name,
        cl.normalized_name as description,
        cl.category as address
      FROM barber_locations bl
      JOIN campus_locations cl ON bl.location_id = cl.id
      WHERE bl.barber_id = $1 AND cl.is_verified = true
      ORDER BY bl.is_primary DESC, cl.name ASC`,
      [barberId]
    );
    
    // Get all available locations for this campus (for adding new ones)
    const availableResult = await pool.query(
      `SELECT id, name, normalized_name as description, category as address
       FROM campus_locations
       WHERE university_id = $1 AND is_verified = true
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
      `SELECT university_id FROM campus_locations WHERE id = $1 AND is_verified = true`,
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found or inactive',
      });
    }
    
    if (locationCheck.rows[0].university_id !== barberCampusId) {
      return res.status(400).json({
        success: false,
        error: 'This location is not available for your campus',
      });
    }
    
    // If setting as primary, unset other primary locations
    if (isPrimary) {
      await pool.query(
        `UPDATE barber_locations SET is_primary = false WHERE barber_id = $1`,
        [barberId]
      );
    }
    
    // Insert or update the assignment
    const result = await pool.query(
      `INSERT INTO barber_locations (barber_id, location_id, is_primary)
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
      `DELETE FROM barber_locations WHERE barber_id = $1 AND location_id = $2`,
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
        cl.id,
        cl.name,
        cl.normalized_name as description,
        cl.category as address,
        bl.is_primary
      FROM barber_locations bl
      JOIN campus_locations cl ON bl.location_id = cl.id
      WHERE bl.barber_id = $1 AND cl.is_verified = true
      ORDER BY bl.is_primary DESC, cl.name ASC`,
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
