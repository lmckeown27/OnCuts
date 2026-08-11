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
import { getFrontendBaseUrl } from '../config/app-url';
import notificationService from '../services/notification.service';
import pushNotificationService from '../services/pushNotification.service';
import { sendPendingBookingEmails, sendBookingEditEmails, sendBookingCompletedEmails } from '../services/email.service';
import { DateTime } from 'luxon';
import {
  resolveServiceDurationMinutes,
  FALLBACK_BOOKING_DURATION_MINUTES,
  BarberPricingEntry,
} from '../utils/service-duration.utils';
import {
  formatStripeSecretKeyForSafeLog,
  getDefaultStripeClient,
  getDefaultStripeSecretKey,
  getOptionalStatementDescriptor,
  getStripeClientConfigPayload,
  logIfPublishableKeyCannotRetrievePaymentIntent,
} from '../config/stripe';
import stripeService from '../services/stripe.service';
import { sendStripeClientConfig } from './public-stripe.routes';
import { getSocketIO } from '../index';
import { sameUuid } from '../utils/uuid-compare';
import {
  cancelPendingRescheduleRequestsForBooking,
  executeParticipantBookingCancellation,
  resolveClientCancelRefundHours,
  shouldRefundOnCancellation,
  type CancellationActor,
} from '../services/booking-cancellation.service';
import { assertBookingWithinBarberAvailability, assertNoBarberSlotConflict } from '../services/barber-availability.service';
import { assertNoBookingBlockBetween, isUgcModerationSchemaReady } from '../services/ugc-moderation.service';
import {
  normalizeProviderIdRequest,
  appendProviderIdAliasResponse,
} from '../middleware/provider-id-alias.middleware';
import {
  estimatePlatformFeeSplit,
  loadProviderCommissionSettings,
  releaseCommissionFreeBooking,
  resolveBookingPlatformFee,
} from '../utils/platform-commission';
import { processProviderKickback } from '../utils/platform-kickback';
import {
  isCashPaymentAllowedForRoles,
  isCashPaymentEnabled,
} from '../utils/platform-frontend-settings';
import {
  bookingPaymentUrl,
  notifyConsumerTipAfterComplete,
} from '../services/booking-payment-lifecycle.service';

const router = express.Router();

router.use(normalizeProviderIdRequest);
router.use(appendProviderIdAliasResponse);

/**
 * GET /api/v1/bookings-simple/stripe/client-config
 * Alias for apps that bootstrap Stripe before a booking id exists.
 */
router.get('/stripe/client-config', (_req, res) => {
  sendStripeClientConfig(res);
});

/** Merge short label + details (mobile often sends details in `locationDetails` only). */
function mergeConversationLocation(
  loc: string | null | undefined,
  details: string | null | undefined
): string | null {
  const a = loc != null ? String(loc).trim() : '';
  const b = details != null ? String(details).trim() : '';
  if (a && b) return `${a} — ${b}`;
  return a || b || null;
}

/** Parse client scheduled time once: Pacific local → UTC for storage and conflict checks. */
function parseScheduledTimePacificToUtc(scheduledTime: string | undefined): Date {
  if (!scheduledTime) {
    return new Date();
  }
  if (scheduledTime.includes('Z') || scheduledTime.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(scheduledTime);
  }
  const pacificTime = DateTime.fromISO(scheduledTime, { zone: 'America/Los_Angeles' });
  if (!pacificTime.isValid) {
    logger.error(`Invalid scheduled time format: ${scheduledTime}`);
    return new Date();
  }
  return pacificTime.toUTC().toJSDate();
}

const BOOKING_SLOT_CONFLICT_MESSAGE =
  'This time slot is no longer available. The barber already has an appointment at this time. Please choose a different time.';

/** Bookings list/detail: prefer booking row, fall back to conversation cache. */
const BOOKING_EFFECTIVE_SCHEDULED_TIME = `COALESCE(b."requestedAt", c.scheduled_time)`;
const BOOKING_EFFECTIVE_SCHEDULED_TIME_CONV = `COALESCE(b."requestedAt", conv.scheduled_time)`;

function normalizeApiTimestamp(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Explicit payment-time contract for clients (iOS Paid must not fall back to schedule).
 * Always ISO-8601 strings. Includes snake_case `paid_at` alias for dual-key decoding.
 */
function formatBookingPaymentTimeFields(row: {
  paidAt?: unknown;
  status?: unknown;
  totalPaidCents?: unknown;
}) {
  const paidAt = normalizeApiTimestamp(row.paidAt);
  const status = String(row.status || '').toUpperCase();
  const totalPaidCents = Number(row.totalPaidCents);
  const looksSettled =
    status === 'PAID' ||
    paidAt != null ||
    (Number.isFinite(totalPaidCents) && totalPaidCents > 0);

  if (looksSettled && !paidAt) {
    logger.warn('Settled booking missing paidAt after COALESCE', {
      status,
      totalPaidCents: Number.isFinite(totalPaidCents) ? totalPaidCents : null,
    });
  }

  return {
    paidAt,
    paid_at: paidAt,
    displayTime: paidAt,
    displayTimeKind: paidAt ? ('paid' as const) : ('scheduled' as const),
  };
}

function formatPendingRescheduleRequest(row: Record<string, unknown> | null | undefined) {
  if (!row?.rr_id) return null;
  const proposedScheduledTime = normalizeApiTimestamp(row.rr_requested_time);
  return {
    id: row.rr_id,
    requestedTime: proposedScheduledTime ?? row.rr_requested_time,
    proposedScheduledTime,
    scheduledTime: proposedScheduledTime,
    location: row.rr_location ?? null,
    locationDetails: row.rr_location_details ?? null,
    notes: row.rr_notes ?? null,
    status: row.rr_status,
    createdAt: row.rr_created_at,
  };
}

function formatPendingRescheduleRequestFromRow(requestRow: Record<string, unknown>) {
  const proposedScheduledTime = normalizeApiTimestamp(requestRow.requested_time);
  return {
    id: requestRow.id,
    requestedTime: proposedScheduledTime ?? requestRow.requested_time,
    proposedScheduledTime,
    scheduledTime: proposedScheduledTime,
    location: requestRow.location ?? null,
    locationDetails: requestRow.location_details ?? null,
    notes: requestRow.notes ?? null,
    status: requestRow.status,
    createdAt: requestRow.created_at,
  };
}

/**
 * Archive messages for a booking before deletion
 * This preserves message history for admin viewing
 */
async function archiveBookingMessages(bookingId: string, client: any = pool): Promise<void> {
  try {
    // Archive messages with sender info before deletion
    await client.query(`
      INSERT INTO archived_booking_messages (
        booking_id, original_message_id, original_conversation_id,
        sender_id, sender_first_name, sender_last_name, sender_avatar, sender_role,
        content, message_type, created_at
      )
      SELECT 
        c.booking_id,
        m.id,
        m.conversation_id,
        m.sender_id,
        u.first_name,
        u.last_name,
        u."avatarUrl",
        u.role,
        m.content,
        m.message_type,
        m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON m.sender_id = u.id
      WHERE c.booking_id = $1
    `, [bookingId]);
    logger.info(`Archived messages for booking ${bookingId}`);
  } catch (error: any) {
    // Table might not exist yet or no messages to archive - that's fine
    logger.warn(`Could not archive messages for booking ${bookingId}: ${error.message}`);
  }
}

/**
 * POST /api/v1/bookings-simple
 * Create a simple booking record
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const consumerId = (req as any).user.userId;
    const {
      barberId: bodyBarberId,
      providerId,
      serviceType,
      priceUsdCents,
      scheduledTime,
      location,
      locationDetails,
      notes,
    } = req.body;

    const barberId = bodyBarberId ?? providerId;

    // Validate required fields
    if (!barberId && !req.body.providerId) {
      return res.status(400).json({ success: false, error: 'barberId or providerId is required' });
    }
    if (!serviceType) {
      return res.status(400).json({ success: false, error: 'serviceType is required' });
    }

    // Get barber record ID from barbers table (bookings.barberId references barbers.id, not users.id)
    const barberResult = await pool.query(
      `SELECT id, "isActive", is_hidden FROM barbers WHERE id = $1 OR "userId" = $1`,
      [barberId]
    );
    
    if (barberResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Barber not found' });
    }

    if (barberResult.rows[0].isActive === false || barberResult.rows[0].is_hidden === true) {
      return res.status(400).json({
        success: false,
        error: 'This provider is not currently accepting bookings',
      });
    }
    
    const barberRecordId = barberResult.rows[0].id;

    const barberPricingResult = await pool.query(
      'SELECT pricing FROM barbers WHERE id = $1',
      [barberRecordId]
    );
    const barberPricing = (barberPricingResult.rows[0]?.pricing || []) as BarberPricingEntry[];
    const serviceDurationMinutes = resolveServiceDurationMinutes(serviceType, barberPricing);

    const banCheck = await pool.query(
      `SELECT
         COALESCE(uc."isBanned", false) AS consumer_banned,
         COALESCE(ub."isBanned", false) AS barber_banned
       FROM users uc
       CROSS JOIN barbers b
       JOIN users ub ON b."userId" = ub.id
       WHERE uc.id = $1::uuid AND b.id = $2::uuid`,
      [consumerId, barberRecordId]
    );
    const bc = banCheck.rows[0];
    if (bc?.consumer_banned || bc?.barber_banned) {
      return res.status(403).json({
        success: false,
        error: 'This booking cannot be created.',
      });
    }

    const barberUidRow = await pool.query(`SELECT "userId" FROM barbers WHERE id = $1`, [barberRecordId]);
    const barberUserIdForBlock = barberUidRow.rows[0]?.userId;
    if (barberUserIdForBlock) {
      await assertNoBookingBlockBetween(String(consumerId), String(barberUserIdForBlock));
    }

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
      'Mullet': 'MULLET',              // Mullet haircut
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
    // Fee estimate uses provider commission settings; payment-intent reserves free slots for real.
    const price = priceUsdCents || 0;
    const commissionSettings = await loadProviderCommissionSettings(pool, barberRecordId);
    const feeEstimate = estimatePlatformFeeSplit(price, commissionSettings);
    const platformFee = feeEstimate.platformFeeCents;
    const barberEarnings = feeEstimate.barberEarningsCents;

    // Parse scheduled time once (Pacific → UTC) for conflict check and storage
    const requestedTime = parseScheduledTimePacificToUtc(scheduledTime);
    if (scheduledTime) {
      logger.info(`Parsed scheduled time: ${scheduledTime} -> UTC: ${requestedTime.toISOString()}`);
    }
    
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

    const client = await pool.connect();
    let booking: {
      id: string;
      consumerId: string;
      barberId: string;
      serviceType: string;
      priceUsdCents: number;
      requestedAt: Date;
      status: string;
      createdAt: Date;
    };

    try {
      await client.query('BEGIN');

      // Serialize concurrent bookings for the same barber
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [barberRecordId]);

      if (scheduledTime) {
        try {
          await assertBookingWithinBarberAvailability(
            barberRecordId,
            requestedTime,
            serviceDurationMinutes,
            undefined,
            client
          );
        } catch (availErr: any) {
          await client.query('ROLLBACK');
          const status = availErr.statusCode || 400;
          return res.status(status).json({
            success: false,
            error: availErr.message || 'Selected time is not available',
          });
        }

        const conflictAt = await assertNoBarberSlotConflict(
          client,
          barberRecordId,
          requestedTime,
          serviceDurationMinutes
        );
        if (conflictAt) {
          logger.warn(
            `Time slot conflict for barber ${barberRecordId}: requested ${requestedTime.toISOString()}, existing booking at ${conflictAt.toISOString()}`
          );
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: BOOKING_SLOT_CONFLICT_MESSAGE,
            conflictAt: conflictAt.toISOString(),
          });
        }
      }

      const availabilityResult = await client.query(
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
          new Date(requestedTime.getTime() + serviceDurationMinutes * 60 * 1000),
          price,
          dbServiceType,
        ]
      );

      const availabilityId = availabilityResult.rows[0].id;

      const result = await client.query(
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
        "durationMinutes",
        "updatedAt",
        status
      ) VALUES (gen_random_uuid(), $1, $2, $3::"ServiceType", $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, 'PENDING')
      RETURNING id, "consumerId", "barberId", "serviceType", "priceUsdCents", "requestedAt", "durationMinutes", status, "createdAt"`,
        [
          consumerId,
          barberRecordId,
          dbServiceType,
          price,
          platformFee,
          barberEarnings,
          requestedTime,
          availabilityId,
          serviceDurationMinutes,
        ]
      );

      await client.query('COMMIT');
      booking = result.rows[0];
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

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
      `SELECT "userId", b.id as barber_id FROM barbers b WHERE b.id = $1`,
      [barberRecordId]
    );
    const barberUserId = barberUserResult.rows[0]?.userId;

    // Create a conversation linked to the booking with the original service name
    // This ensures the service name is preserved for display (not the enum value)
    if (barberUserId) {
      try {
        await pool.query(
          `INSERT INTO conversations (
            user1_id, user2_id, booking_id, 
            service_name, service_price, scheduled_time,
            location, location_details, notes, booking_status,
            is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (user1_id, user2_id, booking_id) DO UPDATE SET 
            service_name = EXCLUDED.service_name,
            service_price = EXCLUDED.service_price,
            scheduled_time = EXCLUDED.scheduled_time,
            location = EXCLUDED.location,
            location_details = EXCLUDED.location_details,
            notes = EXCLUDED.notes`,
          [
            consumerId,
            barberUserId,
            booking.id,
            serviceType,
            price > 0 ? price / 100 : null, // conversations.service_price is dollars; price is cents
            requestedTime,
            location || null,
            locationDetails != null && locationDetails !== '' ? String(locationDetails) : null,
            notes || null,
          ]
        );
        logger.info(`Created conversation for booking ${booking.id} with service name: ${serviceType}`);
      } catch (convError) {
        // Non-fatal - conversation can be created later (e.g. retry after deploy fixes ON CONFLICT)
        logger.warn(
          `Failed to create conversation for booking ${booking.id}:`,
          convError instanceof Error ? convError.message : convError
        );
      }
    }
    
    // Send notification to barber about new booking request
    if (barberUserId) {
      await notificationService.saveNotification({
        userId: barberUserId,
        type: 'new_booking_request',
        title: 'New Booking Request!',
        message: `${consumerName} wants to book a ${serviceType} with you`,
        data: { bookingId: booking.id, consumerId, serviceType },
      });
      await pushNotificationService.sendMirrorPush(
        barberUserId,
        'New Booking Request!',
        `${consumerName} wants to book a ${serviceType} with you`,
        'new_booking_request',
        { bookingId: booking.id, consumerId, serviceType }
      );
      logger.info(`Notification sent to barber ${barberUserId} for new booking ${booking.id}`);
      
      // Emit new-booking-request event via WebSocket for live updates
      const newBookingEvent = {
        id: booking.id,
        consumerId,
        barberId: barberRecordId,
        serviceType,
        priceUsdCents: price,
        scheduledTime: requestedTime,
        location,
        notes,
        status: 'PENDING',
        consumerName,
        createdAt: new Date().toISOString(),
      };
      
      logger.info(`[new-booking-request] Attempting to emit to barber user ${barberUserId}`);
      try {
        const io = getSocketIO();
        logger.info(`[new-booking-request] Socket.IO instance available: ${!!io}`);
        if (io) {
          io.to(`user-${barberUserId}`).emit('new-booking-request', newBookingEvent);
          logger.info(`[new-booking-request] ✅ Emitted to room user-${barberUserId} for booking ${booking.id}`);
        } else {
          logger.warn(`[new-booking-request] ❌ Socket.IO not available`);
        }
      } catch (wsError) {
        logger.error(`[new-booking-request] ❌ Error emitting:`, wsError);
      }
    }

    // Send pending booking emails to both consumer and barber
    try {
      // Get consumer and barber emails, plus campus timezone
      const emailDetailsResult = await pool.query(
        `SELECT 
          u_consumer.email as consumer_email,
          u_consumer.first_name || ' ' || u_consumer.last_name as consumer_full_name,
          u_barber.email as barber_email,
          u_barber.first_name || ' ' || u_barber.last_name as barber_full_name,
          COALESCE(c.timezone, 'America/New_York') as campus_timezone
         FROM users u_consumer
         CROSS JOIN users u_barber
         LEFT JOIN barbers b ON b."userId" = u_barber.id
         LEFT JOIN campuses c ON b."campusId" = c.id
         WHERE u_consumer.id = $1 AND u_barber.id = $2`,
        [consumerId, barberUserId]
      );
      
      if (emailDetailsResult.rows.length > 0) {
        const emailDetails = emailDetailsResult.rows[0];
        const scheduledDate = new Date(requestedTime);
        const campusTimezone = emailDetails.campus_timezone || 'America/New_York';
        
        // Send pending booking emails (non-blocking)
        sendPendingBookingEmails({
          consumerEmail: emailDetails.consumer_email,
          consumerName: emailDetails.consumer_full_name,
          barberEmail: emailDetails.barber_email,
          barberName: emailDetails.barber_full_name,
          serviceName: serviceType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
          scheduledDate: scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: campusTimezone }),
          scheduledTime: scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: campusTimezone }),
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

// ============================================================================
// WALK-IN PAYMENT ENDPOINTS - FEATURE DISABLED
// ============================================================================
/*
router.post('/walk-in/create-payment', authenticate, async (req, res, next) => {
  // Walk-in feature disabled
});

router.post('/walk-in/confirm-payment', authenticate, async (req, res, next) => {
  // Walk-in feature disabled
});

router.post('/walk-in/record-cash', authenticate, async (req, res, next) => {
  // Walk-in feature disabled
});
*/

// ============================================================================
// CAMPUS MANAGER ENDPOINT
// ============================================================================

/**
 * GET /api/v1/bookings-simple/campus/:campusId
 * Get bookings for a campus (Campus Managers only)
 * Query params:
 *   - barberId: filter by specific barber
 *   - limit: max number of results (default 100)
 *   - statusFilter: 'upcoming' (PENDING, ACCEPTED, PAID), 'completed' (COMPLETED), or 'cancelled' (CANCELLED, REJECTED)
 */
router.get('/campus/:campusId', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { campusId } = req.params;
    const { barberId, limit = '100', statusFilter = 'completed', paymentMethod } = req.query;

    // Check if user is an admin (admins have access to all campuses)
    const adminCheck = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    const isAdmin = adminCheck.rows[0]?.role === 'ADMIN';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    // Build query to get bookings for all barbers on this campus
    // statusFilter determines which bookings to show:
    //   - 'upcoming': PENDING, ACCEPTED (awaiting pay), PAID (service paid)
    //   - 'completed': COMPLETED (service done; tip may still be pending)
    //   - 'cancelled': CANCELLED, REJECTED
    let statusClause: string;
    let dateFilter: string;
    
    if (statusFilter === 'upcoming') {
      statusClause = `b.status IN ('PENDING', 'ACCEPTED', 'PAID')`;
      dateFilter = `COALESCE(b."requestedAt", c.scheduled_time) >= NOW() - INTERVAL '1 day'`; // Include yesterday to catch late bookings
    } else if (statusFilter === 'cancelled') {
      // Cancelled: CANCELLED only from last 30 days
      statusClause = `b.status = 'CANCELLED'`;
      dateFilter = `COALESCE(b."requestedAt", c.scheduled_time) >= NOW() - INTERVAL '30 days'`;
    } else {
      // Completed: service finished (tip flow may still be open)
      statusClause = `b.status = 'COMPLETED'`;
      dateFilter = `COALESCE(b."requestedAt", c.scheduled_time) >= NOW() - INTERVAL '30 days'`;
    }
    
    let whereClause = `barber_user."campusId" = $1 AND ${statusClause} AND ${dateFilter}`;
    const params: any[] = [campusId];
    let paramIndex = 2;

    // Optionally filter by specific barber
    if (barberId) {
      whereClause += ` AND barber.id = $${paramIndex}`;
      params.push(barberId);
      paramIndex++;
    }

    // Optionally filter by payment method (card or cash)
    if (paymentMethod && paymentMethod !== 'all') {
      whereClause += ` AND b."paymentMethod" = $${paramIndex}`;
      params.push(paymentMethod);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT 
        b.id,
        b."consumerId",
        b."barberId",
        b."serviceType",
        b."priceUsdCents",
        b."tipAmountCents",
        b."totalPaidCents",
        ${BOOKING_EFFECTIVE_SCHEDULED_TIME} as "scheduledTime",
        b.status,
        b."createdAt",
        COALESCE(b."paidAt", b.paid_at) AS "paidAt",
        b."completedAt",
        b."paymentMethod",
        b."reviewRating",
        b."reviewComment",
        b."reviewedAt",
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer."avatarUrl" as consumer_avatar,
        barber_user.first_name as barber_first_name,
        barber_user.last_name as barber_last_name,
        barber_user."avatarUrl" as barber_avatar,
        barber.id as barber_record_id,
        c.id as conversation_id,
        c.location as conv_location,
        c.location_details as conv_location_details,
        c.notes as conv_notes,
        c.service_name as conv_service_name
      FROM bookings b
      LEFT JOIN users consumer ON b."consumerId" = consumer.id
      LEFT JOIN barbers barber ON b."barberId" = barber.id
      LEFT JOIN users barber_user ON barber."userId" = barber_user.id
      LEFT JOIN conversations c ON c.booking_id = b.id
      WHERE ${whereClause}
      ORDER BY ${BOOKING_EFFECTIVE_SCHEDULED_TIME} DESC
      LIMIT $${paramIndex}`,
      [...params, parseInt(limit as string)]
    );

    // Get list of barbers for the filter dropdown
    const barbersResult = await pool.query(
      `SELECT b.id, u.first_name, u.last_name
       FROM barbers b
       JOIN users u ON b."userId" = u.id
       WHERE u."campusId" = $1 AND b."isActive" = true AND b.is_hidden = false AND (u."isBanned" IS NOT TRUE)
       ORDER BY u.first_name, u.last_name`,
      [campusId]
    );

    // Helper to format service type
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
          barberRecordId: row.barber_record_id,
          serviceType: row.conv_service_name || formatServiceType(row.serviceType),
          priceUsdCents: row.priceUsdCents,
          durationMinutes: row.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES,
          tipAmountCents: row.tipAmountCents || null,
          totalPaidCents: row.totalPaidCents || null,
          scheduledTime: normalizeApiTimestamp(row.scheduledTime) ?? row.scheduledTime,
          status: row.status,
          createdAt: normalizeApiTimestamp(row.createdAt) ?? row.createdAt,
          ...formatBookingPaymentTimeFields(row),
          completedAt: normalizeApiTimestamp(row.completedAt),
          paymentMethod: row.paymentMethod || null,
          location: mergeConversationLocation(row.conv_location, row.conv_location_details),
          locationDetails: row.conv_location_details || null,
          notes: row.conv_notes || null,
          review: row.reviewRating ? {
            rating: row.reviewRating,
            comment: row.reviewComment || null,
            reviewedAt: normalizeApiTimestamp(row.reviewedAt),
          } : null,
          barberName: `${row.barber_first_name || ''} ${row.barber_last_name || ''}`.trim() || 'Barber',
          barberAvatar: row.barber_avatar || null,
          consumerName: `${row.consumer_first_name || ''} ${row.consumer_last_name || ''}`.trim() || 'Customer',
          consumerAvatar: row.consumer_avatar || null,
          conversationId: row.conversation_id || null,
        })),
        barbers: barbersResult.rows.map(row => ({
          id: row.id,
          name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        })),
      },
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching campus bookings:', error.message || error);
    logger.error('Full error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch campus bookings',
      details: error.detail || null,
    });
  }
});

// ============================================================================
// BOOKING-SPECIFIC ENDPOINTS (with :id parameter)
// ============================================================================

/**
 * GET /api/v1/bookings-simple/:id
 * Get booking by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    let peerBlockBookingClause = '';
    if (await isUgcModerationSchemaReady()) {
      peerBlockBookingClause = ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_user_id = $2::uuid AND ub.blocked_user_id =
            CASE WHEN b."consumerId" = $2::uuid THEN barber_user.id ELSE b."consumerId" END)
           OR (ub.blocker_user_id =
            CASE WHEN b."consumerId" = $2::uuid THEN barber_user.id ELSE b."consumerId" END
             AND ub.blocked_user_id = $2::uuid)
      )`;
    }

    const result = await pool.query(
      `SELECT 
        b.id,
        b."consumerId",
        b."barberId",
        b."serviceType",
        b."priceUsdCents",
        b."durationMinutes",
        ${BOOKING_EFFECTIVE_SCHEDULED_TIME_CONV} as "scheduledTime",
        b.status,
        b."createdAt",
        COALESCE(b."paidAt", b.paid_at) AS "paidAt",
        b."tipAmountCents",
        b."totalPaidCents",
        b."paymentMethod",
        b."paymentRequestedAt",
        b."tipRequestedAt",
        b."tipDecidedAt",
        b.commission_free_applied,
        b."reviewRating",
        b."reviewComment",
        b."reviewedAt",
        conv.id as conversation_id,
        conv.service_name,
        conv.location as conv_location,
        conv.location_details as conv_location_details,
        conv.notes as conv_notes,
        barber_record.id as barber_record_id,
        barber_user.id as barber_user_id,
        barber_user.first_name as barber_first_name,
        barber_user.last_name as barber_last_name,
        barber_user."avatarUrl" as barber_profile_url,
        barber_user.role as barber_user_role,
        consumer.id as consumer_user_id,
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer."avatarUrl" as consumer_profile_url,
        consumer.role as consumer_user_role,
        rr.id as rr_id,
        rr.requested_time as rr_requested_time,
        rr.location as rr_location,
        rr.location_details as rr_location_details,
        rr.notes as rr_notes,
        rr.status as rr_status,
        rr.created_at as rr_created_at
      FROM bookings b
      LEFT JOIN conversations conv ON conv.booking_id = b.id
      LEFT JOIN barbers barber_record ON b."barberId" = barber_record.id
      LEFT JOIN users barber_user ON barber_record."userId" = barber_user.id
      LEFT JOIN users consumer ON b."consumerId" = consumer.id
      LEFT JOIN booking_reschedule_requests rr
        ON rr.booking_id = b.id AND rr.status = 'pending'
      WHERE b.id = $1 AND (b."consumerId" = $2 OR barber_user.id = $2)${peerBlockBookingClause}`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const row = result.rows[0];
    const cashPaymentAllowed = await isCashPaymentAllowedForRoles(
      row.consumer_user_role,
      row.barber_user_role
    );

    // Format response with nested barber/consumer objects
    const booking = {
      id: row.id,
      consumerId: row.consumerId,
      barberId: row.barberId,
      serviceType: row.serviceType,
      serviceName: row.service_name || row.serviceType,
      priceUsdCents: row.priceUsdCents,
      durationMinutes: row.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES,
      scheduledTime: normalizeApiTimestamp(row.scheduledTime) ?? row.scheduledTime,
      status: row.status,
      createdAt: normalizeApiTimestamp(row.createdAt) ?? row.createdAt,
      ...formatBookingPaymentTimeFields(row),
      tipAmountCents: row.tipAmountCents,
      totalPaidCents: row.totalPaidCents,
      paymentMethod: row.paymentMethod || null,
      paymentRequestedAt: normalizeApiTimestamp(row.paymentRequestedAt),
      tipRequestedAt: normalizeApiTimestamp(row.tipRequestedAt),
      tipDecidedAt: normalizeApiTimestamp(row.tipDecidedAt),
      commissionFreeApplied: row.commission_free_applied === true,
      /** True only for admin↔admin bookings when Controls cash toggle is on. */
      cashPaymentAllowed,
      location: mergeConversationLocation(row.conv_location, row.conv_location_details),
      locationDetails: row.conv_location_details || null,
      notes: row.conv_notes,
      // Review data (from consumer after service completion)
      reviewRating: row.reviewRating || null,
      reviewComment: row.reviewComment || null,
      reviewedAt: row.reviewedAt || null,
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
      conversationId: row.conversation_id || null,
      pendingRescheduleRequest: formatPendingRescheduleRequest(row),
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

    const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'PAID', 'CANCELLED'];
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

    // If status is CANCELLED or REJECTED, drop pending schedule-change requests and delete the thread
    if (status === 'CANCELLED' || status === 'REJECTED') {
      await cancelPendingRescheduleRequestsForBooking(id, userId);

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

    // Push + in-app notification to the other participant (iOS lock screen / notification center)
    try {
      const detail = await pool.query(
        `SELECT b."consumerId", bar."userId" AS barber_user_id,
                TRIM(CONCAT(uc.first_name, ' ', uc.last_name)) AS consumer_name,
                TRIM(CONCAT(ub.first_name, ' ', ub.last_name)) AS barber_name,
                COALESCE(c.service_name, b."serviceType", 'Service') AS service_name
         FROM bookings b
         JOIN barbers bar ON b."barberId" = bar.id
         JOIN users uc ON b."consumerId" = uc.id
         JOIN users ub ON bar."userId" = ub.id
         LEFT JOIN conversations c ON c.booking_id = b.id
         WHERE b.id = $1`,
        [id]
      );
      if (detail.rows.length > 0) {
        const row = detail.rows[0];
        const actorIsConsumer = sameUuid(userId, row.consumerId);
        const recipientId = actorIsConsumer ? row.barber_user_id : row.consumerId;
        const serviceName = row.service_name || 'booking';

        let title = 'Booking updated';
        let body = `Booking status is now ${status}.`;
        switch (status) {
          case 'ACCEPTED':
            title = 'Booking accepted';
            body = actorIsConsumer
              ? `${row.consumer_name} updated the booking for ${serviceName}.`
              : `${row.barber_name} accepted your booking for ${serviceName}.`;
            break;
          case 'REJECTED':
            title = 'Booking declined';
            body = `${row.barber_name} declined your booking request.`;
            break;
          case 'CANCELLED':
            title = 'Booking cancelled';
            body = actorIsConsumer
              ? `${row.consumer_name} cancelled the booking for ${serviceName}.`
              : `${row.barber_name} cancelled your booking for ${serviceName}.`;
            break;
          case 'COMPLETED':
            title = 'Booking completed';
            body = actorIsConsumer
              ? `${row.consumer_name} marked the booking complete for ${serviceName}.`
              : `${row.barber_name} marked your ${serviceName} appointment complete.`;
            break;
          case 'PENDING':
            title = 'Booking pending';
            body = `Your ${serviceName} booking is pending.`;
            break;
          case 'PAID':
            title = 'Booking paid';
            body = `Payment recorded for your ${serviceName} booking.`;
            break;
          default:
            break;
        }

        await notificationService.saveNotification({
          userId: recipientId,
          type: 'booking_status',
          title,
          message: body,
          data: {
            bookingId: id,
            status,
            serviceName,
          },
        });
        await pushNotificationService.sendMirrorPush(recipientId, title, body, 'booking_status', {
          bookingId: id,
          status,
          serviceName,
        });

        const io = getSocketIO();
        if (io) {
          io.to(`user-${recipientId}`).emit('booking-status-changed', {
            bookingId: id,
            status,
            title,
            message: body,
          });
        }
      }
    } catch (notifErr: any) {
      logger.warn('booking status notification failed (non-fatal):', notifErr?.message || notifErr);
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

    // Verify user is the barber for this booking - also fetch email addresses and campus timezone for notifications
    const barberCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."priceUsdCents", b."serviceType", b."requestedAt",
              barber."userId" as barber_user_id,
              consumer.first_name || ' ' || consumer.last_name as consumer_name,
              consumer.email as consumer_email,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name,
              barber_user.email as barber_email,
              c.service_name as original_service_name,
              c.location as conv_location,
              c.location_details as conv_location_details,
              COALESCE(campus.timezone, 'America/New_York') as campus_timezone
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users consumer ON b."consumerId" = consumer.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
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

    // Service must already be paid (pay-on-accept)
    const statusCheck = await pool.query(
      `SELECT status, "paidAt", paid_at, "tipDecidedAt" FROM bookings WHERE id = $1`,
      [id]
    );
    const current = statusCheck.rows[0];
    if (!current || current.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: 'Can only mark complete after the consumer has paid for the service',
      });
    }
    if (current.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Tip already submitted for this booking',
      });
    }

    const mergedServiceLocation = mergeConversationLocation(
      booking.conv_location,
      booking.conv_location_details
    );

    // Service done → tip decision requested
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'COMPLETED',
           "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
           "tipRequestedAt" = CURRENT_TIMESTAMP,
           "paymentRequestedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, status, "tipRequestedAt", "completedAt"`,
      [id]
    );

    const serviceName = booking.original_service_name || booking.serviceType;
    const campusTimezone = booking.campus_timezone || 'America/New_York';
    
    const scheduledDate = booking.requestedAt 
      ? new Date(booking.requestedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: campusTimezone })
      : 'N/A';
    const scheduledTime = booking.requestedAt
      ? new Date(booking.requestedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: campusTimezone })
      : 'N/A';
    
    const paymentUrl = bookingPaymentUrl(id);

    await notifyConsumerTipAfterComplete({
      bookingId: id,
      consumerId: booking.consumerId,
      barberName: booking.barber_name,
      serviceName,
      priceUsdCents: booking.priceUsdCents,
      scheduledDate,
      scheduledTime,
      location: mergedServiceLocation,
    });

    logger.info(`[COMPLETE ENDPOINT] About to send tip-request emails for booking ${id}`);
    try {
      await sendBookingCompletedEmails({
        bookingId: id,
        serviceName,
        price: booking.priceUsdCents / 100,
        scheduledDate,
        scheduledTime,
        location: mergedServiceLocation ?? undefined,
        consumerName: booking.consumer_name,
        consumerEmail: booking.consumer_email,
        barberName: booking.barber_name,
        barberEmail: booking.barber_email,
        paymentUrl,
      });
      logger.info(`[COMPLETE ENDPOINT] ✅ Email function completed for booking ${id}`);
    } catch (emailError: any) {
      logger.error(`[COMPLETE ENDPOINT] ❌ Email function threw error for ${id}:`, emailError.message);
    }

    logger.info(`Booking ${id} marked as COMPLETED by barber ${userId}. Tip request sent to consumer ${booking.consumerId}`);

    res.json({
      success: true,
      data: { booking: result.rows[0] },
      message: 'Booking marked as complete. Tip request sent to customer.',
    });
  } catch (error: any) {
    logger.error('Error completing booking:', error.message || error);
    next(error);
  }
});

/**
 * PUT /api/v1/bookings-simple/:id/undo-complete
 * Revert COMPLETED (awaiting tip) back to PAID when tip is not yet decided.
 */
router.put('/:id/undo-complete', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const barberCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."tipDecidedAt",
              barber."userId" as barber_user_id,
              consumer.first_name || ' ' || consumer.last_name as consumer_name
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users consumer ON b."consumerId" = consumer.id
       WHERE b.id = $1 AND barber."userId" = $2`,
      [id, userId]
    );

    if (barberCheck.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the barber can undo completion of this booking' 
      });
    }

    const booking = barberCheck.rows[0];

    logger.info(`[UNDO-COMPLETE] Booking ${id} current status: ${booking.status}`);

    if (booking.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Cannot undo completion after the customer submitted a tip.',
      });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot undo completion. Booking was ${booking.status.toLowerCase()}.` 
      });
    }
    
    if (booking.status === 'ACCEPTED' || booking.status === 'PENDING' || booking.status === 'PAID') {
      return res.status(400).json({ 
        success: false, 
        error: 'This booking has not been marked as complete yet.' 
      });
    }
    
    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot undo completion. Unexpected booking status: ${booking.status}` 
      });
    }

    // Revert to PAID (service already paid); clear tip request stamps
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'PAID', 
           "paymentRequestedAt" = NULL,
           "tipRequestedAt" = NULL,
           "completedAt" = NULL,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, status`,
      [id]
    );

    await pool.query(
      `UPDATE conversations SET is_active = true WHERE booking_id = $1`,
      [id]
    );

    logger.info(`Booking ${id} reverted from COMPLETED to PAID by barber ${userId}`);

    try {
      await notificationService.saveNotification({
        userId: booking.consumerId,
        type: 'booking_status',
        title: 'Booking updated',
        message: 'The barber reverted the service completion — your booking is active again.',
        data: { bookingId: id, status: 'PAID' },
      });
    } catch (_) {
      /* non-fatal */
    }
    try {
      await pushNotificationService.sendMirrorPush(
        booking.consumerId,
        'Booking updated',
        'The barber reverted the completion — your booking is open again.',
        'booking_status',
        { bookingId: id, status: 'PAID' }
      );
    } catch (_) {
      /* non-fatal */
    }

    const io = getSocketIO();
    if (io) {
      io.to(`user-${booking.consumerId}`).emit('booking-status-changed', {
        bookingId: id,
        status: 'PAID',
        message: 'The barber has reverted the service completion.',
      });
    }

    res.json({
      success: true,
      data: { booking: result.rows[0] },
      message: 'Booking completion undone. Status reverted to PAID.',
    });
  } catch (error: any) {
    logger.error('Error undoing booking completion:', error.message || error);
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
      whereClause += ` AND ${BOOKING_EFFECTIVE_SCHEDULED_TIME} >= $${paramIndex}`;
      params.push(new Date(startDate as string));
      paramIndex++;
    }
    if (endDate) {
      whereClause += ` AND ${BOOKING_EFFECTIVE_SCHEDULED_TIME} <= $${paramIndex}`;
      params.push(new Date(endDate as string));
      paramIndex++;
    }

    if (await isUgcModerationSchemaReady()) {
      whereClause += ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_user_id = $${paramIndex}::uuid AND ub.blocked_user_id =
            CASE WHEN b."consumerId" = $${paramIndex}::uuid THEN barber_user.id ELSE b."consumerId" END)
           OR (ub.blocker_user_id =
            CASE WHEN b."consumerId" = $${paramIndex}::uuid THEN barber_user.id ELSE b."consumerId" END
             AND ub.blocked_user_id = $${paramIndex}::uuid)
      )`;
      params.push(userId);
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
        b."durationMinutes",
        ${BOOKING_EFFECTIVE_SCHEDULED_TIME} as "scheduledTime",
        b.status,
        b."createdAt",
        b."paymentRequestedAt",
        b."tipRequestedAt",
        b."tipDecidedAt",
        b."completedAt",
        COALESCE(b."paidAt", b.paid_at) AS "paidAt",
        b."tipAmountCents",
        b."totalPaidCents",
        b."paymentMethod",
        b.commission_free_applied,
        b."reviewRating",
        b."reviewComment",
        b."reviewedAt",
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer."avatarUrl" as consumer_avatar,
        barber_user.first_name as barber_first_name,
        barber_user.last_name as barber_last_name,
        barber_user."avatarUrl" as barber_avatar,
        -- Pull additional data from linked conversation
        c.location as conv_location,
        c.location_details as conv_location_details,
        c.notes as conv_notes,
        c.service_name as conv_service_name,
        rr.id as rr_id,
        rr.requested_time as rr_requested_time,
        rr.location as rr_location,
        rr.location_details as rr_location_details,
        rr.notes as rr_notes,
        rr.status as rr_status,
        rr.created_at as rr_created_at
      FROM bookings b
      LEFT JOIN users consumer ON b."consumerId" = consumer.id
      LEFT JOIN barbers barber ON b."barberId" = barber.id
      LEFT JOIN users barber_user ON barber."userId" = barber_user.id
      LEFT JOIN conversations c ON c.booking_id = b.id
      LEFT JOIN booking_reschedule_requests rr
        ON rr.booking_id = b.id AND rr.status = 'pending'
      WHERE ${whereClause}
      ORDER BY ${BOOKING_EFFECTIVE_SCHEDULED_TIME} ASC`,
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

    // Prevent caching to ensure fresh data after edits
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
          durationMinutes: row.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES,
          scheduledTime: normalizeApiTimestamp(row.scheduledTime) ?? row.scheduledTime,
          status: row.status,
          createdAt: normalizeApiTimestamp(row.createdAt) ?? row.createdAt,
          // Consumer-provided input data from conversation
          location: mergeConversationLocation(row.conv_location, row.conv_location_details),
          locationDetails: row.conv_location_details || null,
          notes: row.conv_notes || null,
          serviceName: row.conv_service_name || null,
          // Payment tracking fields (ISO paidAt; Paid UI must not substitute schedule)
          paymentRequestedAt: normalizeApiTimestamp(row.paymentRequestedAt),
          tipRequestedAt: normalizeApiTimestamp(row.tipRequestedAt),
          tipDecidedAt: normalizeApiTimestamp(row.tipDecidedAt),
          completedAt: normalizeApiTimestamp(row.completedAt),
          tipAmountCents: row.tipAmountCents ?? null,
          totalPaidCents: row.totalPaidCents ?? null,
          paymentMethod: row.paymentMethod || null,
          ...formatBookingPaymentTimeFields(row),
          commissionFreeApplied: row.commission_free_applied === true,
          // Review data (from consumer after service completion)
          review: row.reviewRating ? {
            rating: row.reviewRating,
            comment: row.reviewComment || null,
            reviewedAt: normalizeApiTimestamp(row.reviewedAt),
          } : null,
          // Full barber name for display
          barberName: `${row.barber_first_name || ''} ${row.barber_last_name || ''}`.trim() || 'Barber',
          barberAvatar: row.barber_avatar || null,
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
          pendingRescheduleRequest: formatPendingRescheduleRequest(row),
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
 * POST /api/v1/bookings-simple/:id/request-payment
 * Alias for mark-complete tip request (requires service already PAID).
 */
router.post('/:id/request-payment', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status, b."tipDecidedAt",
              ${BOOKING_EFFECTIVE_SCHEDULED_TIME} as scheduled_time,
              c.service_name, c.location as conv_location, c.location_details as conv_location_details,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name,
              consumer.first_name || ' ' || consumer.last_name as consumer_name,
              consumer.email as consumer_email,
              COALESCE(campus.timezone, 'America/Los_Angeles') as campus_timezone
       FROM bookings b
       LEFT JOIN conversations c ON c.booking_id = b.id
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       JOIN users consumer ON b."consumerId" = consumer.id
       LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    const booking = bookingCheck.rows[0];
    const mergedPaymentLocation = mergeConversationLocation(
      booking.conv_location,
      booking.conv_location_details
    );

    if (!sameUuid(booking.barber_user_id, userId)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the barber can request a tip after completion' 
      });
    }

    if (booking.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: 'Can only mark complete after the consumer has paid for the service',
      });
    }
    if (booking.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Tip already submitted for this booking',
      });
    }

    await pool.query(
      `UPDATE bookings 
       SET status = 'COMPLETED',
           "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
           "tipRequestedAt" = CURRENT_TIMESTAMP,
           "paymentRequestedAt" = CURRENT_TIMESTAMP, 
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    logger.info(`Tip requested for booking ${id} by barber ${userId}, status set to COMPLETED`);

    const paymentUrl = bookingPaymentUrl(id);
    const serviceName = booking.service_name || 'Haircut';
    const campusTimezone = booking.campus_timezone || 'America/Los_Angeles';
    const scheduledDate = booking.scheduled_time 
      ? new Date(booking.scheduled_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: campusTimezone })
      : 'N/A';
    const scheduledTime = booking.scheduled_time
      ? new Date(booking.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: campusTimezone })
      : 'N/A';

    await notifyConsumerTipAfterComplete({
      bookingId: id,
      consumerId: booking.consumerId,
      barberName: booking.barber_name,
      serviceName,
      priceUsdCents: booking.priceUsdCents,
      scheduledDate,
      scheduledTime,
      location: mergedPaymentLocation,
    });
    
    try {
      await sendBookingCompletedEmails({
        bookingId: id,
        serviceName,
        price: booking.priceUsdCents / 100,
        scheduledDate,
        scheduledTime,
        location: mergedPaymentLocation ?? undefined,
        consumerName: booking.consumer_name,
        consumerEmail: booking.consumer_email,
        barberName: booking.barber_name,
        barberEmail: '',
        paymentUrl,
      });
    } catch (emailError: any) {
      logger.error(`[REQUEST-PAYMENT] ❌ Failed tip-request email for ${id}:`, emailError.message);
    }

    res.json({
      success: true,
      message: 'Tip request sent to consumer',
      paymentRequestedAt: new Date().toISOString(),
      tipRequestedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error requesting tip/payment:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/create-payment-intent
 * Create a Stripe payment intent for the SERVICE (pay-on-accept). Tips use create-tip-intent.
 */
router.post('/:id/create-payment-intent', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status,
              b.commission_free_applied, b."paidAt", b.paid_at,
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
        error: booking.status === 'COMPLETED'
          ? 'Service is already paid — use the tip flow instead'
          : 'Can only pay for accepted bookings awaiting payment',
      });
    }
    if (booking.paidAt || booking.paid_at) {
      return res.status(400).json({
        success: false,
        error: 'This booking is already paid',
      });
    }

    const totalAmountCents = booking.priceUsdCents;
    const stripe = getDefaultStripeClient();

    const consumerResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const consumer = consumerResult.rows[0];

    const barberAccountResult = await pool.query(
      'SELECT stripe_account_id FROM users WHERE id = $1',
      [booking.barber_user_id]
    );
    const barberStripeAccountId = barberAccountResult.rows[0]?.stripe_account_id;

    const serviceAmountCents = booking.priceUsdCents;
    const feeSplit = await resolveBookingPlatformFee(pool, {
      bookingId: id,
      barberRecordId: booking.barberId,
      serviceAmountCents,
      alreadyCommissionFreeApplied: booking.commission_free_applied === true,
    });
    const platformFeeCents = feeSplit.platformFeeCents;

    const statementDescriptor = getOptionalStatementDescriptor();
    const paymentIntentConfig: any = {
      amount: totalAmountCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      ...(statementDescriptor ? { statement_descriptor: statementDescriptor } : {}),
      ...(consumer?.email ? { receipt_email: consumer.email } : {}),
      metadata: {
        booking_id: id,
        consumer_id: userId,
        barber_id: booking.barberId,
        barber_user_id: booking.barber_user_id,
        service_name: booking.service_name || 'Haircut',
        payment_kind: 'service',
        tip_amount_cents: '0',
        platform_fee_cents: platformFeeCents.toString(),
        platform_fee_percent: String(feeSplit.feePercentDisplay),
        commission_free: feeSplit.commissionFree ? 'true' : 'false',
        platform: 'OnCuts',
      },
      description: `OnCuts - ${booking.service_name || 'Haircut'} with ${booking.barber_name}`,
    };

    if (barberStripeAccountId) {
      await stripeService.validateConnectDestination(barberStripeAccountId);
      paymentIntentConfig.application_fee_amount = platformFeeCents;
      paymentIntentConfig.transfer_data = {
        destination: barberStripeAccountId,
      };
      const barberEarnings = totalAmountCents - platformFeeCents;
      const feeLabel = feeSplit.commissionFree
        ? 'commission-free'
        : `${feeSplit.feePercentDisplay}% of $${serviceAmountCents / 100} service`;
      logger.info(`Service payment split: $${platformFeeCents / 100} platform (${feeLabel}), $${barberEarnings / 100} to barber (${barberStripeAccountId})`, {
        stripeKey: formatStripeSecretKeyForSafeLog(getDefaultStripeSecretKey()),
      });
    } else {
      logger.warn(`Barber ${booking.barber_user_id} has no Stripe Connect account - payment goes to platform. Manual payout required.`);
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
    } catch (stripeErr) {
      if (feeSplit.reservedNow) {
        await releaseCommissionFreeBooking(pool, booking.barberId);
        await pool.query(
          `UPDATE bookings
           SET commission_free_applied = false, "updatedAt" = NOW()
           WHERE id = $1::uuid`,
          [id]
        );
      }
      throw stripeErr;
    }

    logger.info(`Service payment intent created for booking ${id}: ${paymentIntent.id}`);

    const { publishableKey, publishableKeyPrefix } = getStripeClientConfigPayload();
    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents: totalAmountCents,
        paymentKind: 'service',
        ...(publishableKey
          ? { publishableKey, publishableKeyPrefix: publishableKeyPrefix ?? undefined }
          : {}),
      },
    });

    void logIfPublishableKeyCannotRetrievePaymentIntent(
      paymentIntent.id,
      paymentIntent.client_secret,
      publishableKey
    );
  } catch (error: any) {
    logger.error('Error creating payment intent:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/update-payment-intent
 * Update tip-only PaymentIntent amount when tip selection changes.
 */
router.post('/:id/update-payment-intent', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentIntentId, tipAmountCents = 0 } = req.body;
    const userId = (req as any).user.userId;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId is required'
      });
    }

    const tipCents = Math.max(0, Math.round(Number(tipAmountCents) || 0));
    if (tipCents < 50) {
      return res.status(400).json({
        success: false,
        error: 'Tip payment intents require at least $0.50. Use confirm-tip with $0 instead.',
      });
    }

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b.status, b."tipDecidedAt"
       FROM bookings b
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
    if (booking.status !== 'COMPLETED' || booking.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Can only update tip intents while awaiting a tip decision',
      });
    }

    const stripe = getDefaultStripeClient();
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (existing.metadata?.payment_kind !== 'tip' || existing.metadata?.booking_id !== id) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent is not a tip intent for this booking',
      });
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      amount: tipCents,
      metadata: {
        ...existing.metadata,
        booking_id: id,
        tip_amount_cents: tipCents.toString(),
        payment_kind: 'tip',
      },
    });

    logger.info('Tip payment intent updated', { bookingId: id, paymentIntentId, tipCents });

    res.json({
      success: true,
      data: {
        totalAmountCents: tipCents,
        tipAmountCents: tipCents,
      },
    });
  } catch (error: any) {
    logger.error('Error updating payment intent:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/confirm-payment
 * Confirm SERVICE payment (pay-on-accept). Keeps conversation open until tip decision.
 */
router.post('/:id/confirm-payment', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentIntentId } = req.body;
    const userId = (req as any).user.userId;

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
    if (booking.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: 'Can only confirm service payment for accepted bookings',
      });
    }

    const totalAmountCents = booking.priceUsdCents;
    const stripe = getDefaultStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment has not been completed'
      });
    }
    if (
      paymentIntent.metadata?.booking_id &&
      paymentIntent.metadata.booking_id !== id
    ) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent does not match this booking',
      });
    }

    await pool.query(
      `UPDATE bookings 
       SET status = 'PAID',
           "tipAmountCents" = 0,
           "totalPaidCents" = $1,
           "paidAt" = CURRENT_TIMESTAMP,
           paid_at = CURRENT_TIMESTAMP,
           "paymentMethod" = 'card',
           payment_intent_id = COALESCE(payment_intent_id, $3),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'ACCEPTED'`,
      [totalAmountCents, id, paymentIntentId]
    );

    try {
      const destinationRaw = paymentIntent.transfer_data?.destination;
      const connectedAccountId =
        typeof destinationRaw === 'string'
          ? destinationRaw
          : destinationRaw?.id || null;
      await processProviderKickback({
        client: pool,
        bookingId: id,
        barberRecordId: booking.barberId,
        serviceAmountCents: booking.priceUsdCents,
        connectedAccountId,
        paymentIntentId,
        livemode: !!paymentIntent.livemode,
      });
    } catch (kickbackError: any) {
      logger.warn(
        `Kickback soft-failed on confirm-payment for ${id}: ${kickbackError?.message || kickbackError}`
      );
    }

    // Keep conversation open through the appointment (deleted after tip decision).

    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'payment_received',
      title: 'Payment Received!',
      message: `Service payment enroute: $${(totalAmountCents / 100).toFixed(2)}`,
      data: { bookingId: id, amount: totalAmountCents, tip: 0, phase: 'service' },
    });
    await pushNotificationService.sendMirrorPush(
      booking.barber_user_id,
      'Payment Received!',
      `Service payment enroute: $${(totalAmountCents / 100).toFixed(2)}`,
      'payment_received',
      { bookingId: id, amount: totalAmountCents, tip: 0, phase: 'service' }
    );

    logger.info(`Service payment confirmed for booking ${id}: $${(totalAmountCents / 100).toFixed(2)}`);

    try {
      const io = getSocketIO();
      if (io) {
        const consumerResult = await pool.query(
          `SELECT first_name, last_name FROM users WHERE id = $1`,
          [userId]
        );
        const consumer = consumerResult.rows[0];
        const consumerName = consumer ? `${consumer.first_name} ${consumer.last_name}` : 'Customer';

        io.to(`user-${booking.barber_user_id}`).emit('payment-received', {
          bookingId: id,
          consumerId: userId,
          consumerName,
          amountPaid: totalAmountCents,
          tipAmount: 0,
          totalFormatted: `$${(totalAmountCents / 100).toFixed(2)}`,
          phase: 'service',
        });
      }
    } catch (wsError: any) {
      logger.error(`[payment-received] Error emitting WebSocket event: ${wsError.message}`);
    }

    res.json({
      success: true,
      message: 'Service payment confirmed',
      data: {
        bookingId: id,
        amountPaid: totalAmountCents,
        tipAmount: 0,
        status: 'PAID',
      },
    });
  } catch (error: any) {
    logger.error('Error confirming payment:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/pay
 * Cash (or legacy) service payment on accept. Tips use confirm-tip.
 */
router.post('/:id/pay', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentMethod = 'cash' } = req.body;
    const userId = (req as any).user.userId;

    if (!['card', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment method. Must be "card" or "cash"'
      });
    }

    if (paymentMethod !== 'cash') {
      return res.status(400).json({
        success: false,
        error: 'Card service payments must use create-payment-intent + confirm-payment',
      });
    }

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name,
              barber_user.role as barber_user_role,
              consumer.role as consumer_user_role
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

    const cashAllowed = await isCashPaymentAllowedForRoles(
      booking.consumer_user_role,
      booking.barber_user_role
    );
    if (!cashAllowed) {
      const settingOn = await isCashPaymentEnabled();
      return res.status(403).json({
        success: false,
        error: settingOn
          ? 'Cash payments are only available for admin-to-admin bookings'
          : 'Cash payments are currently disabled',
      });
    }

    if (booking.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: 'Can only pay for accepted bookings awaiting payment'
      });
    }

    const totalAmountCents = booking.priceUsdCents;

    await pool.query(
      `UPDATE bookings 
       SET status = 'PAID',
           "tipAmountCents" = 0,
           "totalPaidCents" = $1,
           "paidAt" = CURRENT_TIMESTAMP,
           paid_at = CURRENT_TIMESTAMP,
           "paymentMethod" = $2,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'ACCEPTED'`,
      [totalAmountCents, paymentMethod, id]
    );

    // Keep conversation open until tip decision.

    const paymentMethodLabel = 'Cash';
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'payment_received',
      title: 'Payment Received!',
      message: `Service payment enroute: $${(totalAmountCents / 100).toFixed(2)} (${paymentMethodLabel})`,
      data: { bookingId: id, amount: totalAmountCents, tip: 0, paymentMethod, phase: 'service' },
    });
    await pushNotificationService.sendMirrorPush(
      booking.barber_user_id,
      'Payment Received!',
      `Service payment enroute: $${(totalAmountCents / 100).toFixed(2)} (${paymentMethodLabel})`,
      'payment_received',
      { bookingId: id, amount: totalAmountCents, tip: 0, paymentMethod, phase: 'service' }
    );

    logger.info(`Cash service payment for booking ${id}: $${(totalAmountCents / 100).toFixed(2)}`);

    try {
      const io = getSocketIO();
      if (io) {
        const consumerResult = await pool.query(
          `SELECT first_name, last_name FROM users WHERE id = $1`,
          [userId]
        );
        const consumer = consumerResult.rows[0];
        const consumerName = consumer ? `${consumer.first_name} ${consumer.last_name}` : 'Customer';

        io.to(`user-${booking.barber_user_id}`).emit('payment-received', {
          bookingId: id,
          consumerId: userId,
          consumerName,
          amountPaid: totalAmountCents,
          tipAmount: 0,
          totalFormatted: `$${(totalAmountCents / 100).toFixed(2)}`,
          paymentMethod,
          phase: 'service',
        });
      }
    } catch (wsError: any) {
      logger.error(`[payment-received] Error emitting WebSocket event: ${wsError.message}`);
    }

    res.json({
      success: true,
      message: 'Service payment processed successfully',
      data: {
        bookingId: id,
        amountPaid: totalAmountCents,
        tipAmount: 0,
        paymentMethod,
        status: 'PAID',
      },
    });
  } catch (error: any) {
    logger.error('Error processing payment:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/create-tip-intent
 * Tip-only Stripe PaymentIntent after service is COMPLETED (service already paid).
 */
router.post('/:id/create-tip-intent', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tipAmountCents = Math.max(0, Math.round(Number(req.body?.tipAmountCents) || 0));
    const userId = (req as any).user.userId;

    if (tipAmountCents < 50) {
      return res.status(400).json({
        success: false,
        error: 'Tip must be at least $0.50 to charge a card. Use confirm-tip with $0 for no tip.',
      });
    }

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b.status, b."paidAt", b.paid_at, b."tipDecidedAt",
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
      return res.status(403).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.status !== 'COMPLETED' || booking.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Can only tip after the service is completed and before a tip is submitted',
      });
    }
    if (!booking.paidAt && !booking.paid_at) {
      return res.status(400).json({
        success: false,
        error: 'Service must be paid before tipping',
      });
    }

    const stripe = getDefaultStripeClient();
    const consumerResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const barberAccountResult = await pool.query(
      'SELECT stripe_account_id FROM users WHERE id = $1',
      [booking.barber_user_id]
    );
    const barberStripeAccountId = barberAccountResult.rows[0]?.stripe_account_id;

    const statementDescriptor = getOptionalStatementDescriptor();
    const paymentIntentConfig: any = {
      amount: tipAmountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      ...(statementDescriptor ? { statement_descriptor: statementDescriptor } : {}),
      ...(consumerResult.rows[0]?.email
        ? { receipt_email: consumerResult.rows[0].email }
        : {}),
      metadata: {
        booking_id: id,
        consumer_id: userId,
        barber_id: booking.barberId,
        barber_user_id: booking.barber_user_id,
        payment_kind: 'tip',
        tip_amount_cents: tipAmountCents.toString(),
        platform: 'OnCuts',
      },
      description: `OnCuts tip for ${booking.service_name || 'service'} with ${booking.barber_name}`,
    };

    if (barberStripeAccountId) {
      await stripeService.validateConnectDestination(barberStripeAccountId);
      paymentIntentConfig.application_fee_amount = 0;
      paymentIntentConfig.transfer_data = { destination: barberStripeAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
    const { publishableKey, publishableKeyPrefix } = getStripeClientConfigPayload();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        tipAmountCents,
        paymentKind: 'tip',
        ...(publishableKey
          ? { publishableKey, publishableKeyPrefix: publishableKeyPrefix ?? undefined }
          : {}),
      },
    });
  } catch (error: any) {
    logger.error('Error creating tip intent:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/confirm-tip
 * Record tip decision ($0 or charged tip PI). Tips are card-only (never cash).
 */
router.post('/:id/confirm-tip', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const tipAmountCents = Math.max(0, Math.round(Number(req.body?.tipAmountCents) || 0));
    const paymentIntentId = req.body?.paymentIntentId as string | undefined;
    const paymentMethod = (req.body?.paymentMethod as string | undefined) || 'card';

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", b."barberId", b."priceUsdCents", b.status,
              b."totalPaidCents", b."paymentMethod" as service_payment_method,
              b."tipDecidedAt", b."paidAt", b.paid_at,
              barber."userId" as barber_user_id,
              barber_user.first_name || ' ' || barber_user.last_name as barber_name
       FROM bookings b
       JOIN barbers barber ON b."barberId" = barber.id
       JOIN users barber_user ON barber."userId" = barber_user.id
       WHERE b.id = $1 AND b."consumerId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Can only submit a tip after the service is marked complete',
      });
    }
    if (booking.tipDecidedAt) {
      return res.status(400).json({
        success: false,
        error: 'Tip already submitted for this booking',
      });
    }

    if (tipAmountCents > 0) {
      if (paymentMethod === 'cash') {
        return res.status(400).json({
          success: false,
          error: 'Tips must be paid by card (or Apple Pay / Google Pay)',
        });
      }
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'paymentIntentId is required for card tips',
        });
      }
      const stripe = getDefaultStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ success: false, error: 'Tip payment has not been completed' });
      }
      if (paymentIntent.metadata?.payment_kind !== 'tip' || paymentIntent.metadata?.booking_id !== id) {
        return res.status(400).json({ success: false, error: 'Invalid tip payment intent' });
      }
    }

    const priorTotal = Number(booking.totalPaidCents) || Number(booking.priceUsdCents) || 0;
    const newTotal = priorTotal + tipAmountCents;

    await pool.query(
      `UPDATE bookings
       SET "tipAmountCents" = $1,
           tip_amount_cents = $1,
           "totalPaidCents" = $2,
           "tipDecidedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [tipAmountCents, newTotal, id]
    );

    try {
      await archiveBookingMessages(id);
      await pool.query(
        `DELETE FROM messages
         WHERE conversation_id IN (SELECT id FROM conversations WHERE booking_id = $1)`,
        [id]
      );
      await pool.query(`DELETE FROM conversations WHERE booking_id = $1`, [id]);
    } catch {
      logger.debug(`No conversation to delete after tip for booking ${id}`);
    }

    const tipLabel =
      tipAmountCents > 0
        ? `Tip received: $${(tipAmountCents / 100).toFixed(2)}`
        : 'Customer submitted $0 tip';
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'payment_received',
      title: tipAmountCents > 0 ? 'Tip Received!' : 'Tip submitted',
      message: tipLabel,
      data: { bookingId: id, tip: tipAmountCents, phase: 'tip' },
    });
    await pushNotificationService.sendMirrorPush(
      booking.barber_user_id,
      tipAmountCents > 0 ? 'Tip Received!' : 'Tip submitted',
      tipLabel,
      'payment_received',
      { bookingId: id, tip: tipAmountCents, phase: 'tip' }
    );

    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user-${booking.barber_user_id}`).emit('payment-received', {
          bookingId: id,
          tipAmount: tipAmountCents,
          tipFormatted: tipAmountCents > 0 ? `$${(tipAmountCents / 100).toFixed(2)}` : undefined,
          phase: 'tip',
          tipDecided: true,
        });
        io.to(`user-${userId}`).emit('booking-status-changed', {
          bookingId: id,
          status: 'COMPLETED',
          tipDecidedAt: new Date().toISOString(),
        });
      }
    } catch {
      /* non-fatal */
    }

    res.json({
      success: true,
      message: tipAmountCents > 0 ? 'Tip confirmed' : 'Tip decision recorded ($0)',
      data: {
        bookingId: id,
        tipAmountCents,
        totalPaidCents: newTotal,
        tipDecidedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Error confirming tip:', error.message || error);
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
         SET "avgRating" = $1, "totalReviews" = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [ratingResult.rows[0].avg_rating, ratingResult.rows[0].review_count, booking.barberId]
      );
    }

    // Notify barber of new review (satisfaction faces: 1/3/5 → Dissatisfied/Neutral/Satisfied)
    const satisfactionLabel =
      rating >= 5 ? 'Satisfied' : rating >= 3 ? 'Neutral' : 'Dissatisfied';
    const reviewTitle = `New ${satisfactionLabel} Review`;
    const reviewMessage = `${booking.consumer_name} left you a ${satisfactionLabel} review${
      comment ? `: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"` : ''
    }`;
    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'new_review',
      title: reviewTitle,
      message: reviewMessage,
      data: { bookingId: id, rating, comment, satisfactionLabel },
    });
    await pushNotificationService.sendMirrorPush(
      booking.barber_user_id,
      reviewTitle,
      reviewMessage,
      'new_review',
      { bookingId: id, rating, comment, satisfactionLabel }
    );

    logger.info(`Review submitted for booking ${id}: ${satisfactionLabel} (${rating})`);

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
 * POST /api/v1/bookings-simple/:id/reschedule-request
 * Consumer submits a proposed date/time change for provider approval.
 */
router.post('/:id/reschedule-request', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { scheduledTime, location, notes } = req.body;
    const locationDetailsRaw = (req.body as any).locationDetails ?? (req.body as any).location_details;

    if (!scheduledTime) {
      return res.status(400).json({ success: false, error: 'scheduledTime is required' });
    }

    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."barberId", b."durationMinutes", bar."userId" as barber_user_id
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       WHERE b.id = $1 AND b."consumerId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    if (booking.status !== 'PENDING' && booking.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: `Cannot request a schedule change for a ${String(booking.status).toLowerCase()} booking`,
      });
    }

    const requestedTime = parseScheduledTimePacificToUtc(scheduledTime);
    const bookingDurationMinutes =
      booking.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES;

    try {
      await assertBookingWithinBarberAvailability(
        booking.barberId,
        requestedTime,
        bookingDurationMinutes,
        id
      );
    } catch (availErr: any) {
      const status = availErr.statusCode || 400;
      return res.status(status).json({
        success: false,
        error: availErr.message || 'Selected time is not available',
      });
    }

    const conflictAt = await assertNoBarberSlotConflict(
      pool,
      booking.barberId,
      requestedTime,
      bookingDurationMinutes,
      id
    );
    if (conflictAt) {
      return res.status(409).json({
        success: false,
        error: BOOKING_SLOT_CONFLICT_MESSAGE,
        conflictAt: conflictAt.toISOString(),
      });
    }

    const locationValue = location !== undefined ? location : null;
    const locationDetailsValue =
      locationDetailsRaw !== undefined
        ? locationDetailsRaw === '' ? null : String(locationDetailsRaw)
        : null;
    const notesValue = notes !== undefined ? notes : null;

    const existing = await pool.query(
      `SELECT id FROM booking_reschedule_requests WHERE booking_id = $1 AND status = 'pending'`,
      [id]
    );

    let requestRow;
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE booking_reschedule_requests
         SET requested_time = $1,
             location = $2,
             location_details = $3,
             notes = $4,
             created_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [requestedTime, locationValue, locationDetailsValue, notesValue, existing.rows[0].id]
      );
      requestRow = updated.rows[0];
    } else {
      const inserted = await pool.query(
        `INSERT INTO booking_reschedule_requests (
           booking_id, consumer_id, requested_time, location, location_details, notes, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [id, userId, requestedTime, locationValue, locationDetailsValue, notesValue]
      );
      requestRow = inserted.rows[0];
    }

    const consumerResult = await pool.query(
      `SELECT first_name || ' ' || last_name as name FROM users WHERE id = $1`,
      [userId]
    );
    const consumerName = consumerResult.rows[0]?.name || 'A customer';
    const timeZone = 'America/Los_Angeles';
    const formattedDate = requestedTime.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone,
    });
    const formattedTime = requestedTime.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone,
    });

    await notificationService.saveNotification({
      userId: booking.barber_user_id,
      type: 'reschedule_request',
      title: 'Schedule change requested',
      message: `${consumerName} requested to move the appointment to ${formattedDate} at ${formattedTime}`,
      data: { bookingId: id, requestedTime: requestedTime.toISOString() },
    });
    await pushNotificationService.sendMirrorPush(
      booking.barber_user_id,
      'Schedule change requested',
      `${consumerName} requested to move the appointment to ${formattedDate} at ${formattedTime}`,
      'reschedule_request',
      { bookingId: id, requestedTime: requestedTime.toISOString() }
    );

    res.status(201).json({
      success: true,
      data: {
        pendingRescheduleRequest: formatPendingRescheduleRequestFromRow(requestRow),
      },
      message: 'Schedule change request submitted for provider approval',
    });
  } catch (error: any) {
    logger.error('Error creating reschedule request:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/reschedule-request/approve
 * Provider approves a pending schedule change request.
 */
router.post('/:id/reschedule-request/approve', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."barberId", b."requestedAt", b."serviceType", b."durationMinutes",
              bar."userId" as barber_user_id,
              c.id as conversation_id, c.location as conv_location, c.location_details as conv_location_details,
              c.notes as conv_notes, c.service_name,
              rr.id as request_id, rr.requested_time, rr.location as req_location,
              rr.location_details as req_location_details, rr.notes as req_notes
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       JOIN booking_reschedule_requests rr ON rr.booking_id = b.id AND rr.status = 'pending'
       WHERE b.id = $1 AND bar."userId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pending schedule change request not found' });
    }

    const booking = bookingCheck.rows[0];
    const requestedTime = new Date(booking.requested_time);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [booking.barberId]);

      const bookingDurationMinutes =
        booking.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES;

      try {
        await assertBookingWithinBarberAvailability(
          booking.barberId,
          requestedTime,
          bookingDurationMinutes,
          id,
          client
        );
      } catch (availErr: any) {
        await client.query('ROLLBACK');
        const status = availErr.statusCode || 400;
        return res.status(status).json({
          success: false,
          error: availErr.message || 'Selected time is not available',
        });
      }

      const conflictAt = await assertNoBarberSlotConflict(
        client,
        booking.barberId,
        requestedTime,
        bookingDurationMinutes,
        id
      );
      if (conflictAt) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: BOOKING_SLOT_CONFLICT_MESSAGE,
          conflictAt: conflictAt.toISOString(),
        });
      }

      await client.query(
        `UPDATE bookings SET "requestedAt" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
        [requestedTime, id]
      );

      const newLocation = booking.req_location ?? booking.conv_location;
      const newLocationDetails = booking.req_location_details ?? booking.conv_location_details;
      const newNotes = booking.req_notes ?? booking.conv_notes;

      if (booking.conversation_id) {
        await client.query(
          `UPDATE conversations
           SET scheduled_time = $1,
               location = $2,
               location_details = $3,
               notes = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [requestedTime, newLocation, newLocationDetails, newNotes, booking.conversation_id]
        );
      }

      await client.query(
        `UPDATE booking_reschedule_requests
         SET status = 'approved', responded_at = CURRENT_TIMESTAMP, responded_by = $1
         WHERE id = $2`,
        [userId, booking.request_id]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    const timeZone = 'America/Los_Angeles';
    const formattedDate = requestedTime.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone,
    });
    const formattedTime = requestedTime.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone,
    });

    await notificationService.saveNotification({
      userId: booking.consumerId,
      type: 'reschedule_approved',
      title: 'Schedule change approved',
      message: `Your appointment was moved to ${formattedDate} at ${formattedTime}`,
      data: { bookingId: id, scheduledTime: requestedTime.toISOString() },
    });
    await pushNotificationService.sendMirrorPush(
      booking.consumerId,
      'Schedule change approved',
      `Your appointment was moved to ${formattedDate} at ${formattedTime}`,
      'reschedule_approved',
      { bookingId: id, scheduledTime: requestedTime.toISOString() }
    );

    res.json({
      success: true,
      data: { scheduledTime: requestedTime.toISOString() },
      message: 'Schedule change approved',
    });
  } catch (error: any) {
    logger.error('Error approving reschedule request:', error.message || error);
    next(error);
  }
});

/**
 * POST /api/v1/bookings-simple/:id/reschedule-request/reject
 * Provider rejects a pending schedule change request.
 */
router.post('/:id/reschedule-request/reject', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const bookingCheck = await pool.query(
      `SELECT b.id, b."consumerId", bar."userId" as barber_user_id, rr.id as request_id
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       JOIN booking_reschedule_requests rr ON rr.booking_id = b.id AND rr.status = 'pending'
       WHERE b.id = $1 AND bar."userId" = $2`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pending schedule change request not found' });
    }

    const booking = bookingCheck.rows[0];

    await pool.query(
      `UPDATE booking_reschedule_requests
       SET status = 'rejected', responded_at = CURRENT_TIMESTAMP, responded_by = $1
       WHERE id = $2`,
      [userId, booking.request_id]
    );

    await notificationService.saveNotification({
      userId: booking.consumerId,
      type: 'reschedule_rejected',
      title: 'Schedule change declined',
      message: 'Your provider declined the requested schedule change. Your original appointment time still stands.',
      data: { bookingId: id },
    });
    await pushNotificationService.sendMirrorPush(
      booking.consumerId,
      'Schedule change declined',
      'Your provider declined the requested schedule change. Your original appointment time still stands.',
      'reschedule_rejected',
      { bookingId: id }
    );

    res.json({ success: true, message: 'Schedule change request declined' });
  } catch (error: any) {
    logger.error('Error rejecting reschedule request:', error.message || error);
    next(error);
  }
});

/**
 * PUT /api/v1/bookings-simple/:id
 * Edit booking details (barber or consumer may change schedule directly on PENDING/ACCEPTED/PAID).
 * - scheduledTime updates the bookings table ("requestedAt" column)
 * - location, locationDetails, and notes update the linked conversations table
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { scheduledTime, location, notes } = req.body;
    const locationDetailsRaw = (req.body as any).locationDetails ?? (req.body as any).location_details;

    // Check if user is barber or consumer for this booking
    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."barberId", b."requestedAt", b."serviceType", b."durationMinutes",
              bar."userId" as barber_user_id,
              u_consumer.first_name as consumer_first_name, u_consumer.last_name as consumer_last_name,
              u_consumer.email as consumer_email,
              u_barber.first_name as barber_first_name, u_barber.last_name as barber_last_name,
              u_barber.email as barber_email,
              c.id as conversation_id, c.location as conv_location, c.location_details as conv_location_details, c.notes as conv_notes, c.service_name
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
    const isBarber = sameUuid(booking.barber_user_id, userId);
    const isConsumer = sameUuid(booking.consumerId, userId);

    // Only allow editing upcoming bookings (not after mark-complete)
    if (!['PENDING', 'ACCEPTED', 'PAID'].includes(booking.status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot edit a ${booking.status.toLowerCase()} booking` 
      });
    }

    let updatedScheduledTime = booking.requestedAt;
    let updatedLocation = booking.conv_location;
    let updatedLocationDetails = booking.conv_location_details;
    let updatedNotes = booking.conv_notes;
    let clearedPendingRescheduleRequest = false;

    // Update scheduledTime on bookings table
    if (scheduledTime !== undefined) {
      const parsedTime = parseScheduledTimePacificToUtc(scheduledTime);
      const bookingDurationMinutes =
        booking.durationMinutes || FALLBACK_BOOKING_DURATION_MINUTES;

      try {
        await assertBookingWithinBarberAvailability(
          booking.barberId,
          parsedTime,
          bookingDurationMinutes,
          id
        );
      } catch (availErr: any) {
        const status = availErr.statusCode || 400;
        return res.status(status).json({
          success: false,
          error: availErr.message || 'Selected time is not available',
        });
      }

      const conflictAt = await assertNoBarberSlotConflict(
        pool,
        booking.barberId,
        parsedTime,
        bookingDurationMinutes,
        id
      );
      if (conflictAt) {
        return res.status(409).json({
          success: false,
          error: BOOKING_SLOT_CONFLICT_MESSAGE,
          conflictAt: conflictAt.toISOString(),
        });
      }

      await pool.query(
        `UPDATE bookings 
         SET "requestedAt" = $1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [parsedTime.toISOString(), id]
      );
      updatedScheduledTime = parsedTime.toISOString();
      logger.info(`Updated booking ${id} scheduledTime to ${parsedTime.toISOString()}`);

      // Direct schedule edits supersede any pending consumer reschedule request.
      if (isBarber || isConsumer) {
        const cancelledCount = await cancelPendingRescheduleRequestsForBooking(id, userId);
        if (cancelledCount > 0) {
          clearedPendingRescheduleRequest = true;
        }
      }
    }

    // Update scheduled_time, location, location_details and/or notes on conversations table (if linked)
    if (scheduledTime !== undefined || location !== undefined || locationDetailsRaw !== undefined || notes !== undefined) {
      if (booking.conversation_id) {
        const convUpdates: string[] = [];
        const convValues: any[] = [];
        let convParamIndex = 1;

        if (scheduledTime !== undefined) {
          convUpdates.push(`scheduled_time = $${convParamIndex++}`);
          convValues.push(scheduledTime);
        }
        if (location !== undefined) {
          convUpdates.push(`location = $${convParamIndex++}`);
          convValues.push(location);
          updatedLocation = location;
        }
        if (locationDetailsRaw !== undefined) {
          const ld = locationDetailsRaw === '' ? null : String(locationDetailsRaw);
          convUpdates.push(`location_details = $${convParamIndex++}`);
          convValues.push(ld);
          updatedLocationDetails = ld;
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
          logger.info(`Updated conversation ${booking.conversation_id} with scheduled_time/location/notes`);
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

          if (scheduledTime !== undefined) {
            convUpdates.push(`scheduled_time = $${convParamIndex++}`);
            convValues.push(scheduledTime);
          }
          if (location !== undefined) {
            convUpdates.push(`location = $${convParamIndex++}`);
            convValues.push(location);
            updatedLocation = location;
          }
          if (locationDetailsRaw !== undefined) {
            const ld = locationDetailsRaw === '' ? null : String(locationDetailsRaw);
            convUpdates.push(`location_details = $${convParamIndex++}`);
            convValues.push(ld);
            updatedLocationDetails = ld;
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
          logger.warn(`No conversation found for booking ${id} - scheduled_time/location/notes not saved to conversation`);
          // Still update the response values so frontend shows what user entered
          if (location !== undefined) updatedLocation = location;
          if (locationDetailsRaw !== undefined) {
            updatedLocationDetails = locationDetailsRaw === '' ? null : String(locationDetailsRaw);
          }
          if (notes !== undefined) updatedNotes = notes;
        }
      }
    }

    const mergedLocationForResponse = mergeConversationLocation(updatedLocation, updatedLocationDetails);

    // If scheduledTime was changed, notify the OTHER party and send emails
    if (scheduledTime) {
      const barberName = `${booking.barber_first_name} ${booking.barber_last_name}`.trim() || 'Your barber';
      const consumerName = `${booking.consumer_first_name} ${booking.consumer_last_name}`.trim() || 'Customer';
      const barberEmail = booking.barber_email;
      const consumerEmail = booking.consumer_email;

      // Use Pacific timezone for consistent display across all platforms
      const timeZone = 'America/Los_Angeles';
      
      const newDate = new Date(scheduledTime);
      const formattedDate = newDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric',
        timeZone 
      });
      const formattedTime = newDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit',
        timeZone 
      });

      // Get the original scheduled time for comparison in notification data
      const originalScheduledTime = booking.original_scheduled_time || booking.requestedAt;
      const originalDate = new Date(originalScheduledTime);
      const originalFormattedDate = originalDate.toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric',
        timeZone 
      });
      const originalFormattedTime = originalDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit',
        timeZone 
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
        await pushNotificationService.sendMirrorPush(
          booking.consumerId,
          'Booking Updated',
          `${barberName} has rescheduled your appointment to ${formattedDate} at ${formattedTime}`,
          'booking_updated',
          {
            bookingId: id,
            newScheduledTime: scheduledTime,
            originalScheduledTime: originalScheduledTime,
            editedBy: 'barber',
          }
        );
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
        await pushNotificationService.sendMirrorPush(
          booking.barber_user_id,
          'Booking Updated',
          `${consumerName} has rescheduled their appointment to ${formattedDate} at ${formattedTime}`,
          'booking_updated',
          {
            bookingId: id,
            newScheduledTime: scheduledTime,
            originalScheduledTime: originalScheduledTime,
            editedBy: 'consumer',
          }
        );
      }

      // Get service details for email
      const serviceName = booking.service_name || booking.serviceType || 'Haircut';
      const priceResult = await pool.query(
        `SELECT "priceUsdCents" FROM bookings WHERE id = $1`,
        [id]
      );
      const priceUsdCents = priceResult.rows[0]?.priceUsdCents || 0;

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
          originalLocation:
            mergeConversationLocation(booking.conv_location, booking.conv_location_details) || undefined,
          newLocation: mergedLocationForResponse || undefined,
          originalNotes: booking.conv_notes || undefined,
          newNotes: updatedNotes || undefined,
          price: priceUsdCents / 100,
          bookingId: id,
        }).catch(err => logger.error('Failed to send booking edit emails:', err));
      }
    } else if (
      location !== undefined ||
      locationDetailsRaw !== undefined ||
      notes !== undefined
    ) {
      // Location/notes-only edit (no reschedule) — still notify the other party on device
      const barberName = `${booking.barber_first_name} ${booking.barber_last_name}`.trim() || 'Your barber';
      const consumerName = `${booking.consumer_first_name} ${booking.consumer_last_name}`.trim() || 'Customer';
      const serviceName = booking.service_name || booking.serviceType || 'Haircut';
      try {
        if (isBarber) {
          await notificationService.saveNotification({
            userId: booking.consumerId,
            type: 'booking_updated',
            title: 'Booking details updated',
            message: `${barberName} updated details for your ${serviceName} booking.`,
            data: { bookingId: id, editedBy: 'barber' },
          });
          await pushNotificationService.sendMirrorPush(
            booking.consumerId,
            'Booking details updated',
            `${barberName} updated details for your ${serviceName} booking.`,
            'booking_updated',
            { bookingId: id, editedBy: 'barber' }
          );
        } else {
          await notificationService.saveNotification({
            userId: booking.barber_user_id,
            type: 'booking_updated',
            title: 'Booking details updated',
            message: `${consumerName} updated details for the ${serviceName} booking.`,
            data: { bookingId: id, editedBy: 'consumer' },
          });
          await pushNotificationService.sendMirrorPush(
            booking.barber_user_id,
            'Booking details updated',
            `${consumerName} updated details for the ${serviceName} booking.`,
            'booking_updated',
            { bookingId: id, editedBy: 'consumer' }
          );
        }
      } catch (e: any) {
        logger.warn('booking detail edit push failed (non-fatal):', e?.message || e);
      }
    }

    logger.info(`Booking ${id} updated by ${isBarber ? 'barber' : 'consumer'} ${userId}`);

    // Emit booking-update event via WebSocket for live updates
    const bookingUpdate = {
      id,
      scheduledTime: updatedScheduledTime,
      location: mergedLocationForResponse,
      locationDetails: updatedLocationDetails,
      notes: updatedNotes,
      status: booking.status,
      barberId: booking.barberId,
      consumerId: booking.consumerId,
      serviceType: booking.serviceType,
      updatedBy: isBarber ? 'barber' : 'consumer',
      clearedPendingRescheduleRequest,
    };
    
    // Emit to both barber and consumer's personal rooms
    const io = getSocketIO();
    if (io) {
      io.to(`user-${booking.barber_user_id}`).emit('booking-update', bookingUpdate);
      io.to(`user-${booking.consumerId}`).emit('booking-update', bookingUpdate);
      logger.info(`Emitted booking-update event for booking ${id}`);
    }

    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: { 
        booking: {
          id,
          scheduledTime: updatedScheduledTime,
          location: mergedLocationForResponse,
          locationDetails: updatedLocationDetails,
          notes: updatedNotes,
          status: booking.status,
          ...(clearedPendingRescheduleRequest ? { pendingRescheduleRequest: null } : {}),
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

    // Check if user is barber or consumer for this booking (include campus timezone)
    const bookingCheck = await pool.query(
      `SELECT b.id, b.status, b."consumerId", b."serviceType", b."priceUsdCents",
              b.payment_intent_id, b."paymentMethod", b."tipDecidedAt",
              b."paidAt", b.paid_at,
              ${BOOKING_EFFECTIVE_SCHEDULED_TIME} as "scheduledTime",
              c.location, c.service_name as original_service_name,
              bar.id as "barberId", bar."userId" as barber_user_id, bar."campusId" as campus_id,
              bar.client_cancel_refund_hours,
              u_consumer.first_name as consumer_first_name, u_consumer.last_name as consumer_last_name, u_consumer.email as consumer_email,
              u_barber.first_name as barber_first_name, u_barber.last_name as barber_last_name, u_barber.email as barber_email,
              COALESCE(campus.timezone, 'America/New_York') as campus_timezone
       FROM bookings b
       JOIN barbers bar ON b."barberId" = bar.id
       JOIN users u_consumer ON b."consumerId" = u_consumer.id
       JOIN users u_barber ON bar."userId" = u_barber.id
       LEFT JOIN conversations c ON c.booking_id = b.id
       LEFT JOIN campuses campus ON bar."campusId" = campus.id
       WHERE b.id = $1 AND (bar."userId" = $2 OR b."consumerId" = $2)`,
      [id, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found or access denied' });
    }

    const booking = bookingCheck.rows[0];
    const isBarber = sameUuid(booking.barber_user_id, userId);
    const isConsumer = sameUuid(booking.consumerId, userId);

    // Check if user is an admin (only admins can remove completed/paid bookings)
    const adminCheck = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    const isAdmin = adminCheck.rows.length > 0 && adminCheck.rows[0].role === 'ADMIN';

    // Only allow ADMINS to hard-remove completed bookings (tip decided or post-service)
    if (booking.status === 'COMPLETED' && isAdmin) {
      const convResult = await pool.query(
        `SELECT id FROM conversations WHERE booking_id = $1`,
        [id]
      );
      
      if (convResult.rows.length > 0) {
        const conversationId = convResult.rows[0].id;
        await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
        await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
        logger.info(`Deleted conversation for removed completed booking ${id}`);
      }

      await pool.query(`DELETE FROM payments WHERE booking_id = $1`, [id]);
      await pool.query(`DELETE FROM bookings WHERE id = $1`, [id]);
      
      logger.info(`Admin ${userId} removed completed booking ${id} from schedule`);
      
      return res.json({
        success: true,
        message: 'Booking removed from schedule',
      });
    }

    // PAID (service paid, not yet complete): optionally refund service PI then cancel
    if (booking.status === 'PAID' && (isBarber || isConsumer || isAdmin)) {
      const cancelledBy: CancellationActor = isBarber ? 'barber' : isConsumer ? 'consumer' : 'admin';
      const refundHours = resolveClientCancelRefundHours(booking.client_cancel_refund_hours);
      const refundEligible = shouldRefundOnCancellation({
        cancelledBy,
        scheduledTime: booking.scheduledTime,
        refundHours,
      });

      let refunded = false;
      if (booking.payment_intent_id && booking.paymentMethod !== 'cash') {
        if (refundEligible) {
          try {
            const stripe = getDefaultStripeClient();
            await stripe.refunds.create({
              payment_intent: booking.payment_intent_id,
              reason: 'requested_by_customer',
              metadata: {
                booking_id: id,
                cancelled_by: cancelledBy,
              },
            });
            refunded = true;
            logger.info(
              `Refunded service payment intent ${booking.payment_intent_id} for cancelled PAID booking ${id} (cancelled_by=${cancelledBy})`
            );
          } catch (refundErr: any) {
            logger.error(`Failed to refund PAID booking ${id}: ${refundErr.message}`);
            return res.status(502).json({
              success: false,
              error: 'Could not refund the service payment. Booking was not cancelled.',
            });
          }
        } else {
          logger.info(
            `Skipping refund for PAID booking ${id}: consumer cancelled within ${refundHours} hour(s) of appointment (scheduled=${booking.scheduledTime})`
          );
        }
      }

      await executeParticipantBookingCancellation(booking, userId, isBarber, reason ?? null);

      const hourLabel = refundHours === 1 ? '1 hour' : `${refundHours} hours`;
      const message = refunded
        ? 'Booking cancelled and service payment refunded'
        : cancelledBy === 'consumer' && booking.payment_intent_id && booking.paymentMethod !== 'cash'
          ? `Booking cancelled. No refund - cancellations within ${hourLabel} of the appointment are non-refundable.`
          : 'Booking cancelled successfully';

      return res.json({
        success: true,
        message,
        data: {
          refunded,
          refundEligible,
          refundHours,
          message,
        },
      });
    }

    // Tip already decided / service completed — no participant cancel
    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel a completed booking' 
      });
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Booking is already cancelled' 
      });
    }

    await executeParticipantBookingCancellation(booking, userId, isBarber, reason ?? null);

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



