/**
 * Message Routes for CampusCuts
 * Handles real-time messaging between students and barbers
 */

import express from 'express';
import messageService from '../services/message.service';
import { authenticate } from '../middleware/auth';
import { pool } from '../database/connection';

const router = express.Router();

/**
 * GET /api/messages/conversations
 * Get user's conversations with pagination
 */
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await messageService.getUserConversations(userId, page, limit);
    
    // Prevent browser caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/conversations
 * Start a new BOOKING-CENTRIC conversation
 * CampusCuts conversations are always about a scheduled service
 */
router.post('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    // Accept both camelCase and snake_case from frontend
    const otherUserId = req.body.otherUserId || req.body.other_user_id;

    if (!otherUserId) {
      return res.status(400).json({ success: false, error: 'other_user_id is required' });
    }

    // Build booking context from request body
    const bookingContext = {
      bookingId: req.body.bookingId || req.body.booking_id,
      serviceName: req.body.serviceName || req.body.service_name,
      servicePrice: req.body.servicePrice || req.body.service_price,
      scheduledTime: req.body.scheduledTime || req.body.scheduled_time,
      location: req.body.location,
      locationDetails: req.body.locationDetails || req.body.location_details,
      notes: req.body.notes,
      barberName: req.body.barberName || req.body.barber_name,
      consumerName: req.body.consumerName || req.body.consumer_name,
      barberProfilePicture: req.body.barberProfilePicture || req.body.barber_profile_picture,
      consumerProfilePicture: req.body.consumerProfilePicture || req.body.consumer_profile_picture,
    };

    console.log('🚀 Starting BOOKING-CENTRIC conversation:', { 
      userId, 
      otherUserId, 
      serviceName: bookingContext.serviceName,
      scheduledTime: bookingContext.scheduledTime 
    });

    const result = await messageService.startConversation(userId, otherUserId, bookingContext);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/messages/conversations/:conversationId/messages
 * Get messages in a conversation
 */
router.get('/conversations/:conversationId/messages', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const conversationId = parseInt(req.params.conversationId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await messageService.getConversationMessages(conversationId, userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post('/conversations/:conversationId/messages', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const conversationId = parseInt(req.params.conversationId);
    const { content, messageType, mediaUrl } = req.body;

    // Emit via Socket.IO for real-time delivery
    const io = (req.app as any).get('io');
    
    const result = await messageService.sendMessage(
      conversationId,
      userId,
      content,
      messageType || 'text',
      mediaUrl || null
    );

    // Emit to recipient's room
    const conversation = await messageService.getConversationById(conversationId, userId);
    if (conversation.success) {
      const recipientId = conversation.data.conversation.user1_id === userId 
        ? conversation.data.conversation.user2_id 
        : conversation.data.conversation.user1_id;
      
      io.to(`user-${recipientId}`).emit('new-message', result.data.message);
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/messages/conversations/:conversationId/read
 * Mark conversation as read
 */
router.put('/conversations/:conversationId/read', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const conversationId = parseInt(req.params.conversationId);

    const result = await messageService.markConversationAsRead(conversationId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/messages/conversations/:conversationId
 * Delete a conversation
 */
router.delete('/conversations/:conversationId', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const conversationId = parseInt(req.params.conversationId);

    // Get conversation details before deleting to notify the other user
    const convResult = await pool.query(
      `SELECT c.*, c.service_name, c.booking_status,
              u1.first_name as user1_first_name, u1.last_name as user1_last_name,
              u2.first_name as user2_first_name, u2.last_name as user2_last_name
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (convResult.rows.length > 0) {
      const conv = convResult.rows[0];
      const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const deletingUserName = conv.user1_id === userId 
        ? `${conv.user1_first_name} ${conv.user1_last_name}`
        : `${conv.user2_first_name} ${conv.user2_last_name}`;
      const serviceName = conv.service_name || 'a service';

      // Create notification for the other user (if table exists)
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            otherUserId,
            'booking_cancelled',
            'Booking Cancelled',
            `${deletingUserName} has cancelled the conversation about ${serviceName}.`,
            JSON.stringify({
              conversation_id: conversationId,
              service_name: conv.service_name,
              cancelled_by: userId,
            }),
          ]
        );
      } catch (notifError) {
        // Don't fail the delete if notification fails (table might not exist)
        console.warn('Failed to create cancellation notification:', notifError);
      }
    }

    const result = await messageService.deleteConversation(conversationId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/messages/unread-count
 * Get unread message count for badge
 */
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const count = await messageService.getUnreadMessageCount(userId);
    
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/messages/stats
 * Get message statistics
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const result = await messageService.getMessageStats(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

