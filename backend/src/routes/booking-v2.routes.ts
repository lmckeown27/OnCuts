/**
 * Booking Routes V2
 * 
 * Production escrow-based booking flow
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import * as bookingController from '../controllers/booking-v2.controller';

const router = express.Router();

// Create booking (creates escrow hold)
router.post('/', authenticate, bookingController.createBooking);

// Get bookings for user
router.get('/', authenticate, bookingController.getBookings);

// Get booking by ID
router.get('/:id', authenticate, bookingController.getBookingById);

// Complete booking (release escrow)
router.post('/:id/complete', authenticate, bookingController.completeBooking);

// Cancel booking (refund escrow)
router.post('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;

