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
import { sendPendingBookingEmails, sendBookingEditEmails } from '../services/email.service';

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
        title: 'New Booking Request!',
        message: `${consumerName} wants to book a ${serviceType} with you`,
        data: { bookingId: booking.id, consumerId, serviceType },
      });
      logger.info(`Notification sent to barber ${barberUserId} for new booking ${booking.id}`);
    }

    // Send pending booking emails to both consumer and barber
    try {
      // Get consumer and barber emails
      const emailDetailsResult = await pool.query(
        `SELECT 
          u_consumer.email as consumer_email,
          u_consumer.first_name || ' ' || u_consumer.last_name as consumer_full_name,
          u_barber.email as barber_email,
          u_barber.first_name || ' ' || u_barber.last_name as barber_full_name
         FROM users u_consumer, users u_barber
         WHERE u_consumer.id = $1 AND u_barber.id = $2`,
        [consumerId, barberUserId]
      );
      
      if (emailDetailsResult.rows.length > 0) {
        const emailDetails = emailDetailsResult.rows[0];
        const scheduledDate = new Date(requestedTime);
        
        // Send pending booking emails (non-blocking)
        sendPendingBookingEmails({
          consumerEmail: emailDetails.consumer_email,
          consumerName: emailDetails.consumer_full_name,
          barberEmail: emailDetails.barber_email,
          barberName: emailDetails.barber_full_name,
          serviceName: serviceType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
          scheduledDate: scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          scheduledTime: scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          price: price / 100, // Convert cents to dollars
          location: location || undefined,
          notes: notes || undefined,
          bookingId: booking.id,
        }).catch(err => logger.error('Failed to send pending booking emails:', err));
      }
    } catch (emailError) {
      logger.error('Error preparing pending booking emails:', emailError);
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
        b."paidAt",
        b."tipAmountCents",
        b."totalPaidCents",
        conv.service_name,
        conv.location,
        conv.notes,
        barber_record.id as barber_record_id,
        barber_user.id as barber_user_id,
        barber_user.first_name as barber_first_name,
        barber_user.last_name as barber_last_name,
        barber_user."avatarUrl" as barber_profile_url,
        consumer.id as consumer_user_id,
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer."avatarUrl" as consumer_profile_url
      FROM bookings b
      LEFT JOIN conversations conv ON conv.booking_id = b.id
      LEFT JOIN barbers barber_record ON b."barberId" = barber_record.id
      LEFT JOIN users barber_user ON barber_record."userId" = barber_user.id
      LEFT JOIN users consumer ON b."consumerId" = consumer.id
      WHERE b.id = $1 AND (b."consumerId" = $2 OR barber_user.id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const row = result.rows[0];
    
    // Format response with nested barber/consumer objects
    const booking = {
      id: row.id,
      consumerId: row.consumerId,
      barberId: row.barberId,
      serviceType: row.serviceType,
      serviceName: row.service_name || row.serviceType,
      priceUsdCents: row.priceUsdCents,
      scheduledTime: row.scheduledTime,
      status: row.status,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      tipAmountCents: row.tipAmountCents,
      totalPaidCents: row.totalPaidCents,
      location: row.location,
      notes: row.notes,
      barber: {
        id: row.barber_user_id,
        recordId: row.barber_record_id,
        firstName: row.barber_first_name,
        lastName: row.barber_last_name,
        profileImageUrl: row.barber_profile_url,
      },
      consumer: {
        id: row.consumer_user_id,
        firstName: row.consumer_first_name,
        lastName: row.consumer_last_name,
        profileImageUrl: row.consumer_profile_url,
      },
    };

    res.json({
      success: true,
      booking,
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

    // If status is CANCELLED or REJECTED, delete the conversation and messages
    if (status === 'CANCELLED' || status === 'REJECTED') {
      const convResult = await pool.query(
        `SELECT id FROM conversations WHERE booking_id = $1`,
        [id]
      );
      
      if (convResult.rows.length > 0) {
        const conversationId = convResult.rows[0].id;
        await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
        await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
        logger.info(`Deleted conversation ${conversationId} and messages for ${status} booking ${id}`);
      }
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

    // Filter by status (supports comma-separated values like "PENDING,ACCEPTED")
    if (status) {
      const statusValues = (status as string).split(',').map(s => s.trim().toUpperCase());
      if (statusValues.length === 1) {
        whereClause += ` AND UPPER(b.status::text) = $${paramIndex}`;
        params.push(statusValues[0]);
        paramIndex++;
      } else {
        // Build IN clause for multiple statuses
        const placeholders = statusValues.map((_, i) => `$${paramIndex + i}`).join(', ');
        whereClause += ` AND UPPER(b.status::text) IN (${placeholders})`;
        statusValues.forEach(sv => params.push(sv));
        paramIndex += statusValues.length;
      }
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
          // Full barber name for display
          barberName: `${row.barber_first_name || ''} ${row.barber_last_name || ''}`.trim() || 'Barber',
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
 * POST /api/v1/bookings-simple/:id/create-payment-intent
 * Create a Stripe payment intent for the booking
 * Only the consumer can initiate payment
 */
router.post('/:id/create-payment-intent', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipAmountCents = 0 } = req.body;
    const userId = (req as any).user.userId;

    // Verify user is the consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status,
              c.service_name,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name
       FROM bookings b
       LEFT JOIN conversations c ON c.booking_id = b.id
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

    if (booking.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: 'Can only pay for accepted bookings'
      });
    }

    const totalAmountCents = booking.priceUsdCents + tipAmountCents;

    // Import Stripe
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        booking_id: id,
        consumer_id: userId,
        barber_id: booking.barberId,
        service_name: booking.service_name || 'Haircut',
        tip_amount_cents: tipAmountCents.toString(),
        platform: 'CampusCuts',
      },
      description: `CampusCuts - ${booking.service_name || 'Haircut'} with ${booking.barber_name}`,
    });

    logger.info(`Payment intent created for booking ${id}: ${paymentIntent.id}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    logger.error('Error creating payment intent:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/confirm-payment
 * Confirm payment was successful and mark booking as completed
 * Only the consumer can confirm their payment
 */
router.post('/:id/confirm-payment', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentIntentId, tipAmountCents = 0 } = req.body;
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
    const totalAmountCents = booking.priceUsdCents + tipAmountCents;

    // Verify payment intent with Stripe
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment has not been completed'
      });
    }

    // Update booking with payment info and mark as completed
    await pool.query(
      `UPDATE bookings 
       SET status = 'COMPLETED',
           "completedAt" = CURRENT_TIMESTAMP,
           "tipAmountCents" = $1,
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
      title: 'Payment Received!',
      message: `You received $${(totalAmountCents / 100).toFixed(2)}${tipAmountCents > 0 ? ` (includes $${(tipAmountCents / 100).toFixed(2)} tip)` : ''}`,
      data: { bookingId: id, amount: totalAmountCents, tip: tipAmountCents },
    });

    logger.info(`Payment confirmed for booking ${id}: $${(totalAmountCents / 100).toFixed(2)} (tip: $${(tipAmountCents / 100).toFixed(2)})`);

    res.json({
      success: true,
      message: 'Payment confirmed and booking completed',
      data: {
        bookingId: id,
        amountPaid: totalAmountCents,
        tipAmount: tipAmountCents,
      },
    });
  } catch (error: any) {
    logger.error('Error confirming payment:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/pay
 * Process payment for a completed booking (legacy/mock endpoint)
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
      title: 'Payment Received!',
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
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'new_review',
      title: `New ${rating}-Star Review`,
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

/**
 * PUT /api/v1/bookings-simple/:id
 * Edit booking details (barber only for ACCEPTED bookings)
 * - scheduledTime updates the bookings table ("requestedAt" column)
 * - location and notes update the linked conversations table
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { scheduledTime, location, notes } = req.body;

    // Check if user is barber or consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."barberId", b."requestedAt", b."serviceType",
              bar."userId" as barber_user_id,
              u_consumer.first_name as consumer_first_name, u_consumer.last_name as consumer_last_name,
              u_consumer.email as consumer_email,
              u_barber.first_name as barber_first_name, u_barber.last_name as barber_last_name,
              u_barber.email as barber_email,
              c.id as conversation_id, c.location as conv_location, c.notes as conv_notes, c.service_name
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       JOIN users u_consumer ON b."consumerId" = u_consumer.id
       JOIN users u_barber ON bar."userId" = u_barber.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       WHERE b.id = $1 AND (bar."userId" = $2 OR b."consumerId" = $2)`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    const isBarber = booking.barber_user_id === userId;
    const isConsumer = booking.consumerId === userId;

    // Only allow editing ACCEPTED bookings
    if (booking.status !== 'ACCEPTED') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot edit a ${booking.status.toLowerCase()} booking` 
      });
    }

    let updatedScheduledTime = booking.requestedAt;
    let updatedLocation = booking.conv_location;
    let updatedNotes = booking.conv_notes;

    // Update scheduledTime on bookings table
    if (scheduledTime !== undefined) {
      await pool.query(
        `UPDATE bookings 
         SET "requestedAt" = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [scheduledTime, id]
      );
      updatedScheduledTime = scheduledTime;
      logger.info(`Updated booking ${id} scheduledTime to ${scheduledTime}`);
    }

    // Update location and/or notes on conversations table (if linked)
    if (location !== undefined || notes !== undefined) {
      if (booking.conversation_id) {
        const convUpdates: string[] = [];
        const convValues: any[] = [];
        let convParamIndex = 1;

        if (location !== undefined) {
          convUpdates.push(`location = $${convParamIndex++}`);
          convValues.push(location);
          updatedLocation = location;
        }
        if (notes !== undefined) {
          convUpdates.push(`notes = $${convParamIndex++}`);
          convValues.push(notes);
          updatedNotes = notes;
        }

        if (convUpdates.length > 0) {
          convUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
          convValues.push(booking.conversation_id);

          await pool.query(
            `UPDATE conversations 
             SET ${convUpdates.join(', ')}
             WHERE id = $${convParamIndex}`,
            convValues
          );
          logger.info(`Updated conversation ${booking.conversation_id} location/notes`);
        }
      } else {
        // No linked conversation - try to find or create one
        logger.warn(`Booking ${id} has no linked conversation, attempting to find by participants`);
        
        // Try to find existing conversation between barber and consumer
        const convSearch = await pool.query(
          `SELECT id FROM conversations 
           WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
           LIMIT 1`,
          [userId, booking.consumerId]
        );

        if (convSearch.rows.length > 0) {
          const convId = convSearch.rows[0].id;
          
          // Link conversation to booking and update fields
          const convUpdates: string[] = [`booking_id = '${id}'`];
          const convValues: any[] = [];
          let convParamIndex = 1;

          if (location !== undefined) {
            convUpdates.push(`location = $${convParamIndex++}`);
            convValues.push(location);
            updatedLocation = location;
          }
          if (notes !== undefined) {
            convUpdates.push(`notes = $${convParamIndex++}`);
            convValues.push(notes);
            updatedNotes = notes;
          }

          convUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
          convValues.push(convId);

          await pool.query(
            `UPDATE conversations 
             SET ${convUpdates.join(', ')}
             WHERE id = $${convParamIndex}`,
            convValues
          );
          logger.info(`Linked and updated conversation ${convId} for booking ${id}`);
        } else {
          logger.warn(`No conversation found for booking ${id} - location/notes not saved`);
          // Still update the response values so frontend shows what user entered
          if (location !== undefined) updatedLocation = location;
          if (notes !== undefined) updatedNotes = notes;
        }
      }
    }

    // If scheduledTime was changed, notify the OTHER party and send emails
    if (scheduledTime) {
      const barberName = `${booking.barber_first_name} ${booking.barber_last_name}`.trim() || 'Your barber';
      const consumerName = `${booking.consumer_first_name} ${booking.consumer_last_name}`.trim() || 'Customer';
      const barberEmail = booking.barber_email;
      const consumerEmail = booking.consumer_email;

      const newDate = new Date(scheduledTime);
      const formattedDate = newDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric' 
      });
      const formattedTime = newDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit' 
      });

      // Get the original scheduled time for comparison in notification data
      const originalScheduledTime = booking.original_scheduled_time || booking.requestedAt;
      const originalDate = new Date(originalScheduledTime);
      const originalFormattedDate = originalDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric' 
      });
      const originalFormattedTime = originalDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit' 
      });

      // Notify the OTHER party (not the one who made the edit)
      if (isBarber) {
        // Barber edited, notify consumer
        await notificationService.saveNotification({
          userId: booking.consumerId,
          type: 'booking_updated',
          title: 'Booking Updated',
          message: `${barberName} has rescheduled your appointment to ${formattedDate} at ${formattedTime}`,
          data: { 
            bookingId: id, 
            newScheduledTime: scheduledTime,
            originalScheduledTime: originalScheduledTime,
            editedBy: 'barber',
          },
        });
      } else {
        // Consumer edited, notify barber
        await notificationService.saveNotification({
          userId: booking.barber_user_id,
          type: 'booking_updated',
          title: 'Booking Updated',
          message: `${consumerName} has rescheduled their appointment to ${formattedDate} at ${formattedTime}`,
          data: { 
            bookingId: id, 
            newScheduledTime: scheduledTime,
            originalScheduledTime: originalScheduledTime,
            editedBy: 'consumer',
          },
        });
      }

      // Get service details for email
      const serviceName = booking.service_name || booking.serviceType || 'Haircut';
      const priceResult = await pool.query(
        `SELECT "priceUsdCents" FROM bookings WHERE id = $1`,
        [id]
      );
      const priceUsdCents = priceResult.rows[0]?.priceUsdCents || 0;
      const bookingLocation = booking.conv_location;

      if (consumerEmail && barberEmail) {
        sendBookingEditEmails({
          consumerEmail,
          consumerName,
          barberEmail,
          barberName,
          serviceName,
          originalScheduledDate: originalFormattedDate,
          originalScheduledTime: originalFormattedTime,
          newScheduledDate: formattedDate,
          newScheduledTime: formattedTime,
          location: bookingLocation || undefined,
          price: priceUsdCents / 100,
          bookingId: id,
        }).catch(err => logger.error('Failed to send booking edit emails:', err));
      }
    }

    logger.info(`Booking ${id} updated by ${isBarber ? 'barber' : 'consumer'} ${userId}`);

    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: { 
        booking: {
          id,
          scheduledTime: updatedScheduledTime,
          location: updatedLocation,
          notes: updatedNotes,
          status: booking.status,
        }
      },
    });
  } catch (error: any) {
    logger.error('Error updating booking:', error.message || error);
    next(error);
  }
});

/**
 * DELETE /api/v1/bookings-simple/:id
 * Cancel/delete a booking (barber or consumer for non-completed bookings)
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { reason } = req.body;

    // Check if user is barber or consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."serviceType",
              bar."userId" as barber_user_id,
              u_consumer.first_name as consumer_first_name, u_consumer.last_name as consumer_last_name,
              u_barber.first_name as barber_first_name, u_barber.last_name as barber_last_name,
              c.service_name as original_service_name
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       JOIN users u_consumer ON b."consumerId" = u_consumer.id
       JOIN users u_barber ON bar."userId" = u_barber.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       WHERE b.id = $1 AND (bar."userId" = $2 OR b."consumerId" = $2)`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    const isBarber = booking.barber_user_id === userId;
    const isConsumer = booking.consumerId === userId;

    // Cannot delete completed or already cancelled bookings
    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel a completed booking' 
      });
    }
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Booking is already cancelled' 
      });
    }

    // Update booking status to CANCELLED instead of deleting
    await pool.query(
      `UPDATE bookings 
       SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Delete the conversation and its messages when booking is cancelled
    const convResult = await pool.query(
      `SELECT id FROM conversations WHERE booking_id = $1`,
      [id]
    );
    
    if (convResult.rows.length > 0) {
      const conversationId = convResult.rows[0].id;
      
      // Delete all messages in the conversation first (foreign key constraint)
      await pool.query(
        `DELETE FROM messages WHERE conversation_id = $1`,
        [conversationId]
      );
      
      // Delete the conversation
      await pool.query(
        `DELETE FROM conversations WHERE id = $1`,
        [conversationId]
      );
      
      logger.info(`Deleted conversation ${conversationId} and its messages for cancelled booking ${id}`);
    }

    const barberName = `${booking.barber_first_name} ${booking.barber_last_name}`.trim() || 'Your barber';
    const consumerName = `${booking.consumer_first_name} ${booking.consumer_last_name}`.trim() || 'Customer';
    const serviceName = booking.original_service_name || booking.serviceType;

    // Notify the OTHER party about the cancellation
    if (isBarber) {
      // Barber cancelled, notify consumer
      await notificationService.saveNotification({
        userId: booking.consumerId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `${barberName} has cancelled your ${serviceName} appointment${reason ? `. Reason: ${reason}` : ''}`,
        data: { bookingId: id, reason, cancelledBy: 'barber' },
      });
    } else {
      // Consumer cancelled, notify barber
      await notificationService.saveNotification({
        userId: booking.barber_user_id,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `${consumerName} has cancelled their ${serviceName} appointment${reason ? `. Reason: ${reason}` : ''}`,
        data: { bookingId: id, reason, cancelledBy: 'consumer' },
      });
    }

    logger.info(`Booking ${id} cancelled by ${isBarber ? 'barber' : 'consumer'} ${userId}`);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Error cancelling booking:', error.message || error);
    next(error);
  }
});

export default router;

