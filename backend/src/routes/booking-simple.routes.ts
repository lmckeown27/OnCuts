/**
 * Simple Booking Routes
 * 
 * Creates booking records that match the production database schema.
 * Used by the consumer booking flow.
 */

import express from 'express';
import { pool } from '../database/connection';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/v1/bookings-simple
 * Create a simple booking record
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const consumerId = (req as any).user.userId;
    const {
      barberId,
      serviceType,
      priceUsdCents,
      scheduledTime,
      location,
      locationDetails,
      notes,
    } = req.body;

    // Validate required fields
    if (!barberId) {
      return res.status(400).json({ success: false, error: 'barberId is required' });
    }
    if (!serviceType) {
      return res.status(400).json({ success: false, error: 'serviceType is required' });
    }

    // Get barber's user ID from barbers table
    const barberResult = await pool.query(
      'SELECT "userId" FROM barbers WHERE id = $1 OR "userId" = $1',
      [barberId]
    );
    
    const barberUserId = barberResult.rows.length > 0 
      ? barberResult.rows[0].userId 
      : barberId;

    // Map frontend service names to database enum values
    // Valid enum: HAIRCUT, FADE, BEARD_TRIM, FULL_SERVICE, HOT_TOWEL_SHAVE, COLOR, STYLING, LINEUP, BUZZ_CUT, SHAPE_UP, PERM, BRAIDS, LOCS
    const serviceTypeMap: Record<string, string> = {
      'Haircut': 'HAIRCUT',
      'Taper': 'FADE',        // Taper maps to FADE
      'Fade': 'FADE',
      'Buzz Cut': 'BUZZ_CUT',
      'Beard Trim': 'BEARD_TRIM',
      'Lineup': 'LINEUP',
      'Line Up': 'LINEUP',
      'Shape Up': 'SHAPE_UP',
      'Full Service': 'FULL_SERVICE',
      'Hot Towel Shave': 'HOT_TOWEL_SHAVE',
      'Color': 'COLOR',
      'Styling': 'STYLING',
      'Perm': 'PERM',
      'Braids': 'BRAIDS',
      'Locs': 'LOCS',
    };
    
    // Convert to enum value or fallback to HAIRCUT as default
    const dbServiceType = serviceTypeMap[serviceType] || 'HAIRCUT';

    // Create booking record (minimal columns that exist in production)
    const result = await pool.query(
      `INSERT INTO bookings (
        "consumerId", 
        "barberId", 
        "serviceType", 
        "priceUsdCents", 
        "requestedAt",
        status
      ) VALUES ($1, $2, $3::"ServiceType", $4, $5, 'PENDING')
      RETURNING id, "consumerId", "barberId", "serviceType", "priceUsdCents", "requestedAt", status, "createdAt"`,
      [
        consumerId,
        barberUserId,
        dbServiceType,
        priceUsdCents || 0,
        scheduledTime ? new Date(scheduledTime) : new Date(),
      ]
    );

    const booking = result.rows[0];

    logger.info('Simple booking created', {
      booking_id: booking.id,
      consumer_id: consumerId,
      barber_id: barberUserId,
      service_type: serviceType,
    });

    res.status(201).json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          consumerId: booking.consumerId,
          barberId: booking.barberId,
          serviceType: booking.serviceType,
          priceUsdCents: booking.priceUsdCents,
          scheduledTime: booking.requestedAt,
          status: booking.status,
          createdAt: booking.createdAt,
        },
      },
      message: 'Booking created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating simple booking:', error.message || error);
    next(error);
  }
});

/**
 * GET /api/v1/bookings-simple/:id
 * Get booking by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `SELECT 
        b.id,
        b."consumerId",
        b."barberId",
        b."serviceType",
        b."priceUsdCents",
        b."requestedAt" as "scheduledTime",
        b.status,
        b."createdAt",
        u.first_name || ' ' || u.last_name as barber_name,
        u."avatarUrl" as barber_profile_picture,
        c.first_name || ' ' || c.last_name as consumer_name
      FROM bookings b
      LEFT JOIN users u ON b."barberId" = u.id
      LEFT JOIN users c ON b."consumerId" = c.id
      WHERE b.id = $1 AND (b."consumerId" = $2 OR b."barberId" = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.json({
      success: true,
      data: { booking: result.rows[0] },
    });
  } catch (error: any) {
    logger.error('Error getting booking:', error.message || error);
    next(error);
  }
});

/**
 * PUT /api/v1/bookings-simple/:id/status
 * Update booking status (accept/reject/complete/cancel)
 */
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.userId;

    const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const result = await pool.query(
      `UPDATE bookings 
       SET status = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND ("consumerId" = $3 OR "barberId" = $3)
       RETURNING id, status`,
      [status, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found or access denied' });
    }

    res.json({
      success: true,
      data: { booking: result.rows[0] },
      message: `Booking status updated to ${status}`,
    });
  } catch (error: any) {
    logger.error('Error updating booking status:', error.message || error);
    next(error);
  }
});

export default router;

