/**
 * Atomic OnCuts Points mutations (balance table + ledger row).
 */

import { PoolClient } from 'pg';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';

export type PointsKind = 'operator' | 'client';

function tableForKind(kind: PointsKind): string {
  return kind === 'operator' ? 'operator_points' : 'client_points';
}

async function withClient<T>(client: PoolClient | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (client) return fn(client);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}

export async function ensurePointsAccount(
  userId: string,
  kind: PointsKind,
  client?: PoolClient | null
): Promise<void> {
  const table = tableForKind(kind);
  await withClient(client || null, async (c) => {
    await c.query(
      `INSERT INTO ${table} (user_id, balance_pts, lifetime_earned_pts, lifetime_spent_pts)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
  });
}

export async function applyPointsDelta(opts: {
  userId: string;
  kind: PointsKind;
  deltaPts: number;
  reason: string;
  referralAttributionId?: string | null;
  bookingId?: string | null;
  availableAt?: Date | null;
  meta?: Record<string, unknown>;
  client?: PoolClient | null;
}): Promise<{ ledgerId: string; balanceAfter: number }> {
  if (!Number.isFinite(opts.deltaPts) || opts.deltaPts === 0) {
    throw new ApiError(400, 'deltaPts must be a non-zero number');
  }

  return withClient(opts.client || null, async (c) => {
    const table = tableForKind(opts.kind);
    await c.query(
      `INSERT INTO ${table} (user_id, balance_pts, lifetime_earned_pts, lifetime_spent_pts)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [opts.userId]
    );

    const locked = await c.query<{ balance_pts: number }>(
      `SELECT balance_pts FROM ${table} WHERE user_id = $1 FOR UPDATE`,
      [opts.userId]
    );
    const current = Number(locked.rows[0]?.balance_pts) || 0;
    const next = current + opts.deltaPts;
    if (next < 0) {
      throw new ApiError(400, 'Insufficient points balance');
    }

    if (opts.deltaPts > 0) {
      await c.query(
        `UPDATE ${table}
         SET balance_pts = $2,
             lifetime_earned_pts = lifetime_earned_pts + $3,
             updated_at = NOW()
         WHERE user_id = $1`,
        [opts.userId, next, opts.deltaPts]
      );
    } else {
      await c.query(
        `UPDATE ${table}
         SET balance_pts = $2,
             lifetime_spent_pts = lifetime_spent_pts + $3,
             updated_at = NOW()
         WHERE user_id = $1`,
        [opts.userId, next, Math.abs(opts.deltaPts)]
      );
    }

    const ledger = await c.query(
      `INSERT INTO points_ledger
         (user_id, kind, delta_pts, balance_after_pts, reason, referral_attribution_id, booking_id, available_at, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), $9::jsonb)
       RETURNING id`,
      [
        opts.userId,
        opts.kind,
        opts.deltaPts,
        next,
        opts.reason,
        opts.referralAttributionId || null,
        opts.bookingId || null,
        opts.availableAt || null,
        JSON.stringify(opts.meta || {}),
      ]
    );

    return { ledgerId: ledger.rows[0].id, balanceAfter: next };
  });
}

export async function getPointsHistory(userId: string, kind: PointsKind, limit = 50) {
  const r = await pool.query(
    `SELECT id, delta_pts, balance_after_pts, reason, referral_attribution_id, booking_id, available_at, created_at, meta
     FROM points_ledger
     WHERE user_id = $1 AND kind = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, kind, Math.min(limit, 200)]
  );
  return r.rows.map((row) => ({
    id: row.id,
    deltaPts: Number(row.delta_pts),
    balanceAfterPts: Number(row.balance_after_pts),
    reason: row.reason,
    referralAttributionId: row.referral_attribution_id,
    bookingId: row.booking_id,
    availableAt: row.available_at,
    createdAt: row.created_at,
    meta: row.meta,
  }));
}

export async function getPendingPoints(userId: string, kind: PointsKind): Promise<number> {
  const r = await pool.query<{ pending: string }>(
    `SELECT COALESCE(SUM(delta_pts), 0)::text AS pending
     FROM points_ledger
     WHERE user_id = $1 AND kind = $2 AND delta_pts > 0 AND available_at > NOW()`,
    [userId, kind]
  );
  return Number(r.rows[0]?.pending) || 0;
}
