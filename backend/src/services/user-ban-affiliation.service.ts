/**
 * When a user receives a platform ban (isBanned), tear down active marketplace state
 * they participate in: bookings, chats, payouts, and payment rows tied to those bookings.
 */

import type { PoolClient } from 'pg';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { cancelPendingRescheduleRequestsForBookings } from './booking-cancellation.service';

async function safeSavepoint(client: PoolClient, label: string, fn: () => Promise<void>): Promise<void> {
  const sp = `sp_${label}_${Date.now()}`;
  try {
    await client.query(`SAVEPOINT ${sp}`);
    await fn();
    await client.query(`RELEASE SAVEPOINT ${sp}`);
  } catch (err: unknown) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    const e = err as { code?: string; message?: string };
    if (e.code === '42P01' || e.code === '42703') {
      logger.warn(`ban cleanup optional skipped (${label}): ${e.message}`);
      return;
    }
    throw err;
  }
}

export async function runBanAffiliationCleanupQueries(client: PoolClient, bannedUserId: string): Promise<void> {
  const bookingIdsRes = await client.query<{ id: string }>(
    `SELECT b.id FROM bookings b
     WHERE b.status NOT IN ('CANCELLED', 'REJECTED')
       AND (
         b."consumerId" = $1::uuid
         OR EXISTS (SELECT 1 FROM barbers bar WHERE bar.id = b."barberId" AND bar."userId" = $1::uuid)
       )`,
    [bannedUserId]
  );
  const bookingIds = bookingIdsRes.rows.map((r) => r.id);

  await client.query(
    `UPDATE bookings b
     SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
     WHERE b.status NOT IN ('CANCELLED', 'REJECTED')
       AND (
         b."consumerId" = $1::uuid
         OR EXISTS (SELECT 1 FROM barbers bar WHERE bar.id = b."barberId" AND bar."userId" = $1::uuid)
       )`,
    [bannedUserId]
  );

  if (bookingIds.length > 0) {
    await cancelPendingRescheduleRequestsForBookings(bookingIds, bannedUserId, client);

    await safeSavepoint(client, 'pending_payouts', async () => {
      await client.query(`DELETE FROM pending_payouts WHERE booking_id = ANY($1::uuid[])`, [bookingIds]);
    });

    await safeSavepoint(client, 'payments_cancel', async () => {
      await client.query(
        `UPDATE payments
         SET status = 'cancelled',
             failure_reason = COALESCE(failure_reason, 'Cancelled: platform ban')
         WHERE booking_id = ANY($1::uuid[])`,
        [bookingIds]
      );
    });

    await safeSavepoint(client, 'archived_booking_messages', async () => {
      await client.query(`DELETE FROM archived_booking_messages WHERE booking_id = ANY($1::uuid[])`, [
        bookingIds,
      ]);
    });
  }

  await client.query(
    `DELETE FROM messages m
     USING conversations c
     WHERE m.conversation_id = c.id
       AND (c.user1_id = $1::uuid OR c.user2_id = $1::uuid)`,
    [bannedUserId]
  );

  await client.query(`DELETE FROM conversations WHERE user1_id = $1::uuid OR user2_id = $1::uuid`, [
    bannedUserId,
  ]);

  logger.info('ban_affiliation_cleanup_done', {
    bannedUserId,
    cancelledBookingCount: bookingIds.length,
  });
}

/**
 * Runs cleanup in its own transaction, or participates in an existing one when `existingClient` is passed.
 */
export async function applyAffiliationCleanupForBannedUser(
  bannedUserId: string,
  existingClient?: PoolClient
): Promise<void> {
  if (existingClient) {
    await runBanAffiliationCleanupQueries(existingClient, bannedUserId);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await runBanAffiliationCleanupQueries(client, bannedUserId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
