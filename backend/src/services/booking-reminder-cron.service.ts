/**
 * Booking Reminder Cron Service
 *
 * Sends APNs/FCM push reminders at 24h, 12h, 3h, 1h, and at start for upcoming bookings
 * (ACCEPTED or PAID — service may already be paid). COMPLETED is never reminded.
 * Respects booking_reminders and push_notifications (defaults true). No SMTP.
 *
 * Schedule: every 5 minutes; each tier uses a ±5 minute window around the target lead time.
 */

import cron from 'node-cron';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import pushNotificationService from './pushNotification.service';

const REMINDER_TIERS = [
  { hours: 24, column: 'reminder_24h_sent' as const },
  { hours: 12, column: 'reminder_12h_sent' as const },
  { hours: 3, column: 'reminder_3h_sent' as const },
  { hours: 1, column: 'reminder_1h_sent' as const },
  { hours: 0, column: 'reminder_0h_sent' as const },
];

/**
 * Helper to format service type: "HAIRCUT" -> "Haircut", "BEARD_TRIM" -> "Beard Trim"
 */
function formatServiceType(type: string): string {
  if (!type) return 'Haircut';
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function wantsBookingReminderPush(prefs: Record<string, unknown> | null | undefined): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  const bookingReminders = prefs.booking_reminders;
  const pushNotifications = prefs.push_notifications;
  if (bookingReminders === false) return false;
  if (pushNotifications === false) return false;
  return true;
}

export class BookingReminderCronService {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;

  start(): void {
    if (this.job) {
      logger.warn('Booking reminder cron job is already running');
      return;
    }

    this.job = cron.schedule('*/5 * * * *', async () => {
      await this.processBookingReminders();
    });

    logger.info('🔔 Booking reminder cron started (push, 24h/12h/3h/1h/start, every 5 minutes)');
  }

  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Booking reminder cron job stopped');
    }
  }

  private async ensureReminderTierColumns(): Promise<void> {
    for (const { column } of REMINDER_TIERS) {
      await pool.query(
        `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "${column}" BOOLEAN DEFAULT FALSE`
      );
    }
    await pool.query(`
      UPDATE bookings SET reminder_1h_sent = TRUE
      WHERE reminder_sent IS TRUE
        AND COALESCE(reminder_1h_sent, FALSE) = FALSE
    `);
  }

  private async markTierSent(bookingId: number | string, column: (typeof REMINDER_TIERS)[number]['column']): Promise<void> {
    await pool.query(`UPDATE bookings SET "${column}" = TRUE WHERE id = $1`, [bookingId]);
  }

  async processBookingReminders(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Booking reminder job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let pushesAttempted = 0;
    let pushesFailed = 0;

    try {
      await this.ensureReminderTierColumns();
      logger.debug('Checking for bookings needing reminder pushes...');

      for (const tier of REMINDER_TIERS) {
        const result = await pool.query(
          `
          SELECT
            b.id,
            b."consumerId",
            b."barberId",
            b."serviceType",
            b."priceUsdCents",
            b."requestedAt" AS scheduled_time,
            b.status,
            c.location,
            c.notes,
            c.service_name,
            consumer.first_name AS consumer_first_name,
            consumer.last_name AS consumer_last_name,
            consumer.notification_preferences AS consumer_notification_preferences,
            barber_user.id AS barber_user_id,
            barber_user.first_name AS barber_first_name,
            barber_user.last_name AS barber_last_name,
            barber_user.notification_preferences AS barber_notification_preferences,
            COALESCE(campus.timezone, 'America/Los_Angeles') AS campus_timezone
          FROM bookings b
          LEFT JOIN conversations c ON c.booking_id = b.id
          LEFT JOIN users consumer ON b."consumerId" = consumer.id
          LEFT JOIN barbers barber ON b."barberId" = barber.id
          LEFT JOIN users barber_user ON barber."userId" = barber_user.id
          LEFT JOIN campuses campus ON barber_user."campusId" = campus.id
          WHERE b.status IN ('ACCEPTED', 'PAID')
            AND b."requestedAt" BETWEEN NOW() + ($1::integer * INTERVAL '1 hour') - INTERVAL '5 minutes'
                                    AND NOW() + ($1::integer * INTERVAL '1 hour') + INTERVAL '5 minutes'
            AND b."${tier.column}" IS NOT TRUE
          `,
          [tier.hours]
        );

        for (const booking of result.rows) {
          try {
            const serviceName =
              booking.service_name || formatServiceType(booking.serviceType) || 'Haircut';

            const consumerPrefs = booking.consumer_notification_preferences || {};
            const barberPrefs = booking.barber_notification_preferences || {};

            const consumerName =
              `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() ||
              'Customer';
            const barberName =
              `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() ||
              'Your barber';

            const consumerOk = wantsBookingReminderPush(consumerPrefs);
            const barberOk = wantsBookingReminderPush(barberPrefs);

            if (consumerOk && booking.consumerId) {
              const r = await pushNotificationService.sendAppointmentReminderNotification(
                booking.consumerId,
                {
                  bookingId: booking.id,
                  hoursUntil: tier.hours,
                  service: serviceName,
                  counterpartyName: barberName,
                  role: 'consumer',
                }
              );
              pushesAttempted++;
              if (!r?.success) pushesFailed++;
            }

            if (barberOk && booking.barber_user_id) {
              const r = await pushNotificationService.sendAppointmentReminderNotification(
                booking.barber_user_id,
                {
                  bookingId: booking.id,
                  hoursUntil: tier.hours,
                  service: serviceName,
                  counterpartyName: consumerName,
                  role: 'barber',
                }
              );
              pushesAttempted++;
              if (!r?.success) pushesFailed++;
            }

            await this.markTierSent(booking.id, tier.column);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`Failed reminder tier ${tier.hours}h for booking ${booking.id}:`, msg);
            pushesFailed++;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `🔔 Booking reminder pushes finished: ${pushesAttempted} attempts (${pushesFailed} reported failures) in ${duration}ms`
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error processing booking reminders:', msg);
    } finally {
      this.isRunning = false;
    }
  }

  async runManually(): Promise<{ sent: number; failed: number }> {
    await this.processBookingReminders();
    return { sent: 0, failed: 0 };
  }
}

export const bookingReminderCronService = new BookingReminderCronService();
