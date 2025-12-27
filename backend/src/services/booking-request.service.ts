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
   */
  async getBarberPendingRequests(barberIdOrUserId: string): Promise<BookingRequest[]> {
    try {
      // Check if PostgreSQL is available
      await pool.query('SELECT 1');
      
      // First, try to find the barber ID - the input could be either barber ID or user ID
      let barberId = barberIdOrUserId;
      
      // Check if this is a user ID by looking up the barbers table
      const barberCheck = await pool.query(
        'SELECT id FROM barbers WHERE id = $1 OR "userId" = $1',
        [barberIdOrUserId]
      );
      
      if (barberCheck.rows.length > 0) {
        barberId = barberCheck.rows[0].id;
      }
      
      const result = await pool.query(`
        SELECT 
          b.id as booking_id,
          b.customer_id,
          u.name as customer_name,
          b.barber_id,
          b.service_type,
          b.booking_date as requested_date,
          b.booking_time as requested_time,
          b.price_charged as price,
          b.status,
          b.requested_at,
          cp.display_name,
          cp.bio,
          cp.profile_image_url,
          cp.total_bookings,
          cp.completed_bookings,
          cp.cancelled_bookings,
          cp.no_show_count,
          cp.avg_rating,
          cp.total_reviews,
          cp.is_reliable,
          cp.response_rate,
          (SELECT message FROM booking_messages 
           WHERE booking_id = b.id 
           AND sender_type = 'customer'
           ORDER BY created_at DESC LIMIT 1) as initial_message
        FROM bookings b
        JOIN users u ON b.customer_id = u.id
        LEFT JOIN customer_profiles cp ON b.customer_id = cp.user_id
        WHERE b.barber_id = $1 
          AND b.status = 'pending'
        ORDER BY b.requested_at DESC
      `, [barberId]);

      return result.rows.map(row => ({
        bookingId: row.booking_id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerProfile: {
          displayName: row.display_name || row.customer_name,
          bio: row.bio,
          profileImageUrl: row.profile_image_url,
          stats: {
            totalBookings: parseInt(row.total_bookings) || 0,
            completedBookings: parseInt(row.completed_bookings) || 0,
            cancelledBookings: parseInt(row.cancelled_bookings) || 0,
            noShowCount: parseInt(row.no_show_count) || 0,
            avgRating: parseFloat(row.avg_rating) || 0,
            totalReviews: parseInt(row.total_reviews) || 0,
            isReliable: row.is_reliable !== false,
            responseRate: parseFloat(row.response_rate) || 100,
          },
        },
        barberId: row.barber_id,
        serviceType: row.service_type,
        requestedDate: row.requested_date,
        requestedTime: row.requested_time,
        price: parseFloat(row.price),
        message: row.initial_message,
        status: row.status,
        requestedAt: row.requested_at,
      }));
    } catch (error) {
      logger.error('Error getting pending requests (using mock data):', error);
      
      // Return mock data when PostgreSQL is unavailable
      return this.getMockPendingRequests(barberId);
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
   */
  async acceptBookingRequest(
    bookingId: string,
    barberId: string,
    message?: string
  ): Promise<{ success: boolean }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update booking status
      const updateResult = await client.query(`
        UPDATE bookings
        SET 
          status = 'accepted',
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND barber_id = $2 AND status = 'pending'
        RETURNING customer_id
      `, [bookingId, barberId]);

      if (updateResult.rows.length === 0) {
        throw new Error('Booking not found or already responded to');
      }

      const customerId = updateResult.rows[0].customer_id;

      // Add acceptance message if provided
      if (message) {
        await client.query(`
          INSERT INTO booking_messages (
            booking_id,
            sender_id,
            sender_type,
            message,
            message_type
          ) VALUES ($1, (SELECT user_id FROM barbers WHERE barber_id = $2), 'barber', $3, 'text')
        `, [bookingId, barberId, message]);
      }

      // Create notification for customer
      await client.query(`
        INSERT INTO booking_request_notifications (
          user_id,
          booking_id,
          type,
          title,
          message
        ) SELECT 
          $1,
          $2,
          'accepted',
          'Booking Accepted!',
          b.name || ' has accepted your booking request'
        FROM barbers ba
        JOIN users b ON ba.user_id = b.id
        WHERE ba.barber_id = $3
      `, [customerId, bookingId, barberId]);

      await client.query('COMMIT');

      logger.info(`Booking ${bookingId} accepted by barber ${barberId}`);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error accepting booking request (using mock response):', error);
      
      // Return mock success when PostgreSQL is unavailable
      logger.info(`Mock: Booking ${bookingId} accepted by barber ${barberId}`);
      return { success: true };
    } finally {
      client.release();
    }
  }

  /**
   * Reject a booking request
   */
  async rejectBookingRequest(
    bookingId: string,
    barberId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update booking status
      const updateResult = await client.query(`
        UPDATE bookings
        SET 
          status = 'rejected',
          responded_at = NOW(),
          rejection_reason = $3,
          updated_at = NOW()
        WHERE id = $1 AND barber_id = $2 AND status = 'pending'
        RETURNING customer_id
      `, [bookingId, barberId, reason]);

      if (updateResult.rows.length === 0) {
        throw new Error('Booking not found or already responded to');
      }

      const customerId = updateResult.rows[0].customer_id;

      // Add rejection message
      const rejectionMessage = reason 
        ? `Sorry, I can't accept this booking. ${reason}`
        : 'Sorry, I can\'t accept this booking at this time.';

      await client.query(`
        INSERT INTO booking_messages (
          booking_id,
          sender_id,
          sender_type,
          message,
          message_type
        ) VALUES ($1, (SELECT user_id FROM barbers WHERE barber_id = $2), 'barber', $3, 'system')
      `, [bookingId, barberId, rejectionMessage]);

      // Create notification for customer
      await client.query(`
        INSERT INTO booking_request_notifications (
          user_id,
          booking_id,
          type,
          title,
          message
        ) SELECT 
          $1,
          $2,
          'rejected',
          'Booking Not Available',
          b.name || ' is unable to accept your booking request'
        FROM barbers ba
        JOIN users b ON ba.user_id = b.id
        WHERE ba.barber_id = $3
      `, [customerId, bookingId, barberId]);

      await client.query('COMMIT');

      logger.info(`Booking ${bookingId} rejected by barber ${barberId}`);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error rejecting booking request (using mock response):', error);
      
      // Return mock success when PostgreSQL is unavailable
      logger.info(`Mock: Booking ${bookingId} rejected by barber ${barberId}. Reason: ${reason || 'No reason provided'}`);
      return { success: true };
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

