/**
 * Booking Reminder Cron Service
 * 
 * Sends reminder emails to BOTH consumers and barbers 1 hour before their scheduled appointments.
 * Respects user notification preferences (booking_reminders setting) for consumers.
 * 
 * Schedule: Runs every 5 minutes to catch bookings within the reminder window.
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { sendBookingReminderEmail, sendBarberReminderEmail } from './email.service';

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

export class BookingReminderCronService {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the booking reminder cron job
   * Runs every 5 minutes to check for upcoming bookings
   */
  start(): void {
    if (this.job) {
      logger.warn('Booking reminder cron job is already running');
      return;
    }

    // Run every 5 minutes
    this.job = cron.schedule('*/5 * * * *', async () => {
      await this.processBookingReminders();
    });

    logger.info('📧 Booking reminder cron job started (runs every 5 minutes)');
  }

  /**
   * Stop the booking reminder cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Booking reminder cron job stopped');
    }
  }

  /**
   * Process booking reminders
   * Finds bookings that are scheduled approximately 1 hour from now
   * and sends reminder emails to consumers who have booking_reminders enabled
   */
  async processBookingReminders(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Booking reminder job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      logger.debug('Checking for bookings needing reminders...');

      // Find bookings that:
      // 1. Are in 'accepted' status (confirmed bookings)
      // 2. Are scheduled between 55 and 65 minutes from now (1 hour window with buffer)
      // 3. Have not already had a reminder sent
      // 4. Consumer has booking_reminders enabled (or default true if not set)
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
          c.notes,
          c.service_name,
          consumer.email as consumer_email,
          consumer.first_name as consumer_first_name,
          consumer.last_name as consumer_last_name,
          consumer.notification_preferences as consumer_notification_preferences,
          barber_user.first_name as barber_first_name,
          barber_user.last_name as barber_last_name,
          barber_user.email as barber_email,
          COALESCE(campus.timezone, 'America/Los_Angeles') as campus_timezone
        FROM bookings b
        LEFT JOIN conversations c ON c.booking_id = b.id
        LEFT JOIN users consumer ON b."consumerId" = consumer.id
        LEFT JOIN barbers barber ON b."barberId" = barber.id
        LEFT JOIN users barber_user ON barber."userId" = barber_user.id
        LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
        WHERE b.status = 'ACCEPTED'
          AND b."requestedAt" BETWEEN NOW() + INTERVAL '55 minutes' AND NOW() + INTERVAL '65 minutes'
          AND b.reminder_sent IS NOT TRUE
          AND consumer.email IS NOT NULL
      `);

      if (result.rows.length === 0) {
        logger.debug('No bookings found needing reminders');
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${result.rows.length} bookings needing reminders`);

      for (const booking of result.rows) {
        try {
          // Check if consumer has booking_reminders enabled
          const prefs = booking.consumer_notification_preferences || {};
          const bookingRemindersEnabled = prefs.booking_reminders !== false; // Default to true

          if (!bookingRemindersEnabled) {
            logger.debug(`Skipping reminder for booking ${booking.id} - consumer has disabled booking reminders`);
            // Mark as sent so we don't keep checking
            await this.markReminderSent(booking.id);
            continue;
          }

          // Also check if email_notifications is enabled
          const emailEnabled = prefs.email_notifications !== false; // Default to true
          if (!emailEnabled) {
            logger.debug(`Skipping reminder for booking ${booking.id} - consumer has disabled email notifications`);
            await this.markReminderSent(booking.id);
            continue;
          }

          // Get service display name
          // Prefer original service name from conversation, fallback to formatted enum
          const serviceName = booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';

          // Format date and time using the barber's campus timezone
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

          // Build email details
          const emailDetails = {
            bookingId: booking.id.toString(),
            serviceName,
            price: (booking.priceUsdCents || 0) / 100,
            scheduledDate,
            scheduledTime: scheduledTimeStr,
            location: booking.location,
            notes: booking.notes,
            consumerName: `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() || 'Customer',
            consumerEmail: booking.consumer_email,
            barberName: `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() || 'Your Barber',
            barberEmail: booking.barber_email || ''
          };

          // Send the reminder email to consumer
          await sendBookingReminderEmail(emailDetails);
          logger.info(`✅ Consumer reminder sent for booking ${booking.id} to ${booking.consumer_email}`);

          // Send reminder email to barber
          if (booking.barber_email) {
            try {
              await sendBarberReminderEmail(emailDetails);
              logger.info(`✅ Barber reminder sent for booking ${booking.id} to ${booking.barber_email}`);
            } catch (barberError: any) {
              logger.error(`Failed to send barber reminder for booking ${booking.id}:`, barberError.message);
              // Don't fail the whole process if barber email fails
            }
          }

          // Mark reminder as sent
          await this.markReminderSent(booking.id);

          emailsSent++;
          logger.info(`✅ Reminders sent for booking ${booking.id}`);

        } catch (error: any) {
          emailsFailed++;
          logger.error(`Failed to send reminder for booking ${booking.id}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`📧 Booking reminders processed: ${emailsSent} sent, ${emailsFailed} failed (${duration}ms)`);

    } catch (error: any) {
      logger.error('Error processing booking reminders:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Mark a booking's reminder as sent
   */
  private async markReminderSent(bookingId: number | string): Promise<void> {
    try {
      // First, ensure the reminder_sent column exists
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE
      `);

      // Then update the booking
      await pool.query(
        'UPDATE bookings SET reminder_sent = TRUE WHERE id = $1',
        [bookingId]
      );
    } catch (error: any) {
      logger.error(`Failed to mark reminder sent for booking ${bookingId}:`, error.message);
    }
  }

  /**
   * Run reminders manually (for testing)
   */
  async runManually(): Promise<{ sent: number; failed: number }> {
    await this.processBookingReminders();
    return { sent: 0, failed: 0 }; // Return placeholder - actual counts logged
  }
}

// Singleton instance
export const bookingReminderCronService = new BookingReminderCronService();

