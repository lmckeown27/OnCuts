/**
 * Booking Request Controller (AirBnb-style)
 * 
 * API endpoints for booking request workflow
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { bookingRequestService } from '../services/booking-request.service';
import { bookingMessagingService } from '../services/booking-messaging.service';

/**
 * POST /api/booking-requests
 * Create a new booking request
 */
export async function createBookingRequest(req: Request, res: Response) {
  try {
    const {
      customerId,
      barberId,
      serviceType,
      requestedDate,
      requestedTime,
      price,
      message,
    } = req.body;

    if (!customerId || !barberId || !serviceType || !requestedDate || !requestedTime || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await bookingRequestService.createBookingRequest({
      customerId,
      barberId,
      serviceType,
      requestedDate: new Date(requestedDate),
      requestedTime,
      price: parseFloat(price),
      message,
    });

    res.json({
      success: true,
      bookingId: result.bookingId,
      message: 'Booking request sent! The barber will review and respond shortly.',
    });
  } catch (error: any) {
    logger.error('Error creating booking request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create booking request',
    });
  }
}

/**
 * GET /api/booking-requests/barber/:barberId/pending
 * Get pending booking requests for a barber
 */
export async function getBarberPendingRequests(req: Request, res: Response) {
  try {
    const { barberId } = req.params;

    const requests = await bookingRequestService.getBarberPendingRequests(barberId);

    res.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error: any) {
    logger.error('Error getting pending requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending requests',
    });
  }
}

/**
 * POST /api/booking-requests/:bookingId/accept
 * Accept a booking request
 */
export async function acceptBookingRequest(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    const { barberId, message } = req.body;

    if (!barberId) {
      return res.status(400).json({
        success: false,
        error: 'barber ID is required',
      });
    }

    await bookingRequestService.acceptBookingRequest(bookingId, barberId, message);

    res.json({
      success: true,
      message: 'Booking accepted successfully!',
    });
  } catch (error: any) {
    logger.error('Error accepting booking:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept booking',
    });
  }
}

/**
 * POST /api/booking-requests/:bookingId/reject
 * Reject a booking request
 */
export async function rejectBookingRequest(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    const { barberId, reason } = req.body;

    if (!barberId) {
      return res.status(400).json({
        success: false,
        error: 'barberId is required',
      });
    }

    await bookingRequestService.rejectBookingRequest(bookingId, barberId, reason);

    res.json({
      success: true,
      message: 'Booking request declined',
    });
  } catch (error: any) {
    logger.error('Error rejecting booking:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject booking',
    });
  }
}

/**
 * GET /api/booking-requests/customer/:customerId/profile
 * Get customer profile (for barber view)
 */
export async function getCustomerProfile(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const { barberId } = req.query;

    if (!barberId) {
      return res.status(400).json({
        success: false,
        error: 'barberId is required',
      });
    }

    const profile = await bookingRequestService.getCustomerProfile(
      customerId,
      barberId as string
    );

    res.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    logger.error('Error getting customer profile:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer profile',
    });
  }
}

/**
 * GET /api/booking-requests/customer/:customerId/status
 * Get customer's booking status
 */
export async function getCustomerBookingStatus(req: Request, res: Response) {
  try {
    const { customerId } = req.params;

    const bookings = await bookingRequestService.getCustomerBookingStatus(customerId);

    res.json({
      success: true,
      bookings,
    });
  } catch (error: any) {
    logger.error('Error getting customer booking status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get booking status',
    });
  }
}

/**
 * POST /api/booking-requests/:bookingId/messages
 * Send a message
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    const { senderId, senderType, message } = req.body;

    if (!senderId || !senderType || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await bookingMessagingService.sendMessage({
      bookingId,
      senderId,
      senderType,
      message,
    });

    res.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error: any) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message',
    });
  }
}

/**
 * GET /api/booking-requests/:bookingId/messages
 * Get messages for a booking
 */
export async function getBookingMessages(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const messages = await bookingMessagingService.getBookingMessages(
      bookingId,
      userId as string
    );

    res.json({
      success: true,
      messages,
    });
  } catch (error: any) {
    logger.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get messages',
    });
  }
}

/**
 * GET /api/booking-requests/user/:userId/conversations
 * Get all conversations for a user
 */
export async function getUserConversations(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { userType } = req.query;

    if (!userType || (userType !== 'barber' && userType !== 'customer')) {
      return res.status(400).json({
        success: false,
        error: 'Valid userType (barber or customer) is required',
      });
    }

    const conversations = await bookingMessagingService.getUserConversations(
      userId,
      userType as 'barber' | 'customer'
    );

    res.json({
      success: true,
      conversations,
    });
  } catch (error: any) {
    logger.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get conversations',
    });
  }
}

/**
 * GET /api/booking-requests/user/:userId/unread-count
 * Get unread message count
 */
export async function getUnreadCount(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    const count = await bookingMessagingService.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error: any) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
    });
  }
}

