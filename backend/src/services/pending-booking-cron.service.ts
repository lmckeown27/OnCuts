/**
 * Pending Booking Cron Service
 *
 * 1. Sends warning emails to barbers for pending bookings (3h, 2h, 1h before scheduled time)
 * 2. Auto-cancels PENDING bookings still open on the calendar day after the scheduled appointment
 *
 * Schedule: Runs every 5 minutes.
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  sendPendingBookingWarningEmail,
  sendBarberAutoCancellationEmail,
  sendConsumerAutoCancellationEmail,
} from './email.service';
import notificationService from './notification.service';
import pushNotificationService from './pushNotification.service';
import { cancelPendingRescheduleRequestsForBooking } from './booking-cancellation.service';
import { fetchAlternativeBarbers } from './booking-request.service';

/** Stored on the booking and surfaced to consumers/barbers when auto-cancelled. */
export const STALE_PENDING_CANCELLATION_REASON =
  'The service provider did not accept the booking in time.';

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
      if (this.isRunning) {
        logger.debug('Pending booking job already running, skipping...');
        return;
      }
      this.isRunning = true;
      try {
        await this.processPendingWarnings();
        await this.processStalePendingCancellations();
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('📧 Pending booking cron job started (warnings + stale auto-cancel, every 5 minutes)');
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
      // Track which warning emails have been sent
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warning_3h_sent BOOLEAN DEFAULT FALSE
      `);
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warning_2h_sent BOOLEAN DEFAULT FALSE
      `);
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS warning_1h_sent BOOLEAN DEFAULT FALSE
      `);
      // Keep legacy column for backwards compatibility
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_warning_sent BOOLEAN DEFAULT FALSE
      `);
    } catch (error: any) {
      logger.debug('Columns already exist or creation failed:', error.message);
    }
  }

  /**
   * Process pending booking warnings at 3h, 2h, and 1h before scheduled time
   * Sends warning emails to barber for PENDING bookings
   */
  async processPendingWarnings(): Promise<void> {
    let warningsSent = 0;

    try {
      logger.debug('Checking for pending bookings needing warnings...');

      await this.ensureColumnsExist();

      // Process each warning tier
      warningsSent += await this.processWarningTier(3, 'warning_3h_sent', 'in 3 hours');
      warningsSent += await this.processWarningTier(2, 'warning_2h_sent', 'in 2 hours');
      warningsSent += await this.processWarningTier(1, 'warning_1h_sent', 'in 1 hour');

      if (warningsSent > 0) {
        logger.info(`📧 Pending booking warnings processed: ${warningsSent} sent`);
      }

    } catch (error: any) {
      logger.error('Error processing pending booking warnings:', error.message);
    }
  }

  /**
   * Process warnings for a specific time tier
   * @param hoursBeforeMin - Minimum hours before appointment (exclusive lower bound)
   * @param columnName - Database column to track if this warning was sent
   * @param timeDescription - Human readable time for the warning message
   */
  private async processWarningTier(
    hoursBeforeMin: number,
    columnName: string,
    timeDescription: string
  ): Promise<number> {
    let warningsSent = 0;
    const hoursBeforeMax = hoursBeforeMin + 1;

    try {
      // Find PENDING bookings that:
      // 1. Are scheduled between hoursBeforeMin and hoursBeforeMax hours from now
      // 2. Have not already had this specific warning email sent
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
          AND b."requestedAt" > NOW() + INTERVAL '${hoursBeforeMin} hours'
          AND b."requestedAt" <= NOW() + INTERVAL '${hoursBeforeMax} hours'
          AND b.${columnName} IS NOT TRUE
          AND barber_user.email IS NOT NULL
      `);

      if (result.rows.length === 0) {
        logger.debug(`No pending bookings found needing ${hoursBeforeMin}-hour warning`);
        return 0;
      }

      logger.info(`Found ${result.rows.length} pending bookings needing ${hoursBeforeMin}-hour warning`);

      for (const booking of result.rows) {
        try {
          // Check if barber has email notifications enabled
          const prefs = booking.barber_notification_preferences || {};
          const emailEnabled = prefs.email_notifications !== false;
          const bookingNotificationsEnabled = prefs.bookings !== false;

          if (!emailEnabled || !bookingNotificationsEnabled) {
            logger.debug(`Skipping warning for booking ${booking.id} - barber has disabled notifications`);
            await this.markWarningSent(booking.id, columnName);
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
            barberEmail: booking.barber_email,
            // Pass urgency level for email customization
            hoursRemaining: hoursBeforeMin,
            timeDescription
          };

          await sendPendingBookingWarningEmail(emailDetails);
          await this.markWarningSent(booking.id, columnName);

          warningsSent++;
          logger.info(`✅ ${hoursBeforeMin}h warning sent for booking ${booking.id} to ${booking.barber_email}`);

        } catch (error: any) {
          logger.error(`Failed to send ${hoursBeforeMin}h warning for booking ${booking.id}:`, error.message);
        }
      }

    } catch (error: any) {
      logger.error(`Error processing ${hoursBeforeMin}-hour warnings:`, error.message);
    }

    return warningsSent;
  }

  /**
   * Mark a booking's warning as sent for a specific tier
   */
  private async markWarningSent(bookingId: number | string, columnName: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE bookings SET ${columnName} = TRUE WHERE id = $1`,
        [bookingId]
      );
    } catch (error: any) {
      logger.error(`Failed to mark ${columnName} sent for booking ${bookingId}:`, error.message);
    }
  }

  /**
   * Run manually (for testing)
   */
  async runManually(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.processPendingWarnings();
      await this.processStalePendingCancellations();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Cancel PENDING bookings whose scheduled calendar day has passed (still pending the next day).
   */
  async processStalePendingCancellations(): Promise<void> {
    let cancelledCount = 0;

    try {
      const result = await pool.query(`
        SELECT
          b.id,
          b."consumerId",
          b."barberId",
          b."serviceType",
          b."priceUsdCents",
          b."requestedAt" as scheduled_time,
          c.location,
          c.service_name,
          consumer.first_name as consumer_first_name,
          consumer.last_name as consumer_last_name,
          consumer.email as consumer_email,
          barber_user.id as barber_user_id,
          barber_user.first_name as barber_first_name,
          barber_user.last_name as barber_last_name,
          barber_user.email as barber_email,
          barber."campusId" as campus_id,
          COALESCE(campus.timezone, 'America/Los_Angeles') as campus_timezone
        FROM bookings b
        LEFT JOIN conversations c ON c.booking_id = b.id
        LEFT JOIN users consumer ON b."consumerId" = consumer.id
        LEFT JOIN barbers barber ON b."barberId" = barber.id
        LEFT JOIN users barber_user ON barber."userId" = barber_user.id
        LEFT JOIN campuses campus ON barber."campusId" = campus.id
        WHERE b.status = 'PENDING'
          AND (NOW() AT TIME ZONE COALESCE(campus.timezone, 'America/Los_Angeles'))::date
            > (b."requestedAt" AT TIME ZONE COALESCE(campus.timezone, 'America/Los_Angeles'))::date
      `);

      if (result.rows.length === 0) {
        return;
      }

      logger.info(`Found ${result.rows.length} stale pending booking(s) to auto-cancel`);

      for (const booking of result.rows) {
        try {
          const updated = await pool.query(
            `UPDATE bookings
             SET status = 'CANCELLED',
                 "cancelledAt" = NOW(),
                 "cancellationReason" = $2,
                 "updatedAt" = NOW()
             WHERE id = $1 AND status = 'PENDING'
             RETURNING id`,
            [booking.id, STALE_PENDING_CANCELLATION_REASON]
          );

          if (updated.rows.length === 0) {
            continue;
          }

          await cancelPendingRescheduleRequestsForBooking(booking.id, null);

          await pool.query(
            `DELETE FROM messages
             WHERE conversation_id IN (SELECT id FROM conversations WHERE booking_id = $1)`,
            [booking.id]
          );
          await pool.query(`DELETE FROM conversations WHERE booking_id = $1`, [booking.id]);

          const serviceName =
            booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';
          const consumerName =
            `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() ||
            'Customer';
          const barberName =
            `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() ||
            'Barber';
          const scheduledTime = new Date(booking.scheduled_time);
          const campusTimezone = booking.campus_timezone || 'America/Los_Angeles';
          const scheduledDate = scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: campusTimezone,
          });
          const scheduledTimeStr = scheduledTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: campusTimezone,
          });

          const consumerMsg = `Your ${serviceName} booking was automatically cancelled because the service provider did not accept it in time.`;
          await notificationService.saveNotification({
            userId: booking.consumerId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: consumerMsg,
            data: {
              bookingId: booking.id,
              reason: STALE_PENDING_CANCELLATION_REASON,
              cancelledBy: 'system',
            },
          });
          await pushNotificationService.sendMirrorPush(
            booking.consumerId,
            'Booking Cancelled',
            consumerMsg,
            'booking_cancelled',
            {
              bookingId: booking.id,
              reason: STALE_PENDING_CANCELLATION_REASON,
              cancelledBy: 'system',
            }
          );

          const barberMsg = `A pending ${serviceName} request from ${consumerName} was automatically cancelled because it was not accepted in time.`;
          await notificationService.saveNotification({
            userId: booking.barber_user_id,
            type: 'booking_cancelled',
            title: 'Booking Auto-Cancelled',
            message: barberMsg,
            data: {
              bookingId: booking.id,
              reason: STALE_PENDING_CANCELLATION_REASON,
              cancelledBy: 'system',
            },
          });
          await pushNotificationService.sendMirrorPush(
            booking.barber_user_id,
            'Booking Auto-Cancelled',
            barberMsg,
            'booking_cancelled',
            {
              bookingId: booking.id,
              reason: STALE_PENDING_CANCELLATION_REASON,
              cancelledBy: 'system',
            }
          );

          const emailBase = {
            bookingId: booking.id.toString(),
            serviceName,
            serviceType: booking.serviceType || serviceName,
            price: (booking.priceUsdCents || 0) / 100,
            scheduledDate,
            scheduledTime: scheduledTimeStr,
            scheduledDateTime: scheduledTime.toISOString(),
            location: booking.location || undefined,
            consumerName,
            consumerEmail: booking.consumer_email,
            barberName,
            barberEmail: booking.barber_email,
            campusId: booking.campus_id || undefined,
            campusTimezone,
          };

          if (booking.barber_email) {
            sendBarberAutoCancellationEmail(emailBase).catch((err) =>
              logger.error(`Failed to send barber auto-cancel email for booking ${booking.id}:`, err.message)
            );
          }

          if (booking.consumer_email) {
            (async () => {
              let alternativeBarbers: {
                id: string;
                name: string;
                avatar?: string;
                avgRating?: number;
                totalReviews?: number;
              }[] = [];

              if (booking.campus_id && booking.barberId) {
                const alts = await fetchAlternativeBarbers(
                  booking.campus_id,
                  booking.barberId,
                  serviceName,
                  scheduledTime
                );
                alternativeBarbers = alts.map((b) => ({
                  id: b.id,
                  name: b.name,
                  avatar: b.avatar,
                  avgRating: b.average_rating,
                  totalReviews: b.total_reviews,
                }));
              }

              await sendConsumerAutoCancellationEmail({
                ...emailBase,
                alternativeBarbers,
              });
            })().catch((err) =>
              logger.error(`Failed to send consumer auto-cancel email for booking ${booking.id}:`, err.message)
            );
          }

          cancelledCount++;
          logger.info(`✅ Auto-cancelled stale pending booking ${booking.id}`);
        } catch (error: any) {
          logger.error(`Failed to auto-cancel stale pending booking ${booking.id}:`, error.message);
        }
      }

      if (cancelledCount > 0) {
        logger.info(`🚫 Stale pending auto-cancellations processed: ${cancelledCount}`);
      }
    } catch (error: any) {
      logger.error('Error processing stale pending auto-cancellations:', error.message);
    }
  }
}

// Singleton instance
export const pendingBookingCronService = new PendingBookingCronService();

