/**
 * Messaging Service for CampusCuts
 * Transferred from CampusKinect with CampusCuts adaptations
 * 
 * Handles:
 * - Booking-centric conversations (student ↔ barber)
 * - Real-time chat messages
 * - Unread message tracking
 * - Message requests (first contact)
 * - Push notification integration
 */

import { pool } from '../database/connection';
import { redisGet, redisSet, redisDel, generateCacheKey, CACHE_TTL } from '../config/redis';
import pushNotificationService from './pushNotification.service';
import notificationService from './notification.service';

class MessageService {
  /**
   * Get user's conversations with pagination
   * Booking-centric: Shows service context for each conversation
   */
  async getUserConversations(userId: string | number, page: number = 1, limit: number = 20): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      // Get conversations with booking details
      const result = await pool.query(
        `SELECT 
          c.id as conversation_id,
          c.booking_id,
          c.created_at as conversation_created,
          c.last_message_at,
          
          -- OTHER USER INFO
          CASE 
            WHEN c.user1_id = $1 THEN c.user2_id
            ELSE c.user1_id
          END as other_user_id,
          u.first_name as other_user_first_name,
          u.last_name as other_user_last_name,
          u."avatarUrl" as other_user_profile_picture,
          CASE WHEN br.id IS NOT NULL THEN 'barber' ELSE COALESCE(u.user_type, u.role, 'consumer') END as other_user_type,
          
          -- BARBER INFO (if other user is barber)
          br.id as barber_id,
          u.first_name || ' ' || u.last_name as barber_display_name,
          br.specialties as barber_specialties,
          br."avgRating" as barber_rating,
          
          -- BOOKING INFO (from conversation context or linked booking)
          c.service_name as conv_service_name,
          c.service_price as conv_service_price,
          c.scheduled_time as conv_scheduled_time,
          c.location as conv_location,
          c.notes as conv_notes,
          c.booking_status as conv_booking_status,
          c.barber_name as conv_barber_name,
          c.consumer_name as conv_consumer_name,
          -- Fallback to linked booking if exists
          b.id as booking_id_ref,
          b."serviceType" as booking_service_type,
          b."priceUsdCents" as booking_price_cents,
          b."requestedAt" as booking_scheduled_time,
          b.status as linked_booking_status,
          
          -- MESSAGE INFO
          (
            SELECT m.content 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as last_message,
          (
            SELECT m.sender_id 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as last_message_sender_id,
          (
            SELECT m.created_at 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            ORDER BY m.created_at DESC 
            LIMIT 1
          ) as last_message_time,
          (
            SELECT COUNT(*) 
            FROM messages m 
            WHERE m.conversation_id = c.id 
            AND m.sender_id != $1 
            AND m.is_read = false
          ) as unread_count
        FROM conversations c
        JOIN users u ON (
          CASE 
            WHEN c.user1_id = $1 THEN c.user2_id
            ELSE c.user1_id
          END = u.id
        )
        LEFT JOIN barbers br ON u.id = br."userId"
        LEFT JOIN bookings b ON c.booking_id = b.id
        WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.is_active = true
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM conversations WHERE user1_id = $1 OR user2_id = $1`,
        [userId]
      );

      const total = parseInt(countResult.rows[0].total);

      // Format conversations
      const conversations = result.rows.map((conv) => ({
        id: conv.conversation_id,
        bookingId: conv.booking_id,
        // Booking details - prefer conversation context, fallback to linked booking
        booking: (conv.conv_service_name || conv.booking_id_ref) ? {
          id: conv.booking_id_ref || null,
          barberId: conv.barber_id || null, // Include barber ID for availability lookups
          serviceName: conv.conv_service_name || conv.booking_service_type || 'Service',
          servicePrice: conv.conv_service_price ? parseFloat(conv.conv_service_price) : 
                       (conv.booking_price_cents ? (conv.booking_price_cents / 100) : null),
          // Prefer booking's requestedAt (source of truth) over conversation's cached scheduled_time
          scheduledTime: conv.booking_scheduled_time || conv.conv_scheduled_time || conv.availability_start_time,
          // Prefer booking's location from conversation (updated on edit) or fallback
          location: conv.conv_location || 'TBD',
          notes: conv.conv_notes || null,
          // Prefer linked booking status (source of truth) over cached conversation status
          status: (conv.linked_booking_status || conv.conv_booking_status || 'pending').toLowerCase(),
          barberName: conv.conv_barber_name,
          consumerName: conv.conv_consumer_name,
        } : null,
        // Other user info
        otherUser: {
          id: conv.other_user_id,
          firstName: conv.other_user_first_name,
          lastName: conv.other_user_last_name,
          displayName: conv.barber_display_name || `${conv.other_user_first_name} ${conv.other_user_last_name}`,
          profilePicture: conv.other_user_profile_picture,
          userType: conv.other_user_type?.toLowerCase() || 'consumer',
          barberInfo: (conv.other_user_type === 'BARBER' || conv.other_user_type === 'barber')
            ? {
                id: conv.barber_id, // Barber table ID for availability lookups
                displayName: conv.barber_display_name,
                specialties: conv.barber_specialties,
                rating: conv.barber_rating,
              }
            : null,
        },
        lastMessage: conv.last_message
          ? {
              content: conv.last_message,
              senderId: conv.last_message_sender_id,
              time: conv.last_message_time,
            }
          : null,
        unreadCount: parseInt(conv.unread_count) || 0,
        createdAt: conv.conversation_created,
      }));

      return {
        success: true,
        data: {
          conversations,
          pagination: {
            page: parseInt(page.toString()),
            limit: parseInt(limit.toString()),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error: any) {
      console.error('Get conversations error:', error.message || error);
      throw new Error(`Failed to fetch conversations: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get messages in a conversation
   */
  async getConversationMessages(
    conversationId: string | number,
    userId: string | number,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    try {
      // Check if user is part of this conversation
      const convCheck = await pool.query(
        `SELECT id FROM conversations 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        throw new Error('Access denied to this conversation');
      }

      const offset = (page - 1) * limit;

      // Get messages
      const result = await pool.query(
        `SELECT 
          m.id,
          m.content,
          m.message_type,
          m.media_url,
          m.is_read,
          m.created_at,
          m.sender_id,
          u.email,
          u.first_name,
          u.last_name,
          u."avatarUrl" as profile_picture
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1 AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1 AND is_deleted = false`,
        [conversationId]
      );

      const total = parseInt(countResult.rows[0].total);

      // Mark messages as read
      const readResult = await pool.query(
        `UPDATE messages 
         SET is_read = true 
         WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
         RETURNING id`,
        [conversationId, userId]
      );

      // Update badge if messages were read
      if (readResult.rows.length > 0) {
        await pushNotificationService.updateBadgeCount(userId);
      }

      const messages = result.rows
        .map((msg) => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          conversationId: conversationId,
          messageType: msg.message_type,
          mediaUrl: msg.media_url,
          isRead: msg.is_read,
          createdAt: msg.created_at,
          sender: {
            id: msg.sender_id,
            email: msg.email,
            firstName: msg.first_name,
            lastName: msg.last_name,
            profilePicture: msg.profile_picture,
          },
          isOwn: msg.sender_id === userId,
        }))
        .reverse(); // Oldest first

      return {
        success: true,
        data: {
          messages,
          pagination: {
            page: parseInt(page.toString()),
            limit: parseInt(limit.toString()),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  /**
   * Start a booking-centric conversation
   * CampusCuts conversations are always about a scheduled service
   */
  async startConversation(
    userId: string | number, 
    otherUserId: string | number, 
    bookingContext?: {
      bookingId?: string | number;
      serviceName?: string;
      servicePrice?: number;
      scheduledTime?: string;
      location?: string;
      locationDetails?: string;
      notes?: string;
      barberName?: string;
      consumerName?: string;
      barberProfilePicture?: string;
      consumerProfilePicture?: string;
    }
  ): Promise<any> {
    try {
      if (String(otherUserId) === String(userId)) {
        throw new Error('Cannot start conversation with yourself');
      }

      // Each booking creates a UNIQUE conversation based on users + scheduled_time
      // This ensures new bookings get new conversations, not reusing old rejected ones
      const scheduledTime = bookingContext?.scheduledTime || null;

      // Only check for duplicate if we have a scheduled time (to prevent duplicate bookings for same slot)
      if (scheduledTime) {
        const existingConv = await pool.query(
          `SELECT id, is_active, booking_status FROM conversations 
           WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
           AND scheduled_time = $3`,
          [userId, otherUserId, scheduledTime]
        );

        if (existingConv.rows.length > 0) {
          const conv = existingConv.rows[0];
          
          // If same time slot exists and is active/pending, return existing
          if (conv.is_active && conv.booking_status === 'pending') {
            console.log('✅ Found existing pending conversation for same time slot:', conv.id);
            return await this.getConversationById(conv.id, userId);
          }
          // If rejected/cancelled, allow creating a new booking (don't return old one)
          console.log('📌 Previous conversation exists but was ' + conv.booking_status + ', creating new one');
        }
      }

      // Create new conversation with booking context - includes booking_id link
      const result = await pool.query(
        `INSERT INTO conversations (
          user1_id, user2_id, 
          service_name, service_price, scheduled_time, 
          location, notes, booking_status,
          barber_name, consumer_name, booking_id
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at`,
        [
          userId, 
          otherUserId, 
          bookingContext?.serviceName || null,
          bookingContext?.servicePrice || null,
          scheduledTime,
          bookingContext?.location || null,
          bookingContext?.notes || null,
          'pending',
          bookingContext?.barberName || null,
          bookingContext?.consumerName || null,
          bookingContext?.bookingId || null,  // Link to bookings table
        ]
      );

      const conversation = result.rows[0];
      console.log('✅ Created new booking-centric conversation:', conversation.id, 'with service:', bookingContext?.serviceName);

      return {
        success: true,
        message: 'Conversation started successfully',
        data: {
          conversation: {
            id: conversation.id,
            createdAt: conversation.created_at,
            booking: bookingContext ? {
              serviceName: bookingContext.serviceName,
              servicePrice: bookingContext.servicePrice,
              scheduledTime: bookingContext.scheduledTime,
              location: bookingContext.location || 'TBD',
              notes: bookingContext.notes,
              status: 'pending',
              barberName: bookingContext.barberName,
              consumerName: bookingContext.consumerName,
            } : null,
          },
        },
      };
    } catch (error) {
      console.error('Start conversation error:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId: string | number, userId: string | number): Promise<any> {
    try {
      const result = await pool.query(
        `SELECT 
          c.id as conversation_id,
          c.user1_id,
          c.user2_id,
          c.booking_id,
          c.created_at
        FROM conversations c
        WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
        [conversationId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Conversation not found or access denied');
      }

      return {
        success: true,
        data: {
          conversation: result.rows[0],
        },
      };
    } catch (error) {
      console.error('Get conversation error:', error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string | number,
    senderId: string | number,
    content: string,
    messageType: string = 'text',
    mediaUrl: string | null = null
  ): Promise<any> {
    try {
      // Check access
      const convCheck = await pool.query(
        `SELECT user1_id, user2_id FROM conversations 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [conversationId, senderId]
      );

      if (convCheck.rows.length === 0) {
        throw new Error('Access denied to this conversation');
      }

      const conversation = convCheck.rows[0];

      // Create message
      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, content, message_type, media_url, is_read, created_at`,
        [conversationId, senderId, content, messageType, mediaUrl]
      );

      const message = result.rows[0];

      // Update conversation's last_message_at
      await pool.query(
        `UPDATE conversations SET last_message_at = $1 WHERE id = $2`,
        [message.created_at, conversationId]
      );

      // Get sender info - use columns that exist in production
      const senderResult = await pool.query(
        `SELECT email, first_name, last_name, "avatarUrl" as profile_picture FROM users WHERE id = $1`,
        [senderId]
      );

      const sender = senderResult.rows[0];

      // Send push notification to recipient
      const recipientId = conversation.user1_id === senderId ? conversation.user2_id : conversation.user1_id;

      try {
        await pushNotificationService.sendMessageNotification(
          recipientId,
          `${sender.first_name} ${sender.last_name}`,
          content
        );
        
        // Also save in-app notification for the recipient
        await notificationService.saveNotification({
          userId: recipientId,
          type: 'new_message',
          title: `New message from ${sender.first_name} ${sender.last_name}`,
          message: content.length > 100 ? content.substring(0, 100) + '...' : content,
          data: { conversationId, senderId, senderName: `${sender.first_name} ${sender.last_name}` },
        });
      } catch (notificationError) {
        console.error('Failed to send push notification:', notificationError);
      }

      const formattedMessage = {
        id: message.id,
        conversation_id: conversationId,
        sender_id: senderId,
        content: message.content,
        message_type: message.message_type,
        messageType: message.message_type,
        mediaUrl: message.media_url,
        media_url: message.media_url,
        isRead: message.is_read,
        is_read: message.is_read,
        createdAt: message.created_at,
        created_at: message.created_at,
        sender: {
          id: senderId,
          email: sender.email,
          firstName: sender.first_name,
          first_name: sender.first_name,
          lastName: sender.last_name,
          last_name: sender.last_name,
          profilePicture: sender.profile_picture,
          profile_picture: sender.profile_picture,
        },
        isOwn: false, // For recipient, this is not their own message
      };

      return {
        success: true,
        message: 'Message sent successfully',
        data: {
          message: formattedMessage,
        },
      };
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId: string | number, userId: string | number): Promise<any> {
    try {
      const convCheck = await pool.query(
        `SELECT id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        throw new Error('Access denied to this conversation');
      }

      const result = await pool.query(
        `UPDATE messages 
         SET is_read = true 
         WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
         RETURNING id`,
        [conversationId, userId]
      );

      const updatedCount = result.rows.length;

      // Update badge count
      if (updatedCount > 0) {
        await pushNotificationService.updateBadgeCount(userId);
      }

      return {
        success: true,
        message: 'Messages marked as read',
        data: {
          updatedCount,
        },
      };
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string | number, userId: string | number): Promise<any> {
    try {
      const convCheck = await pool.query(
        `SELECT user1_id, user2_id FROM conversations 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        throw new Error('Access denied to this conversation');
      }

      const { user1_id, user2_id } = convCheck.rows[0];

      // Mark as inactive instead of deleting
      await pool.query(
        `UPDATE conversations SET is_active = false WHERE id = $1`,
        [conversationId]
      );

      // Update badge counts for both users
      await pushNotificationService.updateBadgeCount(user1_id);
      await pushNotificationService.updateBadgeCount(user2_id);

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      console.error('Delete conversation error:', error);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadMessageCount(userId: string | number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as unread_count
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE (c.user1_id = $1 OR c.user2_id = $1)
         AND m.sender_id != $1
         AND m.is_read = false`,
        [userId]
      );

      return parseInt(result.rows[0]?.unread_count || '0');
    } catch (error) {
      console.error('Error getting unread message count:', error);
      throw error;
    }
  }

  /**
   * Get message statistics for a user
   */
  async getMessageStats(userId: string | number): Promise<any> {
    try {
      const stats = await pool.query(
        `SELECT 
          (SELECT COUNT(*) FROM conversations WHERE user1_id = $1 OR user2_id = $1) as total_conversations,
          (SELECT COUNT(*) FROM messages WHERE sender_id = $1 AND is_deleted = false) as total_messages_sent,
          (SELECT COUNT(*) FROM messages m 
           JOIN conversations c ON m.conversation_id = c.id 
           WHERE (c.user1_id = $1 OR c.user2_id = $1) AND m.sender_id != $1 AND m.is_read = false) as total_unread`,
        [userId]
      );

      return {
        success: true,
        data: {
          totalConversations: parseInt(stats.rows[0].total_conversations),
          totalMessagesSent: parseInt(stats.rows[0].total_messages_sent),
          totalUnread: parseInt(stats.rows[0].total_unread),
        },
      };
    } catch (error) {
      console.error('Get message stats error:', error);
      throw new Error('Failed to fetch message statistics');
    }
  }
}

export default new MessageService();

