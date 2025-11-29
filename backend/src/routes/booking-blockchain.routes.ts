/**
 * Booking Routes (Blockchain Version)
 * 
 * Uses smart contract escrow instead of PostgreSQL
 * All booking data stored on-chain
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import * as bookingController from '../controllers/booking-blockchain.controller';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  BOOKING MANAGEMENT (All require authentication)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/bookings-blockchain
 * Create new booking (locks funds in smart contract escrow)
 * 
 * Body: {
 *   barber_address: string,
 *   service_name: string,
 *   service_description: string,
 *   amount: number,
 *   scheduled_time: number,
 *   location: string,
 *   notes?: string,
 *   password: string (for signing)
 * }
 * 
 * Returns: { tx_hash, booking_id, status }
 */
router.post('/', authenticate, bookingController.createBooking);

/**
 * GET /api/bookings-blockchain
 * Get user's booking history (from blockchain events)
 * 
 * Returns: { bookings: Booking[] }
 */
router.get('/', authenticate, bookingController.getUserBookings);

/**
 * POST /api/bookings-blockchain/:id/complete
 * Complete booking (release escrow to barber)
 * 
 * Body: { booking_id: string }
 * Returns: { tx_hash, booking_id }
 */
router.post('/:id/complete', authenticate, bookingController.completeBooking);

/**
 * POST /api/bookings-blockchain/:id/cancel
 * Cancel booking (refund to student)
 * 
 * Body: { booking_id: string, reason: string, password: string }
 * Returns: { tx_hash, booking_id, refund_amount }
 */
router.post('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;

