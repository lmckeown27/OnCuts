/**
 * Performance metrics filters for the Admin Dashboard frontend.
 *
 * Bookings between two platform ADMIN accounts are internal/test traffic and
 * must not inflate list, graph, or aggregate frontend metrics.
 */

/** Prefer when consumer (cu) and barber user (bu) are already joined. */
export const SQL_EXCLUDE_ADMIN_ADMIN_BOOKING_JOINED = `NOT (
  UPPER(TRIM(cu.role::text)) = 'ADMIN'
  AND UPPER(TRIM(bu.role::text)) = 'ADMIN'
)`;

/** Use when the bookings row is available under the given SQL alias. */
export function sqlExcludeAdminAdminBooking(bookingAlias: string): string {
  return `NOT EXISTS (
    SELECT 1
    FROM users _ex_cu
    INNER JOIN barbers _ex_b ON _ex_b.id = ${bookingAlias}."barberId"
    INNER JOIN users _ex_bu ON _ex_bu.id = _ex_b."userId"
    WHERE _ex_cu.id = ${bookingAlias}."consumerId"
      AND UPPER(TRIM(_ex_cu.role::text)) = 'ADMIN'
      AND UPPER(TRIM(_ex_bu.role::text)) = 'ADMIN'
  )`;
}

export const EXCLUDE_ADMIN_ADMIN_BOOKINGS = sqlExcludeAdminAdminBooking('bookings');
export const EXCLUDE_ADMIN_ADMIN_BK = sqlExcludeAdminAdminBooking('bk');
