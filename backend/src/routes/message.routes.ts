/**
 * Message Routes for CampusCuts
 * Handles real-time messaging between students and barbers
 */

import express from 'express';
import messageService from '../services/message.service';
import imageService from '../services/image.service';
import { authenticate, syncRequestUserRoleFromDb, AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { uploadToIPFS } from '../services/ipfs.service';
import { logger } from '../utils/logger';
import {
  createContentReport,
  createUserBlock,
  isUgcModerationSchemaReady,
  listBlockedServiceProviders,
  listBlockedUserIds,
  notifyDeveloperOfBlock,
  removeUserBlock,
} from '../services/ugc-moderation.service';

const router = express.Router();

/** Accept `image` or `file` field (iOS clients vary). */
const uploadChatImageMiddleware = imageService.upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

/** Shared Socket.IO emit for POST /messages and POST …/upload (image persisted as a message row). */
async function emitNewMessageSocket(
  app: express.Application,
  conversationId: number,
  senderUserId: string,
  messagePayload: Record<string, unknown>
): Promise<void> {
  const io = (app as any).get('io');
  if (!io) return;
  const conversation = await messageService.getConversationById(conversationId, senderUserId);
  if (!conversation.success) return;
  const conv = conversation.data.conversation;
  const recipientId =
    String(conv.user1_id) === String(senderUserId) ? conv.user2_id : conv.user1_id;
  console.log(`📨 Socket.IO: Emitting new-message to user-${recipientId} (sender: ${senderUserId})`);
  io.to(`user-${recipientId}`).emit('new-message', messagePayload);
  const convRoom = `conversation-${conversationId}`;
  io.to(convRoom).emit('new-message', messagePayload);
  console.log(`📨 Socket.IO: Emitting new-message to ${convRoom}`);
}

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
    const body = req.body as Record<string, unknown>;
    const content = body.content as string | undefined;
    const messageType = String(body.messageType ?? body.message_type ?? 'text');
    const mediaUrlRaw = body.mediaUrl ?? body.media_url;
    const mediaUrl =
      mediaUrlRaw != null && String(mediaUrlRaw).trim() !== ''
        ? String(mediaUrlRaw).trim()
        : null;

    const result = await messageService.sendMessage(
      conversationId,
      userId,
      content,
      messageType,
      mediaUrl
    );

    await emitNewMessageSocket(req.app, conversationId, userId, result.data.message);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/conversations/:conversationId/upload
 * Upload a chat image (multipart) and return its URL. Does not create a message — clients should show a
 * composer preview and send via POST …/messages when the user taps Send.
 *
 * Optional `send=true` (body or query) persists and broadcasts immediately (legacy clients only).
 * Optional multipart `caption` is used when `send=true` (default preview: "📷 Photo").
 */
router.post(
  '/conversations/:conversationId/upload',
  authenticate,
  uploadChatImageMiddleware,
  async (req, res, next) => {
    try {
      const userId = (req as any).user.userId;
      const conversationId = parseInt(req.params.conversationId, 10);
      const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
      const file = files?.image?.[0] ?? files?.file?.[0];

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image provided (use form field "image" or "file")' },
        });
      }

      const convCheck = await pool.query(
        `SELECT id FROM conversations
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND is_active = true`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'Conversation not found or access denied' },
        });
      }

      const processed = await imageService.processAndSaveImage(file.buffer, 'chat', {
        width: 800,
        height: 800,
        quality: 80,
      });

      const mediaUrl = imageService.generateImageUrl(processed.original);

      const responseData: Record<string, unknown> = {
        url: mediaUrl,
        filename: processed.original,
      };

      if (process.env.USE_IPFS === 'true') {
        try {
          const ipfsResult = await uploadToIPFS(file.buffer, file.originalname, {
            name: `Chat Image - ${userId}`,
            keyvalues: {
              userId,
              type: 'chat',
              conversationId: String(conversationId),
              timestamp: Date.now(),
            },
          });

          if (ipfsResult.success) {
            responseData.ipfs = {
              localCID: ipfsResult.localCID,
              pinataCID: ipfsResult.pinataCID,
              gatewayUrl: ipfsResult.gatewayUrl,
              ipfsUrl: ipfsResult.ipfsUrl,
            };
            logger.info(`Chat image uploaded to IPFS (conversation ${conversationId}): ${ipfsResult.pinataCID}`);
          }
        } catch (ipfsError: unknown) {
          logger.error(`IPFS upload error:`, ipfsError instanceof Error ? ipfsError.message : ipfsError);
        }
      }

      const sendImmediately =
        req.query.send === 'true' ||
        (req.body as { send?: string | boolean }).send === true ||
        (req.body as { send?: string | boolean }).send === 'true';

      if (sendImmediately) {
        const caption =
          typeof (req.body as { caption?: string }).caption === 'string'
            ? (req.body as { caption: string }).caption.trim()
            : '';
        const contentForMessage = caption || '📷 Photo';

        const sendResult = await messageService.sendMessage(
          conversationId,
          userId,
          contentForMessage,
          'image',
          mediaUrl
        );

        await emitNewMessageSocket(req.app, conversationId, userId, sendResult.data.message);

        return res.json({
          success: true,
          message: 'Chat image uploaded and sent successfully',
          data: {
            ...responseData,
            message: sendResult.data.message,
          },
        });
      }

      res.json({
        success: true,
        message: 'Chat image uploaded successfully',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  }
);

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
 * POST /api/messages/conversations/:conversationId/report
 * Same as POST /messages/reports but conversation id comes from the URL (Intera / mobile clients).
 * Body: { reason, detail?, messageId? | message_id?, reportedUserId? | reported_user_id? }
 * If reported user id is omitted, the other participant in the thread is inferred.
 */
router.post('/conversations/:conversationId/report', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId as string;
    const conversationId = parseInt(req.params.conversationId, 10);
    if (Number.isNaN(conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation id' });
    }
    const {
      reportedUserId,
      reported_user_id,
      messageId,
      message_id,
      reason,
      detail,
    } = req.body as Record<string, unknown>;
    let targetUser = (reportedUserId ?? reported_user_id) as string | undefined;

    if (!targetUser?.trim()) {
      const conv = await pool.query(
        `SELECT user1_id, user2_id FROM conversations
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [conversationId, userId]
      );
      if (conv.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'Conversation not found or access denied' },
        });
      }
      const row = conv.rows[0];
      targetUser =
        String(row.user1_id) === String(userId) ? String(row.user2_id) : String(row.user1_id);
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'reason is required' });
    }

    const msgIdRaw = messageId ?? message_id;
    const msgParsed =
      msgIdRaw === undefined || msgIdRaw === null || msgIdRaw === ''
        ? null
        : parseInt(String(msgIdRaw), 10);

    const reportId = await createContentReport({
      reporterUserId: userId,
      reportedUserId: targetUser!.trim(),
      conversationId,
      messageId: msgParsed != null && !Number.isNaN(msgParsed) ? msgParsed : null,
      reason: String(reason),
      detail: typeof detail === 'string' ? detail : null,
    });
    res.status(201).json({ success: true, data: { reportId } });
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
      // Booking-linked threads: deleteConversation may cancel the booking and sends
      // booking_cancelled via the shared cancellation path; avoid duplicate generic notify.
      if (!conv.booking_id) {
        const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        const deletingUserName = conv.user1_id === userId 
          ? `${conv.user1_first_name} ${conv.user1_last_name}`
          : `${conv.user2_first_name} ${conv.user2_last_name}`;
        const serviceName = conv.service_name || 'a service';

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
          console.warn('Failed to create cancellation notification:', notifError);
        }
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

/** Peer block: only these two users stop interacting (symmetric). Not a global platform ban. */
async function postUserBlockHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const userId = (req as any).user.userId as string;
    const blockedUserId = (req.body.blockedUserId ?? req.body.blocked_user_id) as string | undefined;
    if (!blockedUserId?.trim()) {
      return res.status(400).json({ success: false, error: 'blockedUserId is required' });
    }
    await createUserBlock(userId, blockedUserId.trim());
    await notifyDeveloperOfBlock({ blockerUserId: userId, blockedUserId: blockedUserId.trim() });
    const io = (req as any).app.get('io') as { to: (room: string) => { emit: (ev: string, data: unknown) => void } } | undefined;
    if (io) {
      io.to(`user-${blockedUserId.trim()}`).emit('ugc-block-updated', {
        type: 'blocked_by_peer',
        blockerUserId: userId,
      });
      io.to(`user-${userId}`).emit('ugc-block-updated', {
        type: 'i_blocked_user',
        blockedUserId: blockedUserId.trim(),
      });
    }
    res.status(201).json({ success: true, message: 'User blocked' });
  } catch (error) {
    next(error);
  }
}

/** User blocks another user (UGC safety); notifies developer and signals clients to refresh. */
router.post('/blocks', authenticate, postUserBlockHandler);

/** Alias for older clients that POST `/block` (singular). Same peer-block semantics as `/blocks`. */
router.post('/block', authenticate, postUserBlockHandler);

router.delete('/blocks/:blockedUserId', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId as string;
    const { blockedUserId } = req.params;
    if (!blockedUserId) {
      return res.status(400).json({ success: false, error: 'blockedUserId is required' });
    }
    if (!(await isUgcModerationSchemaReady())) {
      return res.status(503).json({
        success: false,
        error: 'User blocking is not available until database migration 028 is applied.',
        code: 'UGC_SCHEMA_MISSING',
      });
    }
    const removed = await removeUserBlock(userId, blockedUserId);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'No block found for this user' });
    }
    const io = (req as any).app.get('io') as { to: (room: string) => { emit: (ev: string, data: unknown) => void } } | undefined;
    if (io) {
      io.to(`user-${blockedUserId}`).emit('ugc-block-updated', {
        type: 'unblocked_by_peer',
        blockerUserId: userId,
      });
      io.to(`user-${userId}`).emit('ugc-block-updated', {
        type: 'i_unblocked_user',
        blockedUserId,
      });
    }
    res.json({ success: true, message: 'Block removed' });
  } catch (error) {
    next(error);
  }
});

router.get('/blocks', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId as string;
    const blockedUserIds = await listBlockedUserIds(userId);
    res.json({ success: true, data: { blockedUserIds } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/messages/blocks/service-providers
 * Outgoing peer blocks where the blocked account has a barber profile (for consumer “blocked providers” UI).
 */
router.get('/blocks/service-providers', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId as string;
    if (!(await isUgcModerationSchemaReady())) {
      return res.status(503).json({
        success: false,
        error: 'User blocking is not available until database migration 028 is applied.',
        code: 'UGC_SCHEMA_MISSING',
      });
    }
    const blocked = await listBlockedServiceProviders(userId);
    res.json({
      success: true,
      data: {
        blockedServiceProviders: blocked.map((row) => ({
          blockedUserId: row.blockedUserId,
          barberId: row.barberRecordId,
          blockedAt: row.blockedAt,
          firstName: row.firstName,
          lastName: row.lastName,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          email: row.email,
          campusId: row.campusId,
          barberIsActive: row.barberIsActive,
          name:
            row.displayName?.trim() ||
            `${row.firstName || ''} ${row.lastName || ''}`.trim() ||
            'Service provider',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/** Report objectionable message / user in a conversation (developer alert email when configured). */
router.post('/reports', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId as string;
    const {
      reportedUserId,
      reported_user_id,
      conversationId,
      conversation_id,
      messageId,
      message_id,
      reason,
      detail,
    } = req.body as Record<string, unknown>;
    const targetUser = (reportedUserId ?? reported_user_id) as string | undefined;
    const convIdRaw = conversationId ?? conversation_id;
    const msgIdRaw = messageId ?? message_id;
    if (!targetUser?.trim() || !reason || typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reportedUserId and reason are required',
      });
    }
    const convParsed =
      convIdRaw === undefined || convIdRaw === null || convIdRaw === ''
        ? null
        : parseInt(String(convIdRaw), 10);
    const msgParsed =
      msgIdRaw === undefined || msgIdRaw === null || msgIdRaw === ''
        ? null
        : parseInt(String(msgIdRaw), 10);
    const reportId = await createContentReport({
      reporterUserId: userId,
      reportedUserId: targetUser.trim(),
      conversationId: convParsed != null && !Number.isNaN(convParsed) ? convParsed : null,
      messageId: msgParsed != null && !Number.isNaN(msgParsed) ? msgParsed : null,
      reason: String(reason),
      detail: typeof detail === 'string' ? detail : null,
    });
    res.status(201).json({ success: true, data: { reportId } });
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

// ============================================================================
// BARBER - ADMIN DIRECT MESSAGING (legacy path: /cm-barber)
// ============================================================================

/**
 * POST /api/messages/cm-barber
 * Start or get a direct conversation between barber and platform admin
 * No booking required - this is for general communication
 */
router.post('/cm-barber', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    await syncRequestUserRoleFromDb(authReq);

    const userResult = await pool.query(
      `SELECT u.id, u.role, u.first_name, u.last_name, u."avatarUrl",
              b.id as barber_id, b."campusId" as barber_campus_id
       FROM users u
       LEFT JOIN barbers b ON b."userId" = u.id AND b."isActive" = true
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];
    const isAdmin =
      user.role === 'ADMIN' || authReq.user!.role?.toLowerCase() === 'admin';
    const campusId = user.barber_campus_id;

    // Barbers need an active campus; admins do not need one on their account.
    if (!isAdmin && !campusId) {
      return res.status(400).json({ success: false, error: 'You must be an active barber associated with a campus to use this feature' });
    }

    let otherUserId: string | undefined;

    if (isAdmin) {
      otherUserId = req.body.barberUserId ?? req.body.barber_user_id;
      if (!otherUserId) {
        return res.status(400).json({ success: false, error: 'barberUserId is required for admin users' });
      }
      if (otherUserId === userId) {
        return res.status(400).json({ success: false, error: 'Cannot start a support chat with yourself' });
      }

      const barberTarget = await pool.query(
        `SELECT u.id
         FROM users u
         INNER JOIN barbers b ON b."userId" = u.id
         WHERE u.id = $1
           AND COALESCE(u."isBanned", false) = false`,
        [otherUserId]
      );
      if (barberTarget.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Barber not found' });
      }
    } else {
      const adminResult = await pool.query(
        `SELECT u.id as user_id
         FROM users u
         WHERE u.role = 'ADMIN' AND u.id != $1
         ORDER BY u."createdAt" ASC
         LIMIT 1`,
        [userId]
      );

      if (adminResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No platform admin available for support' });
      }

      otherUserId = adminResult.rows[0].user_id;
    }

    if (!otherUserId) {
      return res.status(400).json({ success: false, error: 'Could not determine conversation partner' });
    }

    const existingConv = await pool.query(
      `SELECT * FROM conversations 
       WHERE booking_id IS NULL 
         AND is_active = true
         AND ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
       LIMIT 1`,
      [userId, otherUserId]
    );

    if (existingConv.rows.length > 0) {
      const conv = existingConv.rows[0];
      return res.json({
        success: true,
        data: {
          conversation: {
            id: conv.id,
            otherUserId: otherUserId,
            isNew: false
          }
        }
      });
    }

    const newConv = await pool.query(
      `INSERT INTO conversations (user1_id, user2_id, booking_id, is_active, created_at, updated_at)
       VALUES ($1, $2, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, otherUserId]
    );

    res.status(201).json({
      success: true,
      data: {
        conversation: {
          id: newConv.rows[0].id,
          otherUserId: otherUserId,
          isNew: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/messages/cm-barber/conversations
 * List barber support chats (admin only)
 */
router.get('/cm-barber/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const queryCampusId = req.query.campusId as string | undefined;

    const adminCheck = await pool.query(
      `SELECT u.role FROM users u WHERE u.id = $1 AND u.role = 'ADMIN'`,
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    if (!queryCampusId) {
      return res.status(400).json({ success: false, error: 'campusId query parameter is required' });
    }

    const campusId = queryCampusId;

    const peerBarberHideCm = (await isUgcModerationSchemaReady())
      ? ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_user_id = $1::uuid AND ub.blocked_user_id = u.id)
           OR (ub.blocker_user_id = u.id AND ub.blocked_user_id = $1::uuid)
      )`
      : '';

    const barbersResult = await pool.query(
      `SELECT 
         u.id as user_id,
         u.first_name,
         u.last_name,
         u."avatarUrl",
         u.email,
         b.id as barber_id,
         c.id as conversation_id,
         (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false)::int as unread_count
       FROM barbers b
       JOIN users u ON b."userId" = u.id
       LEFT JOIN conversations c ON c.booking_id IS NULL 
         AND c.is_active = true
         AND ((c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1))
       WHERE b."campusId" = $2 
         AND b."userId" != $1
         AND u.role = 'BARBER'
         AND (u."isBanned" IS NOT TRUE)
         ${peerBarberHideCm}
       ORDER BY COALESCE(c.last_message_at, b."createdAt") DESC`,
      [userId, campusId]
    );

    res.json({
      success: true,
      data: {
        barbers: barbersResult.rows.map(row => ({
          userId: row.user_id,
          barberId: row.barber_id,
          firstName: row.first_name,
          lastName: row.last_name,
          name: `${row.first_name} ${row.last_name}`,
          avatarUrl: row.avatarUrl,
          email: row.email,
          conversationId: row.conversation_id,
          lastMessage: row.last_message,
          lastMessageAt: row.last_message_at,
          unreadCount: row.unread_count || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// BARBER-TO-BARBER DIRECT MESSAGING
// ============================================================================

/**
 * GET /api/messages/barber-chats/barbers
 * Get all other barbers on the same campus for barber-to-barber chat
 * Admins can optionally specify a campusId to view barbers from any campus
 */
router.get('/barber-chats/barbers', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const requestedCampusId = req.query.campusId as string | undefined;

    // Get user's info and role
    const userResult = await pool.query(
      `SELECT u.role, b.id as barber_id, COALESCE(b."campusId", u."campusId") as "campusId"
       FROM users u
       LEFT JOIN barbers b ON b."userId" = u.id
       WHERE u.id = $1 
         AND (
           (b."isActive" = true AND u.role IN ('BARBER', 'ADMIN', 'CAMPUS_MANAGER'))
           OR u.role = 'ADMIN'
         )`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Only barbers can access this endpoint' });
    }

    const userRole = userResult.rows[0].role;
    const userCampusId = userResult.rows[0].campusId;

    // Admins can view any campus, others can only view their own
    let campusId: string;
    if (requestedCampusId && userRole === 'ADMIN') {
      campusId = requestedCampusId;
    } else {
      campusId = userCampusId;
    }

    if (!campusId) {
      return res.status(400).json({ success: false, error: 'You must be associated with a campus to view barber chats' });
    }

    const peerBarberHideB2b = (await isUgcModerationSchemaReady())
      ? ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_user_id = $1::uuid AND ub.blocked_user_id = u.id)
           OR (ub.blocker_user_id = u.id AND ub.blocked_user_id = $1::uuid)
      )`
      : '';

    const isAdminViewer = userRole === 'ADMIN';
    const barberVisibilitySql = isAdminViewer
      ? ''
      : ` AND b."isActive" = true 
         AND u.stripe_account_id IS NOT NULL
         AND u.stripe_payouts_enabled = true`;

    // Get barbers on the same campus (excluding self). Admins see hidden barbers too.
    const barbersResult = await pool.query(
      `SELECT 
         u.id as user_id,
         u.first_name,
         u.last_name,
         u."avatarUrl",
         u.email,
         b.id as barber_id,
         c.id as conversation_id,
         (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false)::int as unread_count
       FROM barbers b
       JOIN users u ON b."userId" = u.id
       LEFT JOIN conversations c ON c.booking_id IS NULL 
         AND c.is_active = true
         AND ((c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1))
       WHERE b."campusId" = $2 
         AND b."userId" != $1
         AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
         AND (u."isBanned" IS NOT TRUE)
         ${barberVisibilitySql}
         ${peerBarberHideB2b}
       ORDER BY COALESCE(c.last_message_at, b."createdAt") DESC`,
      [userId, campusId]
    );

    res.json({
      success: true,
      data: {
        barbers: barbersResult.rows.map(row => ({
          userId: row.user_id,
          barberId: row.barber_id,
          firstName: row.first_name,
          lastName: row.last_name,
          name: `${row.first_name} ${row.last_name}`,
          avatarUrl: row.avatarUrl,
          email: row.email,
          conversationId: row.conversation_id,
          lastMessage: row.last_message,
          lastMessageAt: row.last_message_at,
          unreadCount: row.unread_count || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/barber-chats
 * Start or get a direct conversation between two barbers
 */
router.post('/barber-chats', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    await syncRequestUserRoleFromDb(authReq);
    const { otherBarberUserId } = req.body;

    if (!otherBarberUserId) {
      return res.status(400).json({ success: false, error: 'otherBarberUserId is required' });
    }

    const callerResult = await pool.query(
      `SELECT u.role FROM users u WHERE u.id = $1`,
      [userId]
    );
    const isAdmin =
      callerResult.rows[0]?.role === 'ADMIN' ||
      authReq.user!.role?.toLowerCase() === 'admin';

    if (isAdmin) {
      const targetResult = await pool.query(
        `SELECT u.id
         FROM users u
         INNER JOIN barbers b ON b."userId" = u.id
         WHERE u.id = $1
           AND COALESCE(u."isBanned", false) = false`,
        [otherBarberUserId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Barber not found' });
      }
    } else {
      // Verify both users are active barbers on the same campus
      const verifyResult = await pool.query(
        `SELECT 
           COALESCE(b1."campusId", u1."campusId") as user_campus, 
           COALESCE(b2."campusId", u2."campusId") as other_campus
         FROM users u1
         LEFT JOIN barbers b1 ON b1."userId" = u1.id
         CROSS JOIN users u2
         LEFT JOIN barbers b2 ON b2."userId" = u2.id
         WHERE u1.id = $1 AND u2.id = $2
           AND (
             (b1."isActive" = true AND u1.role IN ('BARBER', 'ADMIN', 'CAMPUS_MANAGER'))
             OR u1.role = 'ADMIN'
           )
           AND (
             (b2."isActive" = true AND u2.role IN ('BARBER', 'ADMIN', 'CAMPUS_MANAGER'))
             OR u2.role = 'ADMIN'
           )`,
        [userId, otherBarberUserId]
      );

      if (verifyResult.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Both users must be barbers' });
      }

      if (verifyResult.rows[0].user_campus !== verifyResult.rows[0].other_campus) {
        return res.status(403).json({ success: false, error: 'Both barbers must be on the same campus' });
      }
    }

    // Check if conversation already exists (booking_id = NULL for direct chats)
    // Only find active conversations - deleted ones (is_active = false) should allow new conversation creation
    const existingConv = await pool.query(
      `SELECT * FROM conversations 
       WHERE booking_id IS NULL 
         AND is_active = true
         AND ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
       LIMIT 1`,
      [userId, otherBarberUserId]
    );

    if (existingConv.rows.length > 0) {
      const conv = existingConv.rows[0];
      return res.json({
        success: true,
        data: {
          conversation: {
            id: conv.id,
            otherUserId: otherBarberUserId,
            isNew: false
          }
        }
      });
    }

    // Create new barber-to-barber conversation
    const newConv = await pool.query(
      `INSERT INTO conversations (user1_id, user2_id, booking_id, is_active, created_at, updated_at)
       VALUES ($1, $2, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, otherBarberUserId]
    );

    res.status(201).json({
      success: true,
      data: {
        conversation: {
          id: newConv.rows[0].id,
          otherUserId: otherBarberUserId,
          isNew: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

