/**
 * Booking Controller (Blockchain Version)
 * 
 * REPLACES: PostgreSQL-based bookings
 * USES: On-chain smart contract escrow
 * 
 * The Complete Booking Flow (Users See vs Reality):
 * 
 * USER SEES:                    ACTUALLY HAPPENS:
 * ════════════                  ═════════════════
 * 1. "Book $30 haircut"    →    Lock 30 APT in smart contract escrow
 * 2. "Booking confirmed!"  →    Blockchain transaction submitted
 * 3. "Haircut completed"   →    Smart contract releases funds to barber
 * 4. "Leave review"        →    Review stored immutably on-chain
 * 
 * User never knows blockchain was involved! 🎭
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import custodialSignerService from '../services/custodial-signer.service';
import blockchainQueryService from '../services/blockchain-query.service';
import ipfsService from '../services/ipfs.service';

interface CreateBookingRequest {
  barber_address: string;
  service_name: string;
  service_description: string;
  amount: number; // In dollars
  scheduled_time: number; // Unix timestamp
  location: string;
  notes?: string;
}

interface CompleteBookingRequest {
  booking_id: string;
}

interface CancelBookingRequest {
  booking_id: string;
  reason: string;
}

/**
 * Create Booking - Lock funds in smart contract escrow
 * 
 * BEFORE (PostgreSQL):
 * BEGIN TRANSACTION
 * UPDATE users SET balance_available = balance_available - 30 WHERE id = ?
 * UPDATE users SET balance_locked = balance_locked + 30 WHERE id = ?
 * INSERT INTO bookings (...) VALUES (...)
 * INSERT INTO escrow_holds (...) VALUES (...)
 * COMMIT
 * 
 * AFTER (Blockchain):
 * Submit ONE transaction to smart contract
 * Smart contract handles all logic atomically
 * Escrow enforced by blockchain (can't be bypassed)
 */
export async function createBooking(req: Request, res: Response) {
  try {
    const studentAddress = (req as any).user?.address;
    const email = (req as any).user?.email;

    if (!studentAddress || !email) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const {
      barber_address,
      service_name,
      service_description,
      amount,
      scheduled_time,
      location,
      notes,
    }: CreateBookingRequest = req.body;

    logger.info(`📅 Creating booking: ${email} → ${barber_address} ($${amount})`);

    // Validate
    if (!barber_address || !service_name || !amount || !scheduled_time) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Check if barber exists and is actually a barber
    const isBarber = await blockchainQueryService.isBarber(barber_address);
    if (!isBarber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid barber address',
      });
    }

    // Check student balance
    const studentBalance = await blockchainQueryService.getUserBalance(studentAddress);
    if (!studentBalance) {
      return res.status(400).json({
        success: false,
        message: 'User account not found',
      });
    }

    const availableOctas = parseInt(studentBalance.available);
    const requiredOctas = amount * 100_000_000; // Convert dollars to octas

    if (availableOctas < requiredOctas) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
        data: {
          available: (availableOctas / 100_000_000).toFixed(2),
          required: amount,
        },
      });
    }

    // Get password for signing (in production, from session)
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required',
      });
    }

    const account = await custodialSignerService.createUserAccount(email, password);

    // Submit transaction to create booking (with escrow)
    // THE MAGIC: One smart contract call handles everything:
    // - Lock student funds
    // - Create booking record
    // - Emit event
    // - Update stats
    const tx = await custodialSignerService.signAndSubmitOptimistic(email, {
      function: `${process.env.APTOS_MODULE_ADDRESS}::bookings::create_booking`,
      arguments: [
        studentAddress,           // student_addr
        barber_address,           // barber_addr
        service_name,             // service_name
        service_description || '', // service_description
        requiredOctas,            // amount (in octas)
        scheduled_time,           // scheduled_time
        location || '',           // location_description
        notes || '',              // student_notes
      ],
    });

    logger.info(`✅ Booking created on blockchain: ${tx.txHash}`);

    // Invalidate caches
    await blockchainQueryService.invalidateUserCache(studentAddress);
    await blockchainQueryService.invalidateUserCache(barber_address);

    // Return success immediately (optimistic UI)
    return res.status(201).json({
      success: true,
      message: 'Booking confirmed!',
      data: {
        tx_hash: tx.txHash,
        student_address: studentAddress,
        barber_address,
        amount,
        scheduled_time,
        status: 'pending',
      },
    });
  } catch (error) {
    logger.error('Failed to create booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: (error as Error).message,
    });
  }
}

/**
 * Get User Bookings - Query from blockchain
 * 
 * BEFORE (PostgreSQL):
 * SELECT * FROM bookings WHERE student_addr = ? OR barber_addr = ?
 * 
 * AFTER (Blockchain):
 * Query booking events from blockchain
 * Events automatically indexed by Aptos
 */
export async function getUserBookings(req: Request, res: Response) {
  try {
    const userAddress = (req as any).user?.address;

    if (!userAddress) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    logger.info(`📚 Fetching bookings for user: ${userAddress}`);

    // Query blockchain for bookings
    const bookings = await blockchainQueryService.getUserBookings(userAddress);

    logger.info(`✅ Found ${bookings.length} bookings`);

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    logger.error('Failed to get bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load bookings',
    });
  }
}

/**
 * Complete Booking - Release escrow to barber
 * 
 * BEFORE (PostgreSQL):
 * BEGIN TRANSACTION
 * UPDATE bookings SET status = 'completed' WHERE id = ?
 * UPDATE escrow_holds SET status = 'released' WHERE booking_id = ?
 * UPDATE users SET balance_locked = balance_locked - 30 WHERE id = student_id
 * UPDATE users SET balance_available = balance_available + 28.50 WHERE id = barber_id
 * UPDATE platform_fees SET amount = amount + 1.50
 * COMMIT
 * 
 * AFTER (Blockchain):
 * Submit ONE transaction to smart contract
 * Smart contract handles all logic atomically
 * Funds automatically transferred by blockchain
 */
export async function completeBooking(req: Request, res: Response) {
  try {
    const { booking_id }: CompleteBookingRequest = req.body;

    if (!booking_id) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID required',
      });
    }

    logger.info(`✅ Completing booking: ${booking_id}`);

    // Submit transaction to complete booking
    // Platform signs this (with platform account)
    const platformPrivateKey = process.env.APTOS_PLATFORM_PRIVATE_KEY;
    if (!platformPrivateKey) {
      return res.status(500).json({
        success: false,
        message: 'Platform not configured',
      });
    }

    // For now, we'll use a simplified flow
    // In production, platform would have its own signing method
    const tx = await custodialSignerService.signAndSubmitOptimistic('platform@campuscuts.com', {
      function: `${process.env.APTOS_MODULE_ADDRESS}::bookings::complete_booking`,
      arguments: [
        parseInt(booking_id), // booking_id
      ],
    });

    logger.info(`✅ Booking completed on blockchain: ${tx.txHash}`);

    // Invalidate caches
    await blockchainQueryService.invalidateBookingCache(booking_id);

    return res.status(200).json({
      success: true,
      message: 'Booking completed! Payment released to barber.',
      data: {
        tx_hash: tx.txHash,
        booking_id,
      },
    });
  } catch (error) {
    logger.error('Failed to complete booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete booking',
      error: (error as Error).message,
    });
  }
}

/**
 * Cancel Booking - Refund escrow to student
 * 
 * BEFORE (PostgreSQL):
 * BEGIN TRANSACTION
 * UPDATE bookings SET status = 'cancelled' WHERE id = ?
 * UPDATE escrow_holds SET status = 'refunded' WHERE booking_id = ?
 * UPDATE users SET balance_locked = balance_locked - 30 WHERE id = student_id
 * UPDATE users SET balance_available = balance_available + 30 WHERE id = student_id
 * COMMIT
 * 
 * AFTER (Blockchain):
 * Submit transaction to cancel booking
 * Smart contract refunds automatically
 */
export async function cancelBooking(req: Request, res: Response) {
  try {
    const userAddress = (req as any).user?.address;
    const email = (req as any).user?.email;
    const { booking_id, reason }: CancelBookingRequest = req.body;

    if (!userAddress || !email) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!booking_id || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and reason required',
      });
    }

    logger.info(`❌ Cancelling booking: ${booking_id} by ${userAddress}`);

    // Get password
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required',
      });
    }

    const account = await custodialSignerService.createUserAccount(email, password);

    // Submit transaction to cancel booking
    // Platform signs on behalf of user
    const tx = await custodialSignerService.signAndSubmitOptimistic(email, {
      function: `${process.env.APTOS_MODULE_ADDRESS}::bookings::cancel_booking`,
      arguments: [
        parseInt(booking_id), // booking_id
        userAddress,          // cancelled_by
        reason,               // reason
      ],
    });

    logger.info(`✅ Booking cancelled on blockchain: ${tx.txHash}`);

    // Invalidate caches
    await blockchainQueryService.invalidateBookingCache(booking_id);
    await blockchainQueryService.invalidateUserCache(userAddress);

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled. Refund processed.',
      data: {
        tx_hash: tx.txHash,
        booking_id,
        refund_amount: req.body.amount,
      },
    });
  } catch (error) {
    logger.error('Failed to cancel booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: (error as Error).message,
    });
  }
}

