/**
 * Pending Booking Cron Service
 * 
 * Handles automatic warnings and cancellations for pending bookings:
 * 
 * 1. 3 hours before scheduled time: Send warning email to barber
 *    - Reminds them to accept/decline the booking
 *    - Warns that it will be auto-cancelled in 1 hour if not accepted
 * 
 * 2. 2 hours before scheduled time: Auto-cancel the booking
 *    - Cancel the pending booking
 *    - Send cancellation emails to both barber and consumer
 *    - Consumer email includes alternative barbers who are available
 * 
 * Schedule: Runs every 5 minutes to catch pending bookings.
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { 
  sendPendingBookingWarningEmail, 
  sendBarberAutoCancellationEmail,
  sendConsumerAutoCancellationEmail 
} from './email.service';

/**
 * Helper to format service type: "HAIRCUT" -> "Haircut", "BEARD_TRIM" -> "Beard Trim"
 */
function formatServiceType(type: string): string {
  if (!type) return 'Haircut';
  return type
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export class PendingBookingCronService {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the pending booking cron job
   * Runs every 5 minutes to check for pending bookings
   */
  start(): void {
    if (this.job) {
      logger.warn('Pending booking cron job is already running');
      return;
    }

    // Run every 5 minutes
    this.job = cron.schedule('*/5 * * * *', async () => {
      await this.processPendingWarnings();
      await this.processAutoCancellations();
    });

    logger.info('📧 Pending booking cron job started (runs every 5 minutes)');
  }

  /**
   * Stop the pending booking cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Pending booking cron job stopped');
    }
  }

  /**
   * Ensure required columns exist in the bookings table
   */
  private async ensureColumnsExist(): Promise<void> {
    try {
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_warning_sent BOOLEAN DEFAULT FALSE
      `);
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS auto_cancelled BOOLEAN DEFAULT FALSE
      `);
    } catch (error: any) {
      logger.debug('Columns already exist or creation failed:', error.message);
    }
  }

  /**
   * Process pending booking warnings (3 hours before scheduled time)
   * Sends warning email to barber for PENDING bookings
   */
  async processPendingWarnings(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Pending booking job already running, skipping...');
      return;
    }

    this.isRunning = true;
    let warningsSent = 0;

    try {
      logger.debug('Checking for pending bookings needing warning (3 hours before)...');

      await this.ensureColumnsExist();

      // Find PENDING bookings that:
      // 1. Are scheduled between 2-3 hours from now (3 hour warning window)
      // 2. Have not already had a pending warning email sent
      // 3. Barber has email notifications enabled
      const result = await pool.query(`
        SELECT 
          b.id,
          b."consumerId",
          b."barberId",
          b."serviceType",
          b."priceUsdCents",
          b."requestedAt" as scheduled_time,
          b.status,
          c.location,
          c.service_name,
          consumer.first_name as consumer_first_name,
          consumer.last_name as consumer_last_name,
          barber_user.first_name as barber_first_name,
          barber_user.last_name as barber_last_name,
          barber_user.email as barber_email,
          barber_user.notification_preferences as barber_notification_preferences,
          COALESCE(campus.timezone, 'America/Los_Angeles') as campus_timezone
        FROM bookings b
        LEFT JOIN conversations c ON c.booking_id = b.id
        LEFT JOIN users consumer ON b."consumerId" = consumer.id
        LEFT JOIN barbers barber ON b."barberId" = barber.id
        LEFT JOIN users barber_user ON barber."userId" = barber_user.id
        LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
        WHERE b.status = 'PENDING'
          AND b."requestedAt" > NOW() + INTERVAL '2 hours'
          AND b."requestedAt" <= NOW() + INTERVAL '3 hours'
          AND b.pending_warning_sent IS NOT TRUE
          AND barber_user.email IS NOT NULL
      `);

      if (result.rows.length === 0) {
        logger.debug('No pending bookings found needing 3-hour warning');
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${result.rows.length} pending bookings needing 3-hour warning`);

      for (const booking of result.rows) {
        try {
          // Check if barber has email notifications enabled
          const prefs = booking.barber_notification_preferences || {};
          const emailEnabled = prefs.email_notifications !== false;
          const bookingNotificationsEnabled = prefs.bookings !== false;

          if (!emailEnabled || !bookingNotificationsEnabled) {
            logger.debug(`Skipping warning for booking ${booking.id} - barber has disabled notifications`);
            await this.markWarningSent(booking.id);
            continue;
          }

          const serviceName = booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';
          const scheduledTime = new Date(booking.scheduled_time);
          const campusTimezone = booking.campus_timezone || 'America/Los_Angeles';
          
          const scheduledDate = scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: campusTimezone
          });
          const scheduledTimeStr = scheduledTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: campusTimezone
          });

          const emailDetails = {
            bookingId: booking.id.toString(),
            serviceName,
            price: (booking.priceUsdCents || 0) / 100,
            scheduledDate,
            scheduledTime: scheduledTimeStr,
            location: booking.location,
            consumerName: `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() || 'Customer',
            barberName: `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() || 'Barber',
            barberEmail: booking.barber_email
          };

          await sendPendingBookingWarningEmail(emailDetails);
          await this.markWarningSent(booking.id);

          warningsSent++;
          logger.info(`✅ Pending booking warning sent for booking ${booking.id} to ${booking.barber_email}`);

        } catch (error: any) {
          logger.error(`Failed to send pending warning for booking ${booking.id}:`, error.message);
        }
      }

      if (warningsSent > 0) {
        logger.info(`📧 Pending booking warnings processed: ${warningsSent} sent`);
      }

    } catch (error: any) {
      logger.error('Error processing pending booking warnings:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process auto-cancellations (2 hours before scheduled time)
   * Cancels PENDING bookings and sends notification emails
   */
  async processAutoCancellations(): Promise<void> {
    let cancellations = 0;

    try {
      logger.debug('Checking for pending bookings needing auto-cancellation (2 hours before)...');

      await this.ensureColumnsExist();

      // Find PENDING bookings that:
      // 1. Are scheduled within the next 2 hours (but not in the past)
      // 2. Have not already been auto-cancelled
      const result = await pool.query(`
        SELECT 
          b.id,
          b."consumerId",
          b."barberId",
          b."serviceType",
          b."priceUsdCents",
          b."requestedAt" as scheduled_time,
          b.status,
          c.location,
          c.service_name,
          consumer.first_name as consumer_first_name,
          consumer.last_name as consumer_last_name,
          consumer.email as consumer_email,
          consumer.notification_preferences as consumer_notification_preferences,
          barber_user.first_name as barber_first_name,
          barber_user.last_name as barber_last_name,
          barber_user.email as barber_email,
          barber_user.notification_preferences as barber_notification_preferences,
          barber."campusId" as campus_id,
          COALESCE(campus.timezone, 'America/Los_Angeles') as campus_timezone
        FROM bookings b
        LEFT JOIN conversations c ON c.booking_id = b.id
        LEFT JOIN users consumer ON b."consumerId" = consumer.id
        LEFT JOIN barbers barber ON b."barberId" = barber.id
        LEFT JOIN users barber_user ON barber."userId" = barber_user.id
        LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
        WHERE b.status = 'PENDING'
          AND b."requestedAt" > NOW()
          AND b."requestedAt" <= NOW() + INTERVAL '2 hours'
          AND b.auto_cancelled IS NOT TRUE
      `);

      if (result.rows.length === 0) {
        logger.debug('No pending bookings found needing auto-cancellation');
        return;
      }

      logger.info(`Found ${result.rows.length} pending bookings needing auto-cancellation`);

      for (const booking of result.rows) {
        try {
          const serviceName = booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';
          const scheduledTime = new Date(booking.scheduled_time);
          const campusTimezone = booking.campus_timezone || 'America/Los_Angeles';
          
          const scheduledDate = scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: campusTimezone
          });
          const scheduledTimeStr = scheduledTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: campusTimezone
          });

          // Fetch alternative barbers for consumer
          let alternativeBarbers: { id: string; name: string; avatar?: string; avgRating?: number; totalReviews?: number }[] = [];
          
          if (booking.campus_id) {
            try {
              alternativeBarbers = await this.fetchAlternativeBarbers(
                booking.campus_id,
                booking.barberId,
                booking.serviceType,
                scheduledTime,
                campusTimezone
              );
            } catch (altError: any) {
              logger.error('Error fetching alternative barbers:', altError.message);
            }
          }

          // Cancel the booking
          await pool.query(`
            UPDATE bookings 
            SET status = 'CANCELLED', 
                auto_cancelled = TRUE,
                "updatedAt" = NOW()
            WHERE id = $1
          `, [booking.id]);

          // Prepare email details
          const emailDetails = {
            bookingId: booking.id.toString(),
            serviceName,
            serviceType: booking.serviceType,
            price: (booking.priceUsdCents || 0) / 100,
            scheduledDate,
            scheduledTime: scheduledTimeStr,
            scheduledDateTime: booking.scheduled_time,
            location: booking.location,
            consumerName: `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() || 'Customer',
            consumerEmail: booking.consumer_email,
            barberName: `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() || 'Barber',
            barberEmail: booking.barber_email,
            campusId: booking.campus_id,
            campusTimezone,
            alternativeBarbers
          };

          // Send barber auto-cancellation email
          const barberPrefs = booking.barber_notification_preferences || {};
          if (barberPrefs.email_notifications !== false && barberPrefs.bookings !== false && booking.barber_email) {
            try {
              await sendBarberAutoCancellationEmail(emailDetails);
              logger.info(`✅ Barber auto-cancellation email sent for booking ${booking.id}`);
            } catch (emailError: any) {
              logger.error(`Failed to send barber auto-cancellation email:`, emailError.message);
            }
          }

          // Send consumer auto-cancellation email
          const consumerPrefs = booking.consumer_notification_preferences || {};
          if (consumerPrefs.email_notifications !== false && consumerPrefs.bookings !== false && booking.consumer_email) {
            try {
              await sendConsumerAutoCancellationEmail(emailDetails);
              logger.info(`✅ Consumer auto-cancellation email sent for booking ${booking.id}`);
            } catch (emailError: any) {
              logger.error(`Failed to send consumer auto-cancellation email:`, emailError.message);
            }
          }

          cancellations++;
          logger.info(`✅ Booking ${booking.id} auto-cancelled (barber didn't accept in time)`);

        } catch (error: any) {
          logger.error(`Failed to auto-cancel booking ${booking.id}:`, error.message);
        }
      }

      if (cancellations > 0) {
        logger.info(`📧 Auto-cancellations processed: ${cancellations} bookings cancelled`);
      }

    } catch (error: any) {
      logger.error('Error processing auto-cancellations:', error.message);
    }
  }

  /**
   * Fetch alternative barbers who are available at the given time
   */
  private async fetchAlternativeBarbers(
    campusId: string,
    excludeBarberId: string,
    serviceType: string,
    scheduledDate: Date,
    campusTimezone: string
  ): Promise<{ id: string; name: string; avatar?: string; avgRating?: number; totalReviews?: number }[]> {
    const alternativeBarbers: { id: string; name: string; avatar?: string; avgRating?: number; totalReviews?: number }[] = [];

    try {
      // Get date and time in campus timezone
      const dateStr = scheduledDate.toLocaleDateString('en-CA', { timeZone: campusTimezone });
      const timeStr = scheduledDate.toLocaleTimeString('en-US', { 
        timeZone: campusTimezone, 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
      const [requestedHour, requestedMinutes] = timeStr.split(':').map(Number);
      const requestedTimeInMinutes = requestedHour * 60 + requestedMinutes;

      // Get day of week from the date string
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const [year, month, day] = dateStr.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      const dayName = dayNames[localDate.getDay()];

      // Fetch all barbers at the same campus who offer the same service
      const barbersResult = await pool.query(`
        SELECT 
          b.id,
          COALESCE(u."displayName", u.first_name || ' ' || u.last_name) as name,
          u."avatarUrl" as avatar,
          b."weeklySchedule" as weekly_schedule,
          b.pricing,
          (SELECT AVG(r.rating)::numeric(3,2) FROM reviews r WHERE r."barberId" = b.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews r WHERE r."barberId" = b.id) as total_reviews
        FROM barbers b
        JOIN users u ON b."userId" = u.id
        WHERE b."campusId" = $1 
          AND b.id != $2
          AND b."isActive" = true
      `, [campusId, excludeBarberId]);

      // Filter barbers who offer the service
      const serviceTypeFormatted = serviceType?.toUpperCase().replace(/_/g, ' ').replace(/AND/g, '&');
      const barbersWithService = barbersResult.rows.filter(barber => {
        const pricing = barber.pricing || [];
        return pricing.some((service: any) => {
          const serviceName = (service.name || service.type || service.service_type || '').toUpperCase().replace(/_/g, ' ').replace(/AND/g, '&');
          return serviceName === serviceTypeFormatted || 
                 serviceName.includes(serviceTypeFormatted) || 
                 serviceTypeFormatted.includes(serviceName);
        });
      });

      // Check availability for each barber
      for (const barber of barbersWithService) {
        const weeklySchedule = barber.weekly_schedule || {};
        const daySchedule = weeklySchedule[dayName];

        if (!daySchedule || !daySchedule.enabled) continue;

        let intervals: { start: string; end: string }[] = [];
        if (daySchedule.intervals && Array.isArray(daySchedule.intervals)) {
          intervals = daySchedule.intervals;
        } else if (daySchedule.start && daySchedule.end) {
          intervals = [{ start: daySchedule.start, end: daySchedule.end }];
        }

        const inInterval = intervals.some(interval => {
          const [startHour, startMin] = interval.start.split(':').map(Number);
          const [endHour, endMin] = interval.end.split(':').map(Number);
          const intervalStart = startHour * 60 + startMin;
          const intervalEnd = endHour * 60 + endMin;
          return requestedTimeInMinutes >= intervalStart && requestedTimeInMinutes < intervalEnd;
        });

        if (!inInterval) continue;

        // Check for conflicting bookings
        const conflictCheck = await pool.query(`
          SELECT 1 FROM bookings 
          WHERE "barberId" = $1 
            AND DATE("requestedAt" AT TIME ZONE $2) = $3
            AND EXTRACT(HOUR FROM "requestedAt" AT TIME ZONE $2) * 60 + 
                EXTRACT(MINUTE FROM "requestedAt" AT TIME ZONE $2) <= $4
            AND EXTRACT(HOUR FROM "requestedAt" AT TIME ZONE $2) * 60 + 
                EXTRACT(MINUTE FROM "requestedAt" AT TIME ZONE $2) + 60 > $4
            AND status IN ('ACCEPTED', 'PENDING', 'COMPLETED')
          LIMIT 1
        `, [barber.id, campusTimezone, dateStr, requestedTimeInMinutes]);

        if (conflictCheck.rows.length > 0) continue;

        // Check for time blocks
        const blockCheck = await pool.query(`
          SELECT 1 FROM barber_time_blocks
          WHERE barber_id = $1
            AND block_date = $2
            AND EXTRACT(HOUR FROM start_time) * 60 + EXTRACT(MINUTE FROM start_time) <= $3
            AND EXTRACT(HOUR FROM end_time) * 60 + EXTRACT(MINUTE FROM end_time) > $3
          LIMIT 1
        `, [barber.id, dateStr, requestedTimeInMinutes]);

        if (blockCheck.rows.length > 0) continue;

        alternativeBarbers.push({
          id: barber.id,
          name: barber.name,
          avatar: barber.avatar,
          avgRating: barber.avg_rating ? parseFloat(barber.avg_rating) : undefined,
          totalReviews: barber.total_reviews ? parseInt(barber.total_reviews) : undefined,
        });

        if (alternativeBarbers.length >= 5) break;
      }

    } catch (error: any) {
      logger.error('Error in fetchAlternativeBarbers:', error.message);
    }

    return alternativeBarbers;
  }

  /**
   * Mark a booking's pending warning as sent
   */
  private async markWarningSent(bookingId: number | string): Promise<void> {
    try {
      await pool.query(
        'UPDATE bookings SET pending_warning_sent = TRUE WHERE id = $1',
        [bookingId]
      );
    } catch (error: any) {
      logger.error(`Failed to mark pending warning sent for booking ${bookingId}:`, error.message);
    }
  }

  /**
   * Run manually (for testing)
   */
  async runManually(): Promise<void> {
    await this.processPendingWarnings();
    await this.processAutoCancellations();
  }
}

// Singleton instance
export const pendingBookingCronService = new PendingBookingCronService();

