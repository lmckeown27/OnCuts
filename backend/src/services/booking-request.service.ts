/**
 * Booking Request Service (AirBnb-style)
 * 
 * Handles:
 * - Creating booking requests
 * - Accepting/rejecting requests
 * - Customer profile views
 * - Booking statistics
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

interface BookingRequest {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerProfile: any;
  barberId: string;
  serviceType: string;
  requestedDate: Date;
  requestedTime: string;
  price: number;
  location?: string | null;
  message?: string;
  status: string;
  requestedAt: Date;
}

export class BookingRequestService {
  /**
   * Create a booking request (customer initiates)
   */
  async createBookingRequest(data: {
    customerId: string;
    barberId: string;
    serviceType: string;
    requestedDate: Date;
    requestedTime: string;
    price: number;
    message?: string;
  }): Promise<{ bookingId: string; success: boolean }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create booking with 'pending' status
      const bookingResult = await client.query(`
        INSERT INTO bookings (
          customer_id,
          barber_id,
          service_type,
          booking_date,
          booking_time,
          price_charged,
          status,
          requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        RETURNING id
      `, [
        data.customerId,
        data.barberId,
        data.serviceType,
        data.requestedDate,
        data.requestedTime,
        data.price,
      ]);

      const bookingId = bookingResult.rows[0].id;

      // Add initial message if provided
      if (data.message) {
        await client.query(`
          INSERT INTO booking_messages (
            booking_id,
            sender_id,
            sender_type,
            message
          ) VALUES ($1, $2, 'customer', $3)
        `, [bookingId, data.customerId, data.message]);
      }

      // Create notification for barber
      await client.query(`
        INSERT INTO booking_request_notifications (
          user_id,
          booking_id,
          type,
          title,
          message
        ) SELECT 
          user_id,
          $1,
          'new_request',
          'New Booking Request',
          'You have a new booking request from ' || u.name
        FROM barbers b
        JOIN users u ON b.user_id = u.id
        WHERE b.barber_id = $2
      `, [bookingId, data.barberId]);

      await client.query('COMMIT');

      logger.info(`Booking request created: ${bookingId} for barber ${data.barberId}`);

      return { bookingId, success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating booking request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pending booking requests for a barber
   * Checks both the bookings table AND conversations with pending booking_status
   */
  async getBarberPendingRequests(barberIdOrUserId: string): Promise<BookingRequest[]> {
    try {
      // Check if PostgreSQL is available
      await pool.query('SELECT 1');
      
      const requests: BookingRequest[] = [];
      
      // First, try to find the barber ID - the input could be either barber ID or user ID
      let barberId = barberIdOrUserId;
      let barberUserId = barberIdOrUserId;
      
      // Check if this is a user ID by looking up the barbers table
      const barberCheck = await pool.query(
        'SELECT id, "userId" FROM barbers WHERE id = $1 OR "userId" = $1',
        [barberIdOrUserId]
      );
      
      if (barberCheck.rows.length > 0) {
        barberId = barberCheck.rows[0].id;
        barberUserId = barberCheck.rows[0].userId;
      }
      
      // Query 1: Get from bookings table (traditional flow)
      const bookingsResult = await pool.query(`
        SELECT 
          b.id as booking_id,
          b."consumerId" as customer_id,
          u.first_name || ' ' || u.last_name as customer_name,
          b."barberId" as barber_id,
          b."serviceType" as service_type,
          b."requestedAt" as requested_date,
          b."requestedAt" as requested_time,
          b."priceUsdCents" / 100.0 as price,
          b.status,
          b."createdAt" as requested_at,
          u."displayName" as display_name,
          u.bio,
          u."avatarUrl" as profile_image_url
        FROM bookings b
        JOIN users u ON b."consumerId" = u.id
        WHERE b."barberId" = $1 
          AND b.status = 'PENDING'
        ORDER BY b."createdAt" DESC
      `, [barberId]);

      bookingsResult.rows.forEach(row => {
        requests.push({
          bookingId: row.booking_id,
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerProfile: {
            displayName: row.display_name || row.customer_name,
            bio: row.bio,
            profileImageUrl: row.profile_image_url,
            stats: {
              totalBookings: 0,
              completedBookings: 0,
              cancelledBookings: 0,
              noShowCount: 0,
              avgRating: 0,
              totalReviews: 0,
              isReliable: true,
              completionRate: 100,
              responseRate: 100,
            },
          },
          barberId: row.barber_id,
          serviceType: row.service_type || 'Haircut',
          requestedDate: row.requested_date,
          requestedTime: row.requested_time,
          price: parseFloat(row.price) || 0,
          message: '',
          status: row.status,
          requestedAt: row.requested_at,
        });
      });

      // Query 2: Get from conversations with pending booking_status
      // This handles the case where consumer scheduled a service via messages
      const conversationsResult = await pool.query(`
        SELECT 
          c.id as conversation_id,
          c.user1_id,
          c.user2_id,
          c.service_name,
          c.service_price,
          c.scheduled_time,
          c.location,
          c.notes,
          c.booking_status,
          c.consumer_name,
          c.created_at,
          u.id as customer_id,
          u.first_name || ' ' || u.last_name as customer_name,
          u."displayName" as display_name,
          u.bio,
          u."avatarUrl" as profile_image_url
        FROM conversations c
        JOIN users u ON (
          CASE 
            WHEN c.user1_id = $1 THEN c.user2_id
            ELSE c.user1_id
          END = u.id
        )
        WHERE (c.user1_id = $1 OR c.user2_id = $1)
          AND c.booking_status = 'pending'
          AND c.is_active = true
          AND c.service_name IS NOT NULL
        ORDER BY c.created_at DESC
      `, [barberUserId]);

      conversationsResult.rows.forEach(row => {
        // Don't add if we already have this from bookings
        const alreadyExists = requests.some(r => r.bookingId === `conv-${row.conversation_id}`);
        if (!alreadyExists) {
          requests.push({
            bookingId: `conv-${row.conversation_id}`, // Prefix to identify it's from conversations
            customerId: row.customer_id,
            customerName: row.customer_name || row.consumer_name || 'Customer',
            customerProfile: {
              displayName: row.display_name || row.customer_name || 'Customer',
              bio: row.bio,
              profileImageUrl: row.profile_image_url,
              stats: {
                totalBookings: 0,
                completedBookings: 0,
                cancelledBookings: 0,
                noShowCount: 0,
                avgRating: 0,
                totalReviews: 0,
                isReliable: true,
                completionRate: 100,
                responseRate: 100,
              },
            },
            barberId: barberId,
            serviceType: row.service_name || 'Haircut',
            requestedDate: row.scheduled_time || row.created_at,
            requestedTime: row.scheduled_time 
              ? new Date(row.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : '',
            price: parseFloat(row.service_price) || 0,
            location: row.location || null,
            message: row.notes || '',
            status: 'pending',
            requestedAt: row.created_at,
          });
        }
      });

      logger.info(`Found ${requests.length} pending requests for barber ${barberIdOrUserId}`);
      return requests;
    } catch (error) {
      logger.error('Error getting pending requests (using empty array):', error);
      
      // Return empty array instead of mock data
      return [];
    }
  }

  /**
   * Get mock booking requests for testing without PostgreSQL
   */
  private getMockPendingRequests(barberId: string): BookingRequest[] {
    const mockRequests: BookingRequest[] = [
      {
        bookingId: 'mock-booking-1',
        customerId: 'customer-alex-2024',
        customerName: 'Alex Rivera',
        customerProfile: {
          displayName: 'Alex R.',
          bio: 'Cal Poly student, engineering major. Love a clean fade!',
          profileImageUrl: null,
          stats: {
            totalBookings: 15,
            completedBookings: 14,
            cancelledBookings: 1,
            noShowCount: 0,
            avgRating: 4.9,
            totalReviews: 12,
            isReliable: true,
            responseRate: 95,
          },
        },
        barberId,
        serviceType: 'Fade',
        requestedDate: new Date(Date.now() + 86400000), // Tomorrow
        requestedTime: '14:00',
        price: 35.00,
        message: 'Hey! Looking for a clean mid-fade. Can we do it at the campus center?',
        status: 'pending',
        requestedAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        bookingId: 'mock-booking-2',
        customerId: 'customer-jordan-2024',
        customerName: 'Jordan Lee',
        customerProfile: {
          displayName: 'Jordan L.',
          bio: 'Business major, need to look professional for interviews.',
          profileImageUrl: null,
          stats: {
            totalBookings: 8,
            completedBookings: 7,
            cancelledBookings: 0,
            noShowCount: 1,
            avgRating: 4.3,
            totalReviews: 5,
            isReliable: true,
            responseRate: 88,
          },
        },
        barberId,
        serviceType: 'Haircut',
        requestedDate: new Date(Date.now() + 172800000), // 2 days from now
        requestedTime: '10:30',
        price: 30.00,
        message: 'Need a professional cut for job interviews. Can you help?',
        status: 'pending',
        requestedAt: new Date(Date.now() - 7200000), // 2 hours ago
      },
      {
        bookingId: 'mock-booking-3',
        customerId: 'customer-sam-2024',
        customerName: 'Sam Martinez',
        customerProfile: {
          displayName: 'Sam M.',
          bio: null,
          profileImageUrl: null,
          stats: {
            totalBookings: 3,
            completedBookings: 2,
            cancelledBookings: 0,
            noShowCount: 1,
            avgRating: 3.5,
            totalReviews: 2,
            isReliable: false,
            responseRate: 67,
          },
        },
        barberId,
        serviceType: 'Full Service',
        requestedDate: new Date(Date.now() + 259200000), // 3 days from now
        requestedTime: '16:00',
        price: 50.00,
        message: 'Haircut and beard trim please. My dorm room works.',
        status: 'pending',
        requestedAt: new Date(Date.now() - 10800000), // 3 hours ago
      },
    ];

    logger.info(`Returning ${mockRequests.length} mock booking requests for barber ${barberId}`);
    return mockRequests;
  }

  /**
   * Accept a booking request
   * Handles both traditional bookings and conversation-based requests
   */
  async acceptBookingRequest(
    bookingId: string,
    barberId: string,
    message?: string
  ): Promise<{ success: boolean }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if this is a conversation-based request
      if (bookingId.startsWith('conv-')) {
        const conversationId = bookingId.replace('conv-', '');
        
        // Update conversation booking_status
        const updateResult = await client.query(`
          UPDATE conversations
          SET 
            booking_status = 'accepted',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND booking_status = 'pending'
          RETURNING user1_id, user2_id
        `, [conversationId]);

        if (updateResult.rows.length === 0) {
          throw new Error('Conversation not found or already responded to');
        }

        await client.query('COMMIT');
        logger.info(`Conversation ${conversationId} booking accepted by barber ${barberId}`);
        return { success: true };
      }

      // Traditional booking flow
      const updateResult = await client.query(`
        UPDATE bookings
        SET 
          status = 'ACCEPTED',
          "acceptedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING "consumerId"
      `, [bookingId]);

      if (updateResult.rows.length === 0) {
        throw new Error('Booking not found or already responded to');
      }

      await client.query('COMMIT');
      logger.info(`Booking ${bookingId} accepted by barber ${barberId}`);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error accepting booking request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a booking request
   * Handles both traditional bookings and conversation-based requests
   */
  async rejectBookingRequest(
    bookingId: string,
    barberId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if this is a conversation-based request
      if (bookingId.startsWith('conv-')) {
        const conversationId = bookingId.replace('conv-', '');
        
        // Update conversation booking_status
        const updateResult = await client.query(`
          UPDATE conversations
          SET 
            booking_status = 'rejected',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND booking_status = 'pending'
          RETURNING user1_id, user2_id
        `, [conversationId]);

        if (updateResult.rows.length === 0) {
          throw new Error('Conversation not found or already responded to');
        }

        // Get barber's user ID
        const barberResult = await client.query(
          'SELECT "userId" FROM barbers WHERE id = $1 OR "userId" = $1',
          [barberId]
        );
        const barberUserId = barberResult.rows[0]?.userId || barberId;

        // Add system message to conversation about the decline
        const declineMessage = reason 
          ? `The barber has declined your service request. Reason: ${reason}\n\nIf you believe this was a mistake or you were unfairly rejected, please email campuscuthelp@gmail.com`
          : `The barber has declined your service request.\n\nIf you believe this was a mistake or you were unfairly rejected, please email campuscuthelp@gmail.com`;

        await client.query(`
          INSERT INTO messages (conversation_id, sender_id, content, message_type)
          VALUES ($1, $2, $3, 'system')
        `, [conversationId, barberUserId, declineMessage]);

        // Update conversation's last_message_at
        await client.query(`
          UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [conversationId]);

        await client.query('COMMIT');
        logger.info(`Conversation ${conversationId} booking rejected by barber ${barberId}`);
        return { success: true };
      }

      // Traditional booking flow
      const updateResult = await client.query(`
        UPDATE bookings
        SET 
          status = 'CANCELLED',
          "cancelledAt" = NOW(),
          "cancellationReason" = $2,
          "updatedAt" = NOW()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING "consumerId"
      `, [bookingId, reason]);

      if (updateResult.rows.length === 0) {
        throw new Error('Booking not found or already responded to');
      }

      await client.query('COMMIT');
      logger.info(`Booking ${bookingId} rejected by barber ${barberId}`);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error rejecting booking request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get customer profile (for barber view)
   */
  async getCustomerProfile(customerId: string, viewingBarberId: string) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          cp.display_name,
          cp.bio,
          cp.profile_image_url,
          cp.verified,
          cp.total_bookings,
          cp.completed_bookings,
          cp.cancelled_bookings,
          cp.no_show_count,
          cp.avg_rating,
          cp.total_reviews,
          cp.is_reliable,
          cp.response_rate,
          cp.created_at as member_since,
          -- Get reviews from this barber about this customer
          (SELECT json_agg(json_build_object(
            'rating', rating,
            'comment', comment,
            'showedUp', showed_up,
            'wasOnTime', was_on_time,
            'wasRespectful', was_respectful,
            'createdAt', created_at
          ))
          FROM customer_reviews
          WHERE customer_id = $1 AND barber_id = $2) as previous_reviews
        FROM users u
        LEFT JOIN customer_profiles cp ON u.id = cp.user_id
        WHERE u.id = $1
      `, [customerId, viewingBarberId]);

      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }

      const profile = result.rows[0];

      return {
        id: profile.id,
        name: profile.name,
        displayName: profile.display_name || profile.name,
        bio: profile.bio,
        profileImageUrl: profile.profile_image_url,
        verified: profile.verified,
        memberSince: profile.member_since,
        stats: {
          totalBookings: parseInt(profile.total_bookings) || 0,
          completedBookings: parseInt(profile.completed_bookings) || 0,
          cancelledBookings: parseInt(profile.cancelled_bookings) || 0,
          noShowCount: parseInt(profile.no_show_count) || 0,
          avgRating: parseFloat(profile.avg_rating) || 0,
          totalReviews: parseInt(profile.total_reviews) || 0,
          completionRate: profile.total_bookings > 0
            ? Math.round((profile.completed_bookings / profile.total_bookings) * 100)
            : 0,
          isReliable: profile.is_reliable !== false,
          responseRate: parseFloat(profile.response_rate) || 100,
        },
        previousReviews: profile.previous_reviews || [],
      };
    } catch (error) {
      logger.error('Error getting customer profile (using mock data):', error);
      
      // Return mock customer profile
      return {
        id: customerId,
        name: 'Mock Customer',
        displayName: 'Mock Student',
        bio: 'This is a mock customer profile. Connect PostgreSQL to see real data.',
        profileImageUrl: null,
        verified: false,
        memberSince: new Date('2024-09-01'),
        stats: {
          totalBookings: 10,
          completedBookings: 9,
          cancelledBookings: 1,
          noShowCount: 0,
          avgRating: 4.5,
          totalReviews: 8,
          completionRate: 90,
          isReliable: true,
          responseRate: 95,
        },
        previousReviews: [],
      };
    }
  }

  /**
   * Get customer's pending and active bookings
   */
  async getCustomerBookingStatus(customerId: string) {
    try {
      const result = await pool.query(`
        SELECT 
          b.id,
          b.status,
          b.service_type,
          b.booking_date,
          b.booking_time,
          b.price_charged,
          b.requested_at,
          b.responded_at,
          ba.barber_id,
          u.name as barber_name,
          (SELECT COUNT(*) FROM booking_messages 
           WHERE booking_id = b.id AND read = false AND sender_type = 'barber') as unread_messages
        FROM bookings b
        JOIN barbers ba ON b.barber_id = ba.barber_id
        JOIN users u ON ba.user_id = u.id
        WHERE b.customer_id = $1
          AND b.status IN ('pending', 'accepted')
        ORDER BY b.requested_at DESC
      `, [customerId]);

      return result.rows.map(row => ({
        bookingId: row.id,
        status: row.status,
        serviceType: row.service_type,
        bookingDate: row.booking_date,
        bookingTime: row.booking_time,
        price: parseFloat(row.price_charged),
        requestedAt: row.requested_at,
        respondedAt: row.responded_at,
        barber: {
          id: row.barber_id,
          name: row.barber_name,
        },
        unreadMessages: parseInt(row.unread_messages) || 0,
      }));
    } catch (error) {
      logger.error('Error getting customer booking status:', error);
      throw error;
    }
  }
}

export const bookingRequestService = new BookingRequestService();

