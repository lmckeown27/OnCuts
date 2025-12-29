/**
 * Booking Controller V2
 * 
 * Implements production escrow-based payment flow (Stripe off-chain):
 * 1. Create booking → Create escrow hold via Stripe
 * 2. Complete booking → Release escrow to barber
 * 3. Cancel booking → Refund escrow to consumer
 * 
 * NOTE: Blockchain features disabled - platform uses Stripe for payments
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
// BLOCKCHAIN DISABLED - Platform uses Stripe for off-chain payments
// import aptosService from '../services/aptos.service';
// import onchainAnchorService, { RecordType } from '../services/onchain-anchor.service';
import paymentServiceV2 from '../services/payment-v2.service';
import escrowService, { EscrowStatus } from '../services/escrow.service';
import auditService from '../services/audit.service';
import { logger } from '../utils/logger';

/**
 * Create booking with escrow hold
 * POST /api/bookings
 */
export const createBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      barberId,
      serviceId,
      priceCents,
      requestedSlot,
      locationDetails,
      specialRequests,
    } = req.body;

    const consumerId = req.user!.userId;

    // Validate required fields
    if (!barberId || !priceCents || !requestedSlot) {
      throw new ApiError(400, 'Missing required fields');
    }

    if (priceCents <= 0) {
      throw new ApiError(400, 'Invalid price');
    }

    // 1. Verify barber exists and is active
    const barberResult = await pool.query(
      `SELECT u.id, u.role
       FROM users u
       WHERE u.id = $1 AND u.role = 'barber' AND u.is_active = true`,
      [barberId]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found or inactive');
    }

    // 2. Verify consumer exists (current user)
    const consumerResult = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [consumerId]
    );

    if (consumerResult.rows.length === 0) {
      throw new ApiError(404, 'Consumer not found');
    }

    // 3. Create booking record
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
        consumer_id, barber_id, service_id, price_cents,
        requested_slot, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [consumerId, barberId, serviceId, priceCents, requestedSlot]
    );

    const booking = bookingResult.rows[0];

    // 4. Process booking payment (creates escrow hold)
    const paymentResult = await paymentServiceV2.processBookingPayment({
      bookingId: booking.id,
      consumerId,
      barberId,
      amountCents: priceCents,
      expiresHours: 48,
    });

    // BLOCKCHAIN DISABLED - On-chain anchoring removed
    // Platform uses Stripe for off-chain payments only
    // To re-enable blockchain proof anchoring, uncomment below:
    // try {
    //   await onchainAnchorService.anchorProof({
    //     record_type: RecordType.BOOKING_HASH,
    //     subject_id: booking.id,
    //     data: {
    //       booking_id: booking.id,
    //       consumer_address: consumer.aptos_address,
    //       barber_address: barber.aptos_address,
    //       price_cents: priceCents,
    //       created_at: new Date().toISOString(),
    //     },
    //   });
    // } catch (anchorError) {
    //   logger.warn('Failed to anchor booking on-chain', { booking_id: booking.id, error: anchorError });
    // }

    // 6. Audit log
    await auditService.log({
      actor_user_id: consumerId,
      action: 'booking_created',
      object_type: 'booking',
      object_id: booking.id,
      details: {
        barber_id: barberId,
        price_cents: priceCents,
        escrow_id: paymentResult.escrowId,
      },
    });

    logger.info('Booking created with escrow hold', {
      booking_id: booking.id,
      consumer_id: consumerId,
      barber_id: barberId,
      amount_dollars: priceCents / 100,
      escrow_id: paymentResult.escrowId,
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        escrow: {
          id: paymentResult.escrowId,
          status: 'held',
          amount_cents: priceCents,
          expires_hours: 48,
        },
      },
      message: 'Booking created successfully. Payment held in escrow.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete booking (release escrow to barber)
 * POST /api/bookings/:id/complete
 */
export const completeBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: bookingId } = req.params;
    const { tipCents } = req.body;
    const userId = req.user!.userId;

    // 1. Get booking and verify barber ownership
    const bookingResult = await pool.query(
      `SELECT * FROM bookings
       WHERE id = $1 AND barber_id = $2`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new ApiError(404, 'Booking not found or not authorized');
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      throw new ApiError(400, `Cannot complete booking with status: ${booking.status}`);
    }

    // 2. Release escrow (moves funds to barber's available balance)
    const releaseResult = await paymentServiceV2.completeBookingPayment({
      bookingId,
      tipCents,
      platformFeeRate: 0.05, // 5%
    });

    // 3. Update booking status
    await pool.query(
      `UPDATE bookings
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    // 4. Audit log
    await auditService.log({
      actor_user_id: userId,
      action: 'booking_completed',
      object_type: 'booking',
      object_id: bookingId,
      details: {
        net_to_barber_cents: releaseResult.netToBarber,
        platform_fee_cents: releaseResult.platformFee,
        tip_cents: tipCents || 0,
      },
    });

    logger.info('Booking completed - escrow released', {
      booking_id: bookingId,
      barber_id: userId,
      net_dollars: releaseResult.netToBarber / 100,
      fee_dollars: releaseResult.platformFee / 100,
    });

    res.json({
      success: true,
      data: {
        booking_id: bookingId,
        status: 'completed',
        net_to_barber_dollars: releaseResult.netToBarber / 100,
        platform_fee_dollars: releaseResult.platformFee / 100,
        tip_dollars: (tipCents || 0) / 100,
      },
      message: 'Booking completed. Funds released to your available balance.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel booking (refund escrow to consumer)
 * POST /api/bookings/:id/cancel
 */
export const cancelBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    // 1. Get booking
    const bookingResult = await pool.query(
      `SELECT * FROM bookings
       WHERE id = $1 AND (consumer_id = $2 OR barber_id = $2)`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new ApiError(404, 'Booking not found or not authorized');
    }

    const booking = bookingResult.rows[0];
    const isConsumer = booking.consumer_id === userId;
    const isBarber = booking.barber_id === userId;

    if (booking.status === 'completed') {
      throw new ApiError(400, 'Cannot cancel completed booking');
    }

    if (booking.status === 'cancelled') {
      throw new ApiError(400, 'Booking already cancelled');
    }

    // 2. Refund escrow
    const refundResult = await paymentServiceV2.cancelBookingPayment(
      bookingId,
      reason || 'Booking cancelled'
    );

    // 3. Update booking status
    await pool.query(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    // 4. Audit log
    await auditService.log({
      actor_user_id: userId,
      action: 'booking_cancelled',
      object_type: 'booking',
      object_id: bookingId,
      details: {
        cancelled_by: isBarber ? 'barber' : 'consumer',
        reason,
        refund_amount_cents: refundResult.amount,
      },
    });

    logger.info('Booking cancelled - escrow refunded', {
      booking_id: bookingId,
      cancelled_by: isBarber ? 'barber' : 'consumer',
      refund_dollars: refundResult.amount / 100,
      reason,
    });

    res.json({
      success: true,
      data: {
        booking_id: bookingId,
        status: 'cancelled',
        refund_amount_dollars: refundResult.amount / 100,
      },
      message: 'Booking cancelled. Refund issued to consumer wallet.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get bookings for user
 * GET /api/bookings
 */
export const getBookings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status } = req.query;

    let query = `
      SELECT b.*,
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        consumer.email as consumer_email,
        barber.first_name as barber_first_name,
        barber.last_name as barber_last_name,
        barber.email as barber_email,
        e.status as escrow_status,
        e.expires_at as escrow_expires_at
      FROM bookings b
      JOIN users consumer ON b.consumer_id = consumer.id
      JOIN users barber ON b.barber_id = barber.id
      LEFT JOIN escrow_holds e ON b.id = e.booking_id
      WHERE ${userRole === 'barber' ? 'b.barber_id' : 'b.consumer_id'} = $1
    `;

    const params: any[] = [userId];

    if (status) {
      query += ` AND b.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY b.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
export const getBookingById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const result = await pool.query(
      `SELECT b.*,
        consumer.first_name as consumer_first_name,
        consumer.last_name as consumer_last_name,
        barber.first_name as barber_first_name,
        barber.last_name as barber_last_name,
        e.status as escrow_status,
        e.amount as escrow_amount,
        e.expires_at as escrow_expires_at
      FROM bookings b
      JOIN users consumer ON b.consumer_id = consumer.id
      JOIN users barber ON b.barber_id = barber.id
      LEFT JOIN escrow_holds e ON b.id = e.booking_id
      WHERE b.id = $1 AND (b.consumer_id = $2 OR b.barber_id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

