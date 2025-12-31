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
import notificationService from '../services/notification.service';

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
    // NOTE: The original service name is preserved in conversations.service_name for display
    // This mapping is for database storage - the display will show the original name
    // 
    // Frontend services (from web-app/src/config/services.ts):
    //   'Buzz Cut', 'Line Up', 'Beard Trim', 'Haircut', 'Taper', 'Hot Shave',
    //   'Kids Cut', 'Fade', 'Haircut & Fade', 'Design/Art', 'Afro Textures',
    //   "Women's Cut", 'Color Treatment', 'Perm'
    //
    // Database enum: HAIRCUT, FADE, BEARD_TRIM, FULL_SERVICE, HOT_TOWEL_SHAVE, 
    //   COLOR, STYLING, LINEUP, BUZZ_CUT, SHAPE_UP, PERM, BRAIDS, LOCS, TAPER
    const serviceTypeMap: Record<string, string> = {
      // Exact matches from frontend config
      'Buzz Cut': 'BUZZ_CUT',
      'Line Up': 'LINEUP',
      'Beard Trim': 'BEARD_TRIM',
      'Haircut': 'HAIRCUT',
      'Taper': 'TAPER',
      'Hot Shave': 'HOT_TOWEL_SHAVE',
      'Kids Cut': 'HAIRCUT',           // Maps to HAIRCUT (no KIDS_CUT enum)
      'Fade': 'FADE',
      'Haircut & Fade': 'FADE',        // Maps to FADE (combo service)
      'Design/Art': 'STYLING',         // Maps to STYLING
      'Afro Textures': 'STYLING',      // Maps to STYLING
      "Women's Cut": 'HAIRCUT',        // Maps to HAIRCUT
      'Color Treatment': 'COLOR',
      'Perm': 'PERM',
      
      // Legacy/alternative names for backwards compatibility
      'Lineup': 'LINEUP',
      'Shape Up': 'SHAPE_UP',
      'Full Service': 'FULL_SERVICE',
      'Hot Towel Shave': 'HOT_TOWEL_SHAVE',
      'Color': 'COLOR',
      'Styling': 'STYLING',
      'Braids': 'BRAIDS',
      'Locs': 'LOCS',
    };
    
    // Convert to enum value or fallback to HAIRCUT as default
    const dbServiceType = serviceTypeMap[serviceType] || 'HAIRCUT';
    
    // Store the original display name for later retrieval (passed to conversation)
    const originalServiceName = serviceType;

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

    // Get consumer name and barber user ID for notification
    const consumerResult = await pool.query(
      `SELECT first_name || ' ' || last_name as name FROM users WHERE id = $1`,
      [consumerId]
    );
    const consumerName = consumerResult.rows[0]?.name || 'A customer';
    
    const barberUserResult = await pool.query(
      `SELECT "userId" FROM barbers WHERE id = $1`,
      [barberRecordId]
    );
    const barberUserId = barberUserResult.rows[0]?.userId;
    
    // Send notification to barber about new booking request
    if (barberUserId) {
      await notificationService.saveNotification({
        userId: barberUserId,
        type: 'new_booking_request',
        title: 'New Booking Request! 📅',
        message: `${consumerName} wants to book a ${serviceType} with you`,
        data: { bookingId: booking.id, consumerId, serviceType },
      });
      logger.info(`Notification sent to barber ${barberUserId} for new booking ${booking.id}`);
    }

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

/**
 * PUT /api/v1/bookings-simple/:id/complete
 * Mark a booking as complete - triggers payment request to consumer
 * Only the barber can mark a booking as complete
 */
router.put('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Verify user is the barber for this booking
    const barberCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."priceUsdCents", b."serviceType",
              barber."userId" as barber_user_id,
              consumer.first_name || ' ' || consumer.last_name as consumer_name,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name,
              c.service_name as original_service_name
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users consumer ON b."consumerId" = consumer.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       WHERE b.id = $1 AND barber."userId" = $2`,
      [id, userId]
    );

    if (barberCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the barber can mark this booking as complete' 
      });
    }

    const booking = barberCheck.rows[0];

    // Update booking status to COMPLETED
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'COMPLETED', 
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, status`,
      [id]
    );

    // Also update linked conversation's booking_status
    await pool.query(
      `UPDATE conversations 
       SET booking_status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [id]
    );

    const serviceName = booking.original_service_name || booking.serviceType;
    const priceFormatted = `$${(booking.priceUsdCents / 100).toFixed(2)}`;

    // Send payment request notification to consumer
    await notificationService.saveNotification({
      userId: booking.consumerId,
      type: 'payment_request',
      title: 'Payment Request',
      message: `${booking.barber_name} has completed your ${serviceName}. Please complete payment of ${priceFormatted}.`,
      data: { 
        bookingId: id,
        amount: booking.priceUsdCents,
        barberName: booking.barber_name,
        serviceName,
      },
    });

    logger.info(`Booking ${id} marked as COMPLETED by barber ${userId}. Payment request sent to consumer ${booking.consumerId}`);

    res.json({
      success: true,
      data: { booking: result.rows[0] },
      message: 'Booking marked as complete. Payment request sent to customer.',
    });
  } catch (error: any) {
    logger.error('Error completing booking:', error.message || error);
    next(error);
  }
});

/**
 * GET /api/v1/bookings-simple
 * Get bookings for the authenticated user (barber or consumer)
 * Query params:
 *   - status: filter by status (PENDING, ACCEPTED, COMPLETED, etc.)
 *   - startDate: filter from this date
 *   - endDate: filter until this date
 *   - role: 'barber' or 'consumer' to specify which side of the booking
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { status, startDate, endDate, role } = req.query;

    // Build query based on role
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Determine if user is a barber
    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1',
      [userId]
    );
    const isBarber = barberCheck.rows.length > 0;
    const barberRecordId = isBarber ? barberCheck.rows[0].id : null;

    // Build the where clause based on role
    if (role === 'barber' && barberRecordId) {
      whereClause = `b."barberId" = $${paramIndex}`;
      params.push(barberRecordId);
      paramIndex++;
    } else if (role === 'consumer') {
      whereClause = `b."consumerId" = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else {
      // Default: show both consumer and barber bookings
      if (barberRecordId) {
        whereClause = `(b."barberId" = $${paramIndex} OR b."consumerId" = $${paramIndex + 1})`;
        params.push(barberRecordId, userId);
        paramIndex += 2;
      } else {
        whereClause = `b."consumerId" = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }
    }

    // Filter by status (case-insensitive using UPPER)
    if (status) {
      whereClause += ` AND UPPER(b.status::text) = UPPER($${paramIndex})`;
      params.push(status);
      paramIndex++;
    }

    // Filter by date range
    if (startDate) {
      whereClause += ` AND b."requestedAt" >= $${paramIndex}`;
      params.push(new Date(startDate as string));
      paramIndex++;
    }
    if (endDate) {
      whereClause += ` AND b."requestedAt" <= $${paramIndex}`;
      params.push(new Date(endDate as string));
      paramIndex++;
    }

    logger.info('Fetching bookings', { 
      userId, 
      role, 
      status, 
      barberRecordId, 
      whereClause,
      params 
    });

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
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer."avatarUrl" as consumer_avatar,
        barber_user.first_name as barber_first_name,
        barber_user.last_name as barber_last_name,
        barber_user."avatarUrl" as barber_avatar,
        -- Pull additional data from linked conversation
        c.location as conv_location,
        c.notes as conv_notes,
        c.service_name as conv_service_name
      FROM bookings b
      LEFT JOIN users consumer ON b."consumerId" = consumer.id
      LEFT JOIN barbers barber ON b."barberId" = barber.id
      LEFT JOIN users barber_user ON barber."userId" = barber_user.id
      LEFT JOIN conversations c ON c.booking_id = b.id
      WHERE ${whereClause}
      ORDER BY b."requestedAt" ASC`,
      params
    );

    logger.info('Bookings fetched', { count: result.rows.length });

    // Helper to format service type: "HAIRCUT" -> "Haircut", "BEARD_TRIM" -> "Beard Trim"
    const formatServiceType = (type: string) => {
      if (!type) return 'Haircut';
      return type
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    };

    res.json({
      success: true,
      data: {
        bookings: result.rows.map(row => ({
          id: row.id,
          consumerId: row.consumerId,
          barberId: row.barberId,
          // Prefer original service name from conversation, fallback to formatted enum
          serviceType: row.conv_service_name || formatServiceType(row.serviceType),
          priceUsdCents: row.priceUsdCents,
          scheduledTime: row.scheduledTime,
          status: row.status,
          createdAt: row.createdAt,
          // Consumer-provided input data from conversation
          location: row.conv_location || null,
          notes: row.conv_notes || null,
          serviceName: row.conv_service_name || null,
          consumer: {
            firstName: row.consumer_first_name,
            lastName: row.consumer_last_name,
            avatar: row.consumer_avatar,
          },
          barber: {
            firstName: row.barber_first_name,
            lastName: row.barber_last_name,
            avatar: row.barber_avatar,
          },
        })),
      },
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching bookings:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/pay
 * Process payment for a completed booking
 * Only the consumer can pay for their booking
 */
router.post('/:id/pay', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipAmountCents = 0 } = req.body;
    const userId = (req as any).user.userId;

    // Verify user is the consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       WHERE b.id = $1 AND b."consumerId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Booking not found or access denied' 
      });
    }

    const booking = bookingCheck.rows[0];

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Can only pay for completed bookings'
      });
    }

    const totalAmountCents = booking.priceUsdCents + tipAmountCents;

    // Update booking with payment info
    await pool.query(
      `UPDATE bookings 
       SET "tipAmountCents" = $1,
           "totalPaidCents" = $2,
           "paidAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [tipAmountCents, totalAmountCents, id]
    );

    // Notify barber of payment received
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'payment_received',
      title: 'Payment Received! 💰',
      message: `You received $${(totalAmountCents / 100).toFixed(2)}${tipAmountCents > 0 ? ` (includes $${(tipAmountCents / 100).toFixed(2)} tip)` : ''}`,
      data: { bookingId: id, amount: totalAmountCents, tip: tipAmountCents },
    });

    logger.info(`Payment processed for booking ${id}: $${(totalAmountCents / 100).toFixed(2)} (tip: $${(tipAmountCents / 100).toFixed(2)})`);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        bookingId: id,
        amountPaid: totalAmountCents,
        tipAmount: tipAmountCents,
      },
    });
  } catch (error: any) {
    logger.error('Error processing payment:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/review
 * Submit a review for a completed booking
 * Only the consumer can review their booking
 */
router.post('/:id/review', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = (req as any).user.userId;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    // Verify user is the consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b.status,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name,
              consumer.first_name || ' ' || consumer.last_name as consumer_name
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       JOIN users consumer ON b."consumerId" = consumer.id
       WHERE b.id = $1 AND b."consumerId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Booking not found or access denied' 
      });
    }

    const booking = bookingCheck.rows[0];

    // Store review in bookings table (simple approach)
    await pool.query(
      `UPDATE bookings 
       SET "reviewRating" = $1,
           "reviewComment" = $2,
           "reviewedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [rating, comment || null, id]
    );

    // Update barber's average rating
    const ratingResult = await pool.query(
      `SELECT AVG("reviewRating")::numeric(3,2) as avg_rating, COUNT(*) as review_count
       FROM bookings 
       WHERE "barberId" = $1 AND "reviewRating" IS NOT NULL`,
      [booking.barberId]
    );

    if (ratingResult.rows.length > 0) {
      await pool.query(
        `UPDATE barbers 
         SET "averageRating" = $1, "totalReviews" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [ratingResult.rows[0].avg_rating, ratingResult.rows[0].review_count, booking.barberId]
      );
    }

    // Notify barber of new review
    const starEmoji = rating >= 4 ? '⭐' : rating >= 3 ? '👍' : '📝';
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'new_review',
      title: `New ${rating}-Star Review ${starEmoji}`,
      message: `${booking.consumer_name} left you a ${rating}-star review${comment ? `: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"` : ''}`,
      data: { bookingId: id, rating, comment },
    });

    logger.info(`Review submitted for booking ${id}: ${rating} stars`);

    res.json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        bookingId: id,
        rating,
        comment,
      },
    });
  } catch (error: any) {
    logger.error('Error submitting review:', error.message || error);
    next(error);
  }
});

export default router;

