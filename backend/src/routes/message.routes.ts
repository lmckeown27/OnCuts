/**
 * Message Routes for CampusCuts
 * Handles real-time messaging between students and barbers
 */

import express from 'express';
import messageService from '../services/message.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/messages/conversations
 * Get user's conversations with pagination
 */
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await messageService.getUserConversations(userId, page, limit);
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
    const conversationId = parseInt(req.params.conversationId);

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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
    const result = await messageService.getMessageStats(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

