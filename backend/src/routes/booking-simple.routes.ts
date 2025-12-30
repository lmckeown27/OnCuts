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

    // Get barber record ID from barbers table (bookings.barberId references barbers.id, not users.id)
    const barberResult = await pool.query(
      'SELECT id FROM barbers WHERE id = $1 OR "userId" = $1',
      [barberId]
    );
    
    if (barberResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Barber not found' });
    }
    
    const barberRecordId = barberResult.rows[0].id;

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

    // Create booking record (all NOT NULL columns in production)
    // Platform fee is 5% of price, barber gets 95%
    const price = priceUsdCents || 0;
    const platformFee = Math.round(price * 0.05);
    const barberEarnings = price - platformFee;
    const requestedTime = scheduledTime ? new Date(scheduledTime) : new Date();
    
    // Get or create location (requires campus -> location chain)
    let locationId: string;
    
    // First check for existing location
    let locationResult = await pool.query('SELECT id FROM locations LIMIT 1');
    
    if (locationResult.rows.length > 0) {
      locationId = locationResult.rows[0].id;
    } else {
      // Need to create campus first, then location
      let campusResult = await pool.query('SELECT id FROM campuses LIMIT 1');
      let campusId: string;
      
      if (campusResult.rows.length > 0) {
        campusId = campusResult.rows[0].id;
      } else {
        // Create a default campus
        const newCampusResult = await pool.query(
          `INSERT INTO campuses (id, name, "shortCode", city, state, latitude, longitude, "isActive", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), 'Default Campus', 'DEFAULT', 'San Luis Obispo', 'CA', 35.3050, -120.6625, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`
        );
        campusId = newCampusResult.rows[0].id;
      }
      
      // Create location with campus
      const newLocationResult = await pool.query(
        `INSERT INTO locations (id, "campusId", name, "normalizedName", type, cohort, "usageCount", confidence, "isVerified", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'Default Location', 'default-location', 'DORM'::"LocationType", 'UNKNOWN'::"LocationCohort", 1, 0.50, false, CURRENT_TIMESTAMP)
         RETURNING id`,
        [campusId]
      );
      locationId = newLocationResult.rows[0].id;
    }
    
    // Create availability slot for this booking (availabilityId is a required FK)
    const availabilityResult = await pool.query(
      `INSERT INTO availability (
        id,
        "barberId",
        "locationId",
        "startTime",
        "endTime",
        "priceUsdCents",
        "serviceTypes",
        status,
        "updatedAt"
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, ARRAY[$6::"ServiceType"], 'BOOKED', CURRENT_TIMESTAMP)
      RETURNING id`,
      [
        barberRecordId,
        locationId,
        requestedTime,
        new Date(requestedTime.getTime() + 30 * 60 * 1000), // 30 min later
        price,
        dbServiceType,
      ]
    );
    
    const availabilityId = availabilityResult.rows[0].id;
    
    // Now create the booking with the availability ID
    const result = await pool.query(
      `INSERT INTO bookings (
        id,
        "consumerId", 
        "barberId", 
        "serviceType", 
        "priceUsdCents",
        "platformFeeUsdCents",
        "barberEarningsUsdCents",
        "requestedAt",
        "availabilityId",
        "updatedAt",
        status
      ) VALUES (gen_random_uuid(), $1, $2, $3::"ServiceType", $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 'PENDING')
      RETURNING id, "consumerId", "barberId", "serviceType", "priceUsdCents", "requestedAt", status, "createdAt"`,
      [
        consumerId,
        barberRecordId,
        dbServiceType,
        price,
        platformFee,
        barberEarnings,
        requestedTime,
        availabilityId,
      ]
    );

    const booking = result.rows[0];

    logger.info('Simple booking created', {
      booking_id: booking.id,
      consumer_id: consumerId,
      barber_id: barberRecordId,
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

