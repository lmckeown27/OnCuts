/**
 * Blockchain Query Service
 * 
 * THE BRIDGE: Backend queries blockchain instead of PostgreSQL
 * 
 * This service provides a clean API for reading data from Aptos blockchain:
 * - User accounts (balances, profiles, metadata)
 * - Bookings (history, status, escrow)
 * - Reviews (ratings, comments)
 * - Barber profiles (portfolio, specialties, services)
 * 
 * Uses Aptos Indexer for fast queries (instead of scanning entire blockchain)
 * Implements caching for frequently accessed data
 * 
 * 🎯 Goal: Backend never touches PostgreSQL, only blockchain
 */

import { AptosClient } from 'aptos';
import { logger } from '../utils/logger';
import redis from '../config/redis';

interface UserAccount {
  address: string;
  email_hash: string;
  campus_domain: string;
  role: number; // 0=student, 1=barber, 2=admin
  balance_available: string; // In octas
  balance_locked: string;
  profile_photo_cid: string;
  bio: string;
  username: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
  is_verified: boolean;
  // Barber-specific
  years_of_experience?: number;
  specialties?: string[];
  instant_book_enabled?: boolean;
  portfolio_cids?: string[];
  // Stats
  total_bookings: string;
  total_spent: string;
  total_earned: string;
}

interface Booking {
  id: string;
  student_addr: string;
  barber_addr: string;
  service_name: string;
  service_description: string;
  amount_total: string;
  amount_to_barber: string;
  platform_fee: string;
  scheduled_time: string;
  created_at: string;
  completed_at: string;
  status: number; // 0=pending, 1=confirmed, 2=in-progress, 3=completed, 4=cancelled, 5=no-show
  escrow_released: boolean;
  location_description: string;
  student_notes: string;
  barber_notes: string;
}

interface Review {
  id: string;
  booking_id: string;
  student_addr: string;
  barber_addr: string;
  rating: number; // 1-5
  review_text_cid: string;
  student_performance_score: string;
  review_weight: string;
  weighted_rating: string;
  created_at: string;
  is_verified: boolean;
}

interface BarberRating {
  barber_addr: string;
  total_reviews: string;
  average_rating: string; // In basis points (e.g., 470 = 4.70 stars)
  weighted_average_rating: string;
  rating_5_count: string;
  rating_4_count: string;
  rating_3_count: string;
  rating_2_count: string;
  rating_1_count: string;
  last_updated: string;
}

class BlockchainQueryService {
  private aptosClient: AptosClient;
  private moduleAddress: string;
  private cacheEnabled: boolean = true;
  private cacheTTL = {
    userAccount: 60, // 1 minute (frequently changing balances)
    booking: 300, // 5 minutes (status changes)
    review: 3600, // 1 hour (immutable after creation)
    barberRating: 300, // 5 minutes (changes with new reviews)
  };

  constructor() {
    const nodeUrl = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    this.aptosClient = new AptosClient(nodeUrl);
    this.moduleAddress = process.env.APTOS_MODULE_ADDRESS || process.env.APTOS_PLATFORM_ADDRESS || '0x0';
    
    logger.info(`🔍 Blockchain Query Service initialized: ${nodeUrl}`);
    logger.info(`📍 Module Address: ${this.moduleAddress}`);
  }

  // ═══════════════════════════════════════════════════════════
  //  USER ACCOUNT QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get user account data from blockchain
   * Replaces: SELECT * FROM users WHERE address = ?
   */
  async getUserAccount(address: string): Promise<UserAccount | null> {
    try {
      // Check cache first
      if (this.cacheEnabled) {
        const cached = await redis.get(`user:${address}`);
        if (cached) {
          logger.info(`📦 Cache hit for user: ${address}`);
          return JSON.parse(cached);
        }
      }

      logger.info(`🔍 Querying blockchain for user: ${address}`);

      // Query blockchain
      const resource = await this.aptosClient.getAccountResource(
        address,
        `${this.moduleAddress}::user_accounts::UserAccount`
      );

      const data = resource.data as any;
      
      const userAccount: UserAccount = {
        address: data.user_address,
        email_hash: data.email_hash,
        campus_domain: data.campus_domain,
        role: parseInt(data.role),
        balance_available: data.balance_available,
        balance_locked: data.balance_locked,
        profile_photo_cid: data.profile_photo_cid,
        bio: data.bio,
        username: data.username,
        created_at: data.created_at,
        last_active: data.last_active,
        is_active: data.is_active,
        is_verified: data.is_verified,
        years_of_experience: parseInt(data.years_of_experience),
        specialties: data.specialties || [],
        instant_book_enabled: data.instant_book_enabled,
        portfolio_cids: data.portfolio_cids || [],
        total_bookings: data.total_bookings,
        total_spent: data.total_spent,
        total_earned: data.total_earned,
      };

      // Cache result
      if (this.cacheEnabled) {
        await redis.setex(
          `user:${address}`,
          this.cacheTTL.userAccount,
          JSON.stringify(userAccount)
        );
      }

      logger.info(`✅ User account loaded from blockchain: ${address}`);
      return userAccount;
    } catch (error) {
      if ((error as any).status === 404) {
        logger.info(`❌ User not found on blockchain: ${address}`);
        return null;
      }
      logger.error(`Failed to query user account for ${address}:`, error);
      throw new Error('Failed to query user account from blockchain');
    }
  }

  /**
   * Get user's balance (available + locked)
   * Replaces: SELECT balance_available, balance_locked FROM users WHERE address = ?
   */
  async getUserBalance(address: string): Promise<{ available: string; locked: string } | null> {
    try {
      const account = await this.getUserAccount(address);
      if (!account) return null;

      return {
        available: account.balance_available,
        locked: account.balance_locked,
      };
    } catch (error) {
      logger.error(`Failed to get balance for ${address}:`, error);
      return null;
    }
  }

  /**
   * Check if user is a barber
   * Replaces: SELECT role FROM users WHERE address = ? AND role = 1
   */
  async isBarber(address: string): Promise<boolean> {
    try {
      const account = await this.getUserAccount(address);
      return account?.role === 1; // ROLE_BARBER = 1
    } catch (error) {
      logger.error(`Failed to check barber status for ${address}:`, error);
      return false;
    }
  }

  /**
   * Get all barbers for a campus (using indexer)
   * Replaces: SELECT * FROM users WHERE campus_domain = ? AND role = 1
   * 
   * Note: This requires Aptos Indexer API (not available in basic node)
   * For now, we'll use events to build an index in Redis
   */
  async getBarbersByCampus(campusDomain: string): Promise<UserAccount[]> {
    try {
      // TODO: Implement using Aptos Indexer API
      // For now, return empty array (will be populated from events)
      logger.warn('getBarbersByCampus: Indexer integration pending');
      return [];
    } catch (error) {
      logger.error(`Failed to get barbers for ${campusDomain}:`, error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  BOOKING QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get booking by ID
   * Replaces: SELECT * FROM bookings WHERE id = ?
   */
  async getBooking(bookingId: string): Promise<Booking | null> {
    try {
      // Check cache
      if (this.cacheEnabled) {
        const cached = await redis.get(`booking:${bookingId}`);
        if (cached) {
          logger.info(`📦 Cache hit for booking: ${bookingId}`);
          return JSON.parse(cached);
        }
      }

      logger.info(`🔍 Querying blockchain for booking: ${bookingId}`);

      // Query booking registry
      const resource = await this.aptosClient.getAccountResource(
        this.moduleAddress,
        `${this.moduleAddress}::bookings::BookingRegistry`
      );

      const data = resource.data as any;
      const bookingsTable = data.bookings;

      // Note: This is a simplified example. In production, you'd use:
      // 1. Aptos Indexer API to query bookings table
      // 2. Or maintain a Redis index of booking events
      
      // For now, we'll return null and rely on event indexing
      logger.warn('getBooking: Direct table access not available, use event indexing');
      return null;
    } catch (error) {
      logger.error(`Failed to query booking ${bookingId}:`, error);
      return null;
    }
  }

  /**
   * Get bookings for a user (student or barber)
   * Replaces: SELECT * FROM bookings WHERE student_addr = ? OR barber_addr = ?
   * 
   * Uses event indexing (events emitted when bookings are created)
   */
  async getUserBookings(userAddress: string): Promise<Booking[]> {
    try {
      // Check cache
      if (this.cacheEnabled) {
        const cached = await redis.get(`bookings:${userAddress}`);
        if (cached) {
          logger.info(`📦 Cache hit for user bookings: ${userAddress}`);
          return JSON.parse(cached);
        }
      }

      logger.info(`🔍 Querying bookings for user: ${userAddress}`);

      // Query events from blockchain
      // BookingCreatedEvent, BookingCompletedEvent, BookingCancelledEvent
      const events = await this.aptosClient.getEventsByEventHandle(
        this.moduleAddress,
        `${this.moduleAddress}::bookings::BookingRegistry`,
        'booking_created_events'
      );

      // Filter events for this user
      const userBookings = events
        .filter((event: any) => {
          const data = event.data;
          return data.student_addr === userAddress || data.barber_addr === userAddress;
        })
        .map((event: any) => ({
          id: event.data.booking_id,
          student_addr: event.data.student_addr,
          barber_addr: event.data.barber_addr,
          amount: event.data.amount,
          scheduled_time: event.data.scheduled_time,
          created_at: event.data.timestamp,
          // Note: This is partial data from events
          // Full booking data would require additional queries or indexer
        }));

      // Cache result
      if (this.cacheEnabled) {
        await redis.setex(
          `bookings:${userAddress}`,
          this.cacheTTL.booking,
          JSON.stringify(userBookings)
        );
      }

      logger.info(`✅ Found ${userBookings.length} bookings for user: ${userAddress}`);
      return userBookings as Booking[];
    } catch (error) {
      logger.error(`Failed to query bookings for ${userAddress}:`, error);
      return [];
    }
  }

  /**
   * Get booking count for user
   * Replaces: SELECT COUNT(*) FROM bookings WHERE student_addr = ? OR barber_addr = ?
   */
  async getUserBookingCount(userAddress: string): Promise<number> {
    try {
      const bookings = await this.getUserBookings(userAddress);
      return bookings.length;
    } catch (error) {
      logger.error(`Failed to count bookings for ${userAddress}:`, error);
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  REVIEW QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get barber's aggregate rating
   * Replaces: SELECT AVG(rating), COUNT(*) FROM reviews WHERE barber_addr = ?
   */
  async getBarberRating(barberAddress: string): Promise<BarberRating | null> {
    try {
      // Check cache
      if (this.cacheEnabled) {
        const cached = await redis.get(`rating:${barberAddress}`);
        if (cached) {
          logger.info(`📦 Cache hit for barber rating: ${barberAddress}`);
          return JSON.parse(cached);
        }
      }

      logger.info(`🔍 Querying rating for barber: ${barberAddress}`);

      // Query BarberRatings resource
      const resource = await this.aptosClient.getAccountResource(
        this.moduleAddress,
        `${this.moduleAddress}::reviews::ReviewRegistry`
      );

      const data = resource.data as any;
      const ratingsTable = data.barber_ratings;

      // Note: Direct table access not available in basic Aptos client
      // Would need Aptos Indexer or event-based indexing
      
      logger.warn('getBarberRating: Indexer integration pending');
      return null;
    } catch (error) {
      logger.error(`Failed to query rating for ${barberAddress}:`, error);
      return null;
    }
  }

  /**
   * Get reviews for a barber
   * Replaces: SELECT * FROM reviews WHERE barber_addr = ? ORDER BY created_at DESC
   */
  async getBarberReviews(barberAddress: string, limit: number = 20): Promise<Review[]> {
    try {
      logger.info(`🔍 Querying reviews for barber: ${barberAddress}`);

      // Query review events
      const events = await this.aptosClient.getEventsByEventHandle(
        this.moduleAddress,
        `${this.moduleAddress}::reviews::ReviewRegistry`,
        'review_created_events'
      );

      // Filter and map to Review objects
      const reviews = events
        .filter((event: any) => event.data.barber_addr === barberAddress)
        .slice(0, limit)
        .map((event: any) => ({
          id: event.data.review_id,
          booking_id: event.data.booking_id,
          student_addr: event.data.student_addr,
          barber_addr: event.data.barber_addr,
          rating: event.data.rating,
          review_text_cid: event.data.review_text_cid,
          review_weight: event.data.review_weight,
          created_at: event.data.timestamp,
          is_verified: true,
        }));

      logger.info(`✅ Found ${reviews.length} reviews for barber: ${barberAddress}`);
      return reviews as Review[];
    } catch (error) {
      logger.error(`Failed to query reviews for ${barberAddress}:`, error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PLATFORM STATS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get platform-wide statistics
   * Replaces: SELECT COUNT(*) FROM users, bookings, reviews
   */
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalStudents: number;
    totalBarbers: number;
    totalBookings: number;
    totalReviews: number;
    totalVolume: string;
  }> {
    try {
      logger.info('🔍 Querying platform stats from blockchain');

      // Query UserRegistry
      const userRegistry = await this.aptosClient.getAccountResource(
        this.moduleAddress,
        `${this.moduleAddress}::user_accounts::UserRegistry`
      );

      // Query BookingRegistry
      const bookingRegistry = await this.aptosClient.getAccountResource(
        this.moduleAddress,
        `${this.moduleAddress}::bookings::BookingRegistry`
      );

      // Query ReviewRegistry
      const reviewRegistry = await this.aptosClient.getAccountResource(
        this.moduleAddress,
        `${this.moduleAddress}::reviews::ReviewRegistry`
      );

      const userData = userRegistry.data as any;
      const bookingData = bookingRegistry.data as any;
      const reviewData = reviewRegistry.data as any;

      return {
        totalUsers: parseInt(userData.total_students) + parseInt(userData.total_barbers) + parseInt(userData.total_admins),
        totalStudents: parseInt(userData.total_students),
        totalBarbers: parseInt(userData.total_barbers),
        totalBookings: parseInt(bookingData.total_bookings),
        totalReviews: parseInt(reviewData.total_reviews),
        totalVolume: bookingData.total_volume,
      };
    } catch (error) {
      logger.error('Failed to query platform stats:', error);
      throw new Error('Failed to query platform statistics');
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CACHE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  /**
   * Invalidate cache for a user (called after balance changes)
   */
  async invalidateUserCache(address: string): Promise<void> {
    try {
      await redis.del(`user:${address}`);
      await redis.del(`bookings:${address}`);
      logger.info(`🗑️  Cache invalidated for user: ${address}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for ${address}:`, error);
    }
  }

  /**
   * Invalidate cache for a booking
   */
  async invalidateBookingCache(bookingId: string): Promise<void> {
    try {
      await redis.del(`booking:${bookingId}`);
      logger.info(`🗑️  Cache invalidated for booking: ${bookingId}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for booking ${bookingId}:`, error);
    }
  }

  /**
   * Clear all caches (admin function)
   */
  async clearAllCaches(): Promise<void> {
    try {
      await redis.flushdb();
      logger.info('🗑️  All caches cleared');
    } catch (error) {
      logger.error('Failed to clear caches:', error);
    }
  }

  /**
   * Enable/disable caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    logger.info(`🔧 Caching ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export default new BlockchainQueryService();

