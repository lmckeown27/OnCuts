/**
 * Shared consumer/barber booking cancellation (status CANCELLED, remove thread, notify, email, socket).
 * Used by DELETE /bookings-simple/:id and DELETE /messages/conversations/:id when a booking is linked.
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { sendTemplatedNotification } from './notification-template.service';
import { sendBookingCancellationEmails } from './email.service';
import { bookingStatusBlocksScheduleSql } from './barber-availability.service';

/** Allowed preset hours for client-cancel full-refund window. */
export const CLIENT_CANCEL_REFUND_HOUR_PRESETS = [1, 2, 4, 6, 12, 24] as const;
export type ClientCancelRefundHours = (typeof CLIENT_CANCEL_REFUND_HOUR_PRESETS)[number];

/** Default when missing/invalid — matches historical hard-coded 1 hour. */
export const DEFAULT_CLIENT_CANCEL_REFUND_HOURS: ClientCancelRefundHours = 1;

/** @deprecated Prefer resolveClientCancelRefundWindowMs; kept for tests/compat. */
export const CONSUMER_CANCEL_NO_REFUND_WINDOW_MS = 60 * 60 * 1000;

export function resolveClientCancelRefundHours(
  value: unknown
): ClientCancelRefundHours {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (
    CLIENT_CANCEL_REFUND_HOUR_PRESETS.includes(n as ClientCancelRefundHours)
  ) {
    return n as ClientCancelRefundHours;
  }
  return DEFAULT_CLIENT_CANCEL_REFUND_HOURS;
}

export function resolveClientCancelRefundWindowMs(hours?: unknown): number {
  return resolveClientCancelRefundHours(hours) * 60 * 60 * 1000;
}

export type CancellationActor = 'consumer' | 'barber' | 'admin';

/**
 * Refund policy for paid bookings:
 * - Operator/admin cancel → always full refund
 * - Consumer cancel ≥ X hours before appointment → full refund
 * - Consumer cancel within X hours of (or after) appointment → no refund
 * X defaults to 1 hour and is set per operator (client_cancel_refund_hours).
 */
export function shouldRefundOnCancellation(params: {
  cancelledBy: CancellationActor;
  scheduledTime: Date | string | null | undefined;
  now?: Date;
  /** Operator-configured hours; invalid/missing → 1 */
  refundHours?: unknown;
}): boolean {
  if (params.cancelledBy === 'barber' || params.cancelledBy === 'admin') {
    return true;
  }

  if (params.scheduledTime == null || params.scheduledTime === '') {
    // Fail closed for consumer when schedule is unknown — no refund.
    return false;
  }

  const scheduledMs = new Date(params.scheduledTime).getTime();
  if (Number.isNaN(scheduledMs)) {
    return false;
  }

  const windowMs = resolveClientCancelRefundWindowMs(params.refundHours);
  const nowMs = (params.now ?? new Date()).getTime();
  return nowMs < scheduledMs - windowMs;
}

function mergeConversationLocation(
  loc: string | null | undefined,
  details: string | null | undefined
): string | null {
  const a = loc != null ? String(loc).trim() : '';
  const b = details != null ? String(details).trim() : '';
  if (a && b) return `${a} — ${b}`;
  return a || b || null;
}

export interface BookingCancellationRow {
  id: string;
  status: string;
  consumerId: string;
  serviceType: string;
  priceUsdCents: number;
  scheduledTime: Date | string;
  location?: string | null;
  location_details?: string | null;
  original_service_name?: string | null;
  barberId: string;
  barber_user_id: string;
  campus_id?: string | null;
  consumer_first_name?: string | null;
  consumer_last_name?: string | null;
  consumer_email?: string | null;
  barber_first_name?: string | null;
  barber_last_name?: string | null;
  barber_email?: string | null;
  campus_timezone?: string | null;
}

type DbQueryable = Pick<typeof pool, 'query'>;

/** Mark pending schedule-change requests as cancelled when the booking is cancelled/rejected. */
export async function cancelPendingRescheduleRequestsForBooking(
  bookingId: string,
  respondedBy: string | null = null,
  client: DbQueryable = pool
): Promise<number> {
  const result = await client.query(
    `UPDATE booking_reschedule_requests
     SET status = 'cancelled',
         responded_at = CURRENT_TIMESTAMP,
         responded_by = $2
     WHERE booking_id = $1 AND status = 'pending'
     RETURNING id`,
    [bookingId, respondedBy]
  );
  const count = result.rowCount ?? 0;
  if (count > 0) {
    logger.info(`Auto-cancelled ${count} pending reschedule request(s) for booking ${bookingId}`);
  }
  return count;
}

export async function cancelPendingRescheduleRequestsForBookings(
  bookingIds: string[],
  respondedBy: string | null = null,
  client: DbQueryable = pool
): Promise<number> {
  if (bookingIds.length === 0) return 0;

  const result = await client.query(
    `UPDATE booking_reschedule_requests
     SET status = 'cancelled',
         responded_at = CURRENT_TIMESTAMP,
         responded_by = $2
     WHERE booking_id = ANY($1::uuid[]) AND status = 'pending'
     RETURNING id`,
    [bookingIds, respondedBy]
  );
  const count = result.rowCount ?? 0;
  if (count > 0) {
    logger.info(`Auto-cancelled ${count} pending reschedule request(s) for ${bookingIds.length} booking(s)`);
  }
  return count;
}

export async function fetchBookingForParticipantCancellation(
  bookingId: string,
  userId: string
): Promise<BookingCancellationRow | null> {
  const bookingCheck = await pool.query(
    `SELECT b.id, b.status, b."consumerId", b."serviceType", b."priceUsdCents", b."requestedAt" as "scheduledTime",
            c.location, c.location_details, c.service_name as original_service_name,
            bar.id as "barberId", bar."userId" as barber_user_id, bar."campusId" as campus_id,
            u_consumer.first_name as consumer_first_name, u_consumer.last_name as consumer_last_name, u_consumer.email as consumer_email,
            u_barber.first_name as barber_first_name, u_barber.last_name as barber_last_name, u_barber.email as barber_email,
            COALESCE(campus.timezone, 'America/New_York') as campus_timezone
     FROM bookings b
     JOIN barbers bar ON b."barberId" = bar.id
     JOIN users u_consumer ON b."consumerId" = u_consumer.id
     JOIN users u_barber ON bar."userId" = u_barber.id
     LEFT JOIN conversations c ON c.booking_id = b.id
     LEFT JOIN campuses campus ON bar."campusId" = campus.id
     WHERE b.id = $1 AND (bar."userId" = $2 OR b."consumerId" = $2)`,
    [bookingId, userId]
  );
  return (bookingCheck.rows[0] as BookingCancellationRow) || null;
}

/**
 * Cancel booking, delete linked conversation + messages, notify, email, websocket.
 * Caller must ensure status is neither COMPLETED/PAID nor already CANCELLED.
 */
export async function executeParticipantBookingCancellation(
  booking: BookingCancellationRow,
  userId: string,
  isBarber: boolean,
  reason: string | null | undefined
): Promise<void> {
  const id = booking.id;

  await pool.query(
    `UPDATE bookings 
     SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id]
  );

  await cancelPendingRescheduleRequestsForBooking(id, userId);

  const convResult = await pool.query(`SELECT id FROM conversations WHERE booking_id = $1`, [id]);

  if (convResult.rows.length > 0) {
    const conversationId = convResult.rows[0].id;
    await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
    await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
    logger.info(`Deleted conversation ${conversationId} and its messages for cancelled booking ${id}`);
  }

  const barberName = `${booking.barber_first_name || ''} ${booking.barber_last_name || ''}`.trim() || 'Your barber';
  const consumerName = `${booking.consumer_first_name || ''} ${booking.consumer_last_name || ''}`.trim() || 'Customer';
  const serviceName = booking.original_service_name || booking.serviceType;

  if (isBarber) {
    const cancelMsg = `${barberName} has cancelled your ${serviceName} appointment${reason ? `. Reason: ${reason}` : ''}`;
    await sendTemplatedNotification({
      userId: booking.consumerId,
      key: 'booking_cancelled',
      side: 'consumer',
      vars: { message: cancelMsg },
      type: 'booking_cancelled',
      data: {
        bookingId: id,
        reason,
        cancelledBy: 'barber',
        scheduledTime: booking.scheduledTime,
        serviceType: booking.serviceType,
        campusId: booking.campus_id,
        cancelledBarberId: booking.barberId,
      },
      fallbackTitle: 'Booking Cancelled',
      fallbackBody: cancelMsg,
    });
  } else {
    const cancelMsgBarber = `${consumerName} has cancelled their ${serviceName} appointment${reason ? `. Reason: ${reason}` : ''}`;
    await sendTemplatedNotification({
      userId: booking.barber_user_id,
      key: 'booking_cancelled',
      side: 'operator',
      vars: { message: cancelMsgBarber },
      type: 'booking_cancelled',
      data: { bookingId: id, reason, cancelledBy: 'consumer' },
      fallbackTitle: 'Booking Cancelled',
      fallbackBody: cancelMsgBarber,
    });
  }

  const scheduledDate = new Date(booking.scheduledTime as string);
  const campusTimezone = booking.campus_timezone || 'America/Los_Angeles';

  let alternativeBarbers: {
    id: string;
    name: string;
    avatar?: string;
    avgRating?: number;
    totalReviews?: number;
  }[] = [];

  if (isBarber && booking.campus_id) {
    try {
      const dateStr = scheduledDate.toLocaleDateString('en-CA', { timeZone: campusTimezone });
      const timeStr = scheduledDate.toLocaleTimeString('en-US', {
        timeZone: campusTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const [requestedHour, requestedMinutes] = timeStr.split(':').map(Number);
      const requestedTimeInMinutes = requestedHour * 60 + requestedMinutes;

      logger.info(
        `[Cancellation Email] Checking availability at ${dateStr} ${timeStr} (${requestedTimeInMinutes} min) in timezone ${campusTimezone}`
      );

      const barbersResult = await pool.query(
        `
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
            AND b.is_hidden = false
            AND (u."isBanned" IS NOT TRUE)
        `,
        [booking.campus_id, booking.barberId]
      );

      const serviceTypeNorm = booking.serviceType?.toUpperCase().replace(/_/g, ' ').replace(/AND/g, '&');
      const barbersWithService = barbersResult.rows.filter((barberRow) => {
        const pricing = barberRow.pricing || [];
        return pricing.some((service: { name?: string; type?: string; service_type?: string }) => {
          const n = (service.name || service.type || service.service_type || '')
            .toUpperCase()
            .replace(/_/g, ' ')
            .replace(/AND/g, '&');
          return (
            n === serviceTypeNorm ||
            n.includes(serviceTypeNorm || '') ||
            (serviceTypeNorm && serviceTypeNorm.includes(n))
          );
        });
      });

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const [year, month, day] = dateStr.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      const dayName = dayNames[localDate.getDay()];

      for (const barberRow of barbersWithService) {
        const weeklySchedule = barberRow.weekly_schedule || {};
        const daySchedule = weeklySchedule[dayName];
        if (!daySchedule || !daySchedule.enabled) continue;

        let intervals: { start: string; end: string }[] = [];
        if (daySchedule.intervals && Array.isArray(daySchedule.intervals)) {
          intervals = daySchedule.intervals;
        } else if (daySchedule.start && daySchedule.end) {
          intervals = [{ start: daySchedule.start, end: daySchedule.end }];
        }

        const inInterval = intervals.some((interval) => {
          const [startHour, startMin] = interval.start.split(':').map(Number);
          const [endHour, endMin] = interval.end.split(':').map(Number);
          const intervalStart = startHour * 60 + startMin;
          const intervalEnd = endHour * 60 + endMin;
          return requestedTimeInMinutes >= intervalStart && requestedTimeInMinutes < intervalEnd;
        });
        if (!inInterval) continue;

        const conflictCheck = await pool.query(
          `
            SELECT 1 FROM bookings 
            WHERE "barberId" = $1 
              AND DATE("requestedAt" AT TIME ZONE 'America/Los_Angeles') = $2
              AND ${bookingStatusBlocksScheduleSql('status')}
              AND (
                EXTRACT(HOUR FROM "requestedAt" AT TIME ZONE 'America/Los_Angeles') * 60 +
                EXTRACT(MINUTE FROM "requestedAt" AT TIME ZONE 'America/Los_Angeles')
              ) BETWEEN $3 AND $4
            LIMIT 1
          `,
          [barberRow.id, dateStr, requestedTimeInMinutes - 59, requestedTimeInMinutes + 59]
        );
        if (conflictCheck.rows.length > 0) continue;

        const blockCheck = await pool.query(
          `
            SELECT 1 FROM barber_time_blocks 
            WHERE barber_id = $1 
              AND block_date = $2
              AND (
                (EXTRACT(HOUR FROM start_time) * 60 + EXTRACT(MINUTE FROM start_time)) <= $3
                AND (EXTRACT(HOUR FROM end_time) * 60 + EXTRACT(MINUTE FROM end_time)) > $3
              )
            LIMIT 1
          `,
          [barberRow.id, dateStr, requestedTimeInMinutes]
        );
        if (blockCheck.rows.length > 0) continue;

        alternativeBarbers.push({
          id: barberRow.id,
          name: barberRow.name,
          avatar: barberRow.avatar,
          avgRating: barberRow.avg_rating ? parseFloat(barberRow.avg_rating) : undefined,
          totalReviews: barberRow.total_reviews ? parseInt(barberRow.total_reviews, 10) : undefined,
        });
        if (alternativeBarbers.length >= 5) break;
      }

      logger.info(`Found ${alternativeBarbers.length} alternative barbers for cancelled booking ${id}`);
    } catch (altError: unknown) {
      logger.error(
        'Error fetching alternative barbers for cancellation email:',
        altError instanceof Error ? altError.message : altError
      );
    }
  }

  await sendBookingCancellationEmails({
    bookingId: id,
    serviceName,
    serviceType: booking.serviceType,
    price: (booking.priceUsdCents || 0) / 100,
    scheduledDate: scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: campusTimezone,
    }),
    scheduledTime: scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: campusTimezone,
    }),
    scheduledDateTime:
      typeof booking.scheduledTime === 'string'
        ? booking.scheduledTime
        : (booking.scheduledTime as Date).toISOString(),
    location: mergeConversationLocation(booking.location, booking.location_details) ?? undefined,
    consumerName,
    consumerEmail: booking.consumer_email ?? '',
    barberName,
    barberEmail: booking.barber_email ?? '',
    cancelledBy: isBarber ? 'barber' : 'consumer',
    reason: reason ?? undefined,
    alternativeBarbers: alternativeBarbers.length > 0 ? alternativeBarbers : undefined,
  });

  logger.info(`Booking ${id} cancelled by ${isBarber ? 'barber' : 'consumer'} ${userId}`);

  const bookingUpdate = {
    id,
    status: 'CANCELLED',
    barberId: booking.barberId,
    consumerId: booking.consumerId,
    campusId: booking.campus_id,
    scheduledTime: booking.scheduledTime,
    serviceType: booking.serviceType,
    cancelledBy: isBarber ? 'barber' : 'consumer',
    updatedBy: isBarber ? 'barber' : 'consumer',
    cancelled: true,
  };

  const { getSocketIO } = await import('../index');
  const io = getSocketIO();
  if (io) {
    io.to(`user-${booking.barber_user_id}`).emit('booking-update', bookingUpdate);
    io.to(`user-${booking.consumerId}`).emit('booking-update', bookingUpdate);
    logger.info(`Emitted booking-update event for cancelled booking ${id}`);
  }
}
