/**
 * Barber Check-In Cron Service
 * 
 * Sends check-in emails to barbers when 1 hour has passed since their
 * scheduled booking time and they have not updated the booking status.
 * 
 * This prompts barbers to either:
 * - Mark the booking as complete (request payment)
 * - Edit the booking (reschedule)
 * - Cancel the booking (if unable to complete)
 * 
 * Schedule: Runs every 5 minutes to catch overdue bookings.
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { sendBarberCheckInEmail } from './email.service';

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

export class BarberCheckInCronService {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the barber check-in cron job
   * Runs every 5 minutes to check for overdue bookings
   */
  start(): void {
    if (this.job) {
      logger.warn('Barber check-in cron job is already running');
      return;
    }

    // Run every 5 minutes
    this.job = cron.schedule('*/5 * * * *', async () => {
      await this.processBarberCheckIns();
    });

    logger.info('📧 Barber check-in cron job started (runs every 5 minutes)');
  }

  /**
   * Stop the barber check-in cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Barber check-in cron job stopped');
    }
  }

  /**
   * Process barber check-ins
   * Finds bookings that are more than 1 hour past their scheduled time
   * but still in 'accepted' status and sends check-in emails to barbers
   */
  async processBarberCheckIns(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Barber check-in job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      logger.debug('Checking for overdue bookings needing barber check-in...');

      // Ensure the barber_checkin_sent column exists
      await this.ensureColumnExists();

      // Find bookings that:
      // 1. Are in 'accepted' status (confirmed but not completed)
      // 2. Are more than 1 hour past their scheduled time (but not more than 48 hours to avoid spamming very old bookings)
      // 3. Have not already had a barber check-in email sent
      // 4. Barber has email notifications enabled (or default true if not set)
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
          consumer.first_name as consumer_first_name,
          consumer.last_name as consumer_last_name,
          barber_user.first_name as barber_first_name,
          barber_user.last_name as barber_last_name,
          barber_user.email as barber_email,
          barber_user.notification_preferences as barber_notification_preferences
        FROM bookings b
        LEFT JOIN conversations c ON c.booking_id = b.id
        LEFT JOIN users consumer ON b."consumerId" = consumer.id
        LEFT JOIN barbers barber ON b."barberId" = barber.id
        LEFT JOIN users barber_user ON barber."userId" = barber_user.id
        WHERE b.status = 'accepted'
          AND b."requestedAt" < NOW() - INTERVAL '1 hour'
          AND b."requestedAt" > NOW() - INTERVAL '48 hours'
          AND b.barber_checkin_sent IS NOT TRUE
          AND barber_user.email IS NOT NULL
      `);

      if (result.rows.length === 0) {
        logger.debug('No overdue bookings found needing barber check-in');
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${result.rows.length} overdue bookings needing barber check-in`);

      for (const booking of result.rows) {
        try {
          // Check if barber has email notifications enabled
          const prefs = booking.barber_notification_preferences || {};
          const emailEnabled = prefs.email_notifications !== false; // Default to true
          const bookingNotificationsEnabled = prefs.bookings !== false; // Default to true

          if (!emailEnabled || !bookingNotificationsEnabled) {
            logger.debug(`Skipping check-in for booking ${booking.id} - barber has disabled email/booking notifications`);
            // Mark as sent so we don't keep checking
            await this.markCheckInSent(booking.id);
            continue;
          }

          // Get service display name
          // Prefer original service name from conversation, fallback to formatted enum
          const serviceName = booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';

          // Format date and time
          const scheduledTime = new Date(booking.scheduled_time);
          const scheduledDate = scheduledTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const scheduledTimeStr = scheduledTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          // Build email details
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

          // Send the check-in email
          await sendBarberCheckInEmail(emailDetails);

          // Mark check-in as sent
          await this.markCheckInSent(booking.id);

          emailsSent++;
          logger.info(`✅ Barber check-in email sent for booking ${booking.id} to ${booking.barber_email}`);

        } catch (error: any) {
          emailsFailed++;
          logger.error(`Failed to send barber check-in for booking ${booking.id}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`📧 Barber check-ins processed: ${emailsSent} sent, ${emailsFailed} failed (${duration}ms)`);

    } catch (error: any) {
      logger.error('Error processing barber check-ins:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ensure the barber_checkin_sent column exists in the bookings table
   */
  private async ensureColumnExists(): Promise<void> {
    try {
      await pool.query(`
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_checkin_sent BOOLEAN DEFAULT FALSE
      `);
    } catch (error: any) {
      // Column might already exist, that's fine
      logger.debug('barber_checkin_sent column already exists or creation failed:', error.message);
    }
  }

  /**
   * Mark a booking's barber check-in as sent
   */
  private async markCheckInSent(bookingId: number | string): Promise<void> {
    try {
      await pool.query(
        'UPDATE bookings SET barber_checkin_sent = TRUE WHERE id = $1',
        [bookingId]
      );
    } catch (error: any) {
      logger.error(`Failed to mark barber check-in sent for booking ${bookingId}:`, error.message);
    }
  }

  /**
   * Run check-ins manually (for testing)
   */
  async runManually(): Promise<{ sent: number; failed: number }> {
    await this.processBarberCheckIns();
    return { sent: 0, failed: 0 }; // Return placeholder - actual counts logged
  }
}

// Singleton instance
export const barberCheckInCronService = new BarberCheckInCronService();

