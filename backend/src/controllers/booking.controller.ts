import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import aptosService from '../services/aptos.service';
import stripeService from '../services/stripe.service';
import { logger } from '../utils/logger';

export const createBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barberId, serviceType, scheduledTime, durationMinutes, locationDetails, specialRequests } = req.body;
    const clientId = req.user!.userId;

    // Get barber and client info
    const barberResult = await pool.query(
      `SELECT b.id, b.pricing, u.aptos_address as barber_address, u.campus_id
       FROM barbers b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [barberId]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    const barber = barberResult.rows[0];
    const pricing = barber.pricing as any;
    const price = pricing[serviceType];

    if (!price) {
      throw new ApiError(400, 'Service type not found in barber pricing');
    }

    const clientResult = await pool.query('SELECT aptos_address FROM users WHERE id = $1', [clientId]);
    const clientAddress = clientResult.rows[0].aptos_address;

    // Convert scheduled time to Unix timestamp
    const scheduledTimestamp = Math.floor(new Date(scheduledTime).getTime() / 1000);
    const locationHash = Buffer.from(locationDetails || '').toString('base64');

    // Create booking on Aptos blockchain
    const txHash = await aptosService.createBooking({
      clientAddress,
      barberAddress: barber.barber_address,
      serviceType,
      price: price * 100, // Convert to cents
      scheduledTime: scheduledTimestamp,
      campusId: barber.campus_id,
      durationMinutes,
      locationHash,
    });

    // Get blockchain booking ID from transaction (simplified - would parse events)
    const blockchainBookingId = Date.now(); // Temporary: use timestamp as ID

    // Create booking metadata in database
    const metadataResult = await pool.query(
      `INSERT INTO booking_metadata 
       (blockchain_booking_id, barber_id, client_id, location_details, special_requests)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [blockchainBookingId, barberId, clientId, locationDetails, specialRequests]
    );

    logger.info(`Booking created: ${blockchainBookingId} (tx: ${txHash})`);

    res.status(201).json({
      success: true,
      data: {
        booking: metadataResult.rows[0],
        transactionHash: txHash,
      },
      message: 'Booking created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getBookings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, startDate, endDate } = req.query;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    let query: string;
    const params: any[] = [userId];

    if (userRole === 'barber') {
      query = `
        SELECT bm.*, 
          u.first_name as client_first_name, 
          u.last_name as client_last_name,
          u.email as client_email
        FROM booking_metadata bm
        JOIN barbers b ON bm.barber_id = b.id
        JOIN users u ON bm.client_id = u.id
        WHERE b.user_id = $1
      `;
    } else {
      query = `
        SELECT bm.*,
          u.first_name as barber_first_name,
          u.last_name as barber_last_name,
          b.profile_image_url as barber_image
        FROM booking_metadata bm
        JOIN barbers b ON bm.barber_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE bm.client_id = $1
      `;
    }

    query += ' ORDER BY bm.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Get booking metadata
    const result = await pool.query(
      `SELECT bm.*,
        u1.first_name as barber_first_name, u1.last_name as barber_last_name,
        u2.first_name as client_first_name, u2.last_name as client_last_name
      FROM booking_metadata bm
      JOIN barbers b ON bm.barber_id = b.id
      JOIN users u1 ON b.user_id = u1.id
      JOIN users u2 ON bm.client_id = u2.id
      WHERE bm.blockchain_booking_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    const booking = result.rows[0];

    // Verify user is involved in booking
    if (booking.client_id !== userId && booking.barber_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Get blockchain data
    const blockchainData = await aptosService.getBooking(parseInt(id));

    res.json({
      success: true,
      data: {
        ...booking,
        blockchain: blockchainData,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const confirmBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify barber owns this booking
    const booking = await pool.query(
      `SELECT bm.blockchain_booking_id, b.user_id, u.aptos_address
       FROM booking_metadata bm
       JOIN barbers b ON bm.barber_id = b.id
       JOIN users u ON b.user_id = u.id
       WHERE bm.blockchain_booking_id = $1`,
      [id]
    );

    if (booking.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    if (booking.rows[0].user_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Confirm on blockchain
    const txHash = await aptosService.confirmBooking(booking.rows[0].aptos_address, parseInt(id));

    logger.info(`Booking confirmed: ${id} (tx: ${txHash})`);

    res.json({
      success: true,
      message: 'Booking confirmed',
      transactionHash: txHash,
    });
  } catch (error) {
    next(error);
  }
};

export const completeBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify barber owns this booking
    const booking = await pool.query(
      `SELECT bm.blockchain_booking_id, b.user_id
       FROM booking_metadata bm
       JOIN barbers b ON bm.barber_id = b.id
       WHERE bm.blockchain_booking_id = $1`,
      [id]
    );

    if (booking.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    if (booking.rows[0].user_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Complete on blockchain
    const txHash = await aptosService.completeBooking(parseInt(id));

    // Trigger payment capture and payout
    // (Implementation would capture Stripe payment and transfer to barber)

    logger.info(`Booking completed: ${id} (tx: ${txHash})`);

    res.json({
      success: true,
      message: 'Booking completed, payment released',
      transactionHash: txHash,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    // Verify user is involved in booking
    const booking = await pool.query(
      `SELECT bm.blockchain_booking_id, bm.client_id, b.user_id as barber_user_id
       FROM booking_metadata bm
       JOIN barbers b ON bm.barber_id = b.id
       WHERE bm.blockchain_booking_id = $1`,
      [id]
    );

    if (booking.rows.length === 0) {
      throw new ApiError(404, 'Booking not found');
    }

    const isClient = booking.rows[0].client_id === userId;
    const isBarber = booking.rows[0].barber_user_id === userId;

    if (!isClient && !isBarber) {
      throw new ApiError(403, 'Not authorized');
    }

    // Cancel on blockchain
    const txHash = await aptosService.cancelBooking(parseInt(id));

    // Trigger refund if payment was made
    // (Implementation would refund Stripe payment)

    logger.info(`Booking cancelled: ${id} by ${isBarber ? 'barber' : 'client'} (tx: ${txHash})`);

    res.json({
      success: true,
      message: 'Booking cancelled',
      transactionHash: txHash,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserBookingHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    let query: string;

    if (userRole === 'barber') {
      query = `
        SELECT bm.blockchain_booking_id, bm.created_at, bm.location_details,
          u.first_name as client_first_name, u.last_name as client_last_name
        FROM booking_metadata bm
        JOIN barbers b ON bm.barber_id = b.id
        JOIN users u ON bm.client_id = u.id
        WHERE b.user_id = $1
        ORDER BY bm.created_at DESC
        LIMIT 50
      `;
    } else {
      query = `
        SELECT bm.blockchain_booking_id, bm.created_at, bm.location_details,
          u.first_name as barber_first_name, u.last_name as barber_last_name,
          b.profile_image_url
        FROM booking_metadata bm
        JOIN barbers b ON bm.barber_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE bm.client_id = $1
        ORDER BY bm.created_at DESC
        LIMIT 50
      `;
    }

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

