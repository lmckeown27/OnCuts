/**
 * Admin Points — balance browser, user search, and manual point distribution.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { applyPointsDelta } from '../services/points-ledger.service';

type PointsKind = 'operator' | 'client';

function requireAdmin(req: AuthRequest): void {
  if (req.user!.role?.toLowerCase() !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
}

function tableForKind(kind: string): { kind: PointsKind; table: string } {
  if (kind === 'operator') return { kind: 'operator', table: 'operator_points' };
  if (kind === 'client') return { kind: 'client', table: 'client_points' };
  throw new ApiError(400, 'kind must be operator or client');
}

function roleFilterSql(kind: PointsKind): string {
  // ADMIN can hold both operator and client points (acts as either side).
  return kind === 'operator'
    ? `u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')`
    : `u.role IN ('CONSUMER', 'ADMIN')`;
}

function mapBalanceRow(row: Record<string, unknown>, includeRole = false) {
  const item: Record<string, unknown> = {
    id: String(row.id),
    userId: String(row.user_id),
    displayName: row.display_name != null ? String(row.display_name) : null,
    email: row.email != null ? String(row.email) : null,
    balancePts: Number(row.balance_pts) || 0,
    lifetimeEarnedPts: Number(row.lifetime_earned_pts) || 0,
    lifetimeSpentPts: Number(row.lifetime_spent_pts) || 0,
    lifetimeRevokedPts: Number(row.lifetime_revoked_pts) || 0,
    welcomeClaimed: Boolean(row.welcome_claimed),
    meta: row.meta ?? {},
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at ?? null,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at ?? null,
  };
  if (includeRole) {
    item.role = row.role != null ? String(row.role) : null;
  }
  return item;
}

async function loadBalanceForUser(table: string, userId: string) {
  const exists = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS ok`,
    [`public.${table}`]
  );
  if (!exists.rows[0]?.ok) return null;

  const result = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.balance_pts,
       p.lifetime_earned_pts,
       p.lifetime_spent_pts,
       COALESCE(p.lifetime_revoked_pts, 0) AS lifetime_revoked_pts,
       p.meta,
       p.created_at,
       p.updated_at,
       u.email,
       u.role,
       COALESCE(
         NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
         NULLIF(BTRIM(to_jsonb(u)->>'displayName'), ''),
         NULLIF(BTRIM(u.email), ''),
         p.user_id::text
       ) AS display_name,
       EXISTS (
         SELECT 1 FROM points_ledger pl
         WHERE pl.user_id = p.user_id AND pl.reason = 'admin_welcome_claim'
       ) AS welcome_claimed
     FROM ${table} p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? mapBalanceRow(result.rows[0], true) : null;
}

/**
 * GET /api/admin/points/balances?kind=operator|client&limit&offset&q=
 */
export const getPointsBalances = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { kind, table } = tableForKind(String(req.query.kind || '').trim().toLowerCase());
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const q = String(req.query.q || '').trim();

    const exists = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS ok`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.ok) {
      throw new ApiError(404, `${table} not found — apply migration 093`);
    }

    const params: unknown[] = [];
    let where = 'TRUE';
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where = `(
        u.email ILIKE $${i}
        OR u.first_name ILIKE $${i}
        OR u.last_name ILIKE $${i}
        OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE $${i}
        OR p.user_id::text ILIKE $${i}
      )`;
    }

    const countResult = await pool.query<{ count: string; balance_sum: string }>(
      `SELECT COUNT(*)::text AS count,
              COALESCE(SUM(p.balance_pts), 0)::text AS balance_sum
       FROM ${table} p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10) || 0;
    const balancePtsSum = parseInt(countResult.rows[0]?.balance_sum || '0', 10) || 0;

    const listParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const rowsResult = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         p.balance_pts,
         p.lifetime_earned_pts,
         p.lifetime_spent_pts,
         COALESCE(p.lifetime_revoked_pts, 0) AS lifetime_revoked_pts,
         p.meta,
         p.created_at,
         p.updated_at,
         u.email,
         u.role,
         COALESCE(
           NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
           NULLIF(BTRIM(to_jsonb(u)->>'displayName'), ''),
           NULLIF(BTRIM(u.email), ''),
           p.user_id::text
         ) AS display_name,
         EXISTS (
           SELECT 1 FROM points_ledger pl
           WHERE pl.user_id = p.user_id AND pl.reason = 'admin_welcome_claim'
         ) AS welcome_claimed
       FROM ${table} p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ${where}
       ORDER BY p.updated_at DESC NULLS LAST, p.id
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    const items = rowsResult.rows.map((row) => mapBalanceRow(row, true));

    res.json({
      success: true,
      data: {
        kind,
        items,
        total,
        limit,
        offset,
        totals: {
          balancePts: balancePtsSum,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/points/users?kind=operator|client&q=
 * Search users (with or without a points account) for distribution.
 */
export const searchPointsUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const { kind, table } = tableForKind(String(req.query.kind || '').trim().toLowerCase());
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.json({ success: true, data: { kind, items: [] } });
      return;
    }

    const exists = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS ok`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.ok) {
      throw new ApiError(404, `${table} not found — apply migration 093`);
    }

    const like = `%${q}%`;
    const result = await pool.query(
      `SELECT
         u.id AS user_id,
         u.email,
         u.role,
         COALESCE(
           NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
           NULLIF(BTRIM(to_jsonb(u)->>'displayName'), ''),
           NULLIF(BTRIM(u.email), ''),
           u.id::text
         ) AS display_name,
         COALESCE(p.balance_pts, 0) AS balance_pts,
         COALESCE(p.lifetime_earned_pts, 0) AS lifetime_earned_pts,
         COALESCE(p.lifetime_spent_pts, 0) AS lifetime_spent_pts,
         COALESCE(p.lifetime_revoked_pts, 0) AS lifetime_revoked_pts,
         p.id AS account_id,
         EXISTS (
           SELECT 1 FROM points_ledger pl
           WHERE pl.user_id = u.id AND pl.reason = 'admin_welcome_claim'
         ) AS welcome_claimed
       FROM users u
       LEFT JOIN ${table} p ON p.user_id = u.id
       WHERE ${roleFilterSql(kind)}
         AND (
           u.email ILIKE $1
           OR u.first_name ILIKE $1
           OR u.last_name ILIKE $1
           OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE $1
           OR u.id::text ILIKE $1
         )
       ORDER BY
         CASE WHEN u.email ILIKE $1 THEN 0 ELSE 1 END,
         display_name
       LIMIT 25`,
      [like]
    );

    res.json({
      success: true,
      data: {
        kind,
        items: result.rows.map((row) => ({
          userId: String(row.user_id),
          email: row.email != null ? String(row.email) : null,
          role: row.role != null ? String(row.role) : null,
          displayName: row.display_name != null ? String(row.display_name) : null,
          balancePts: Number(row.balance_pts) || 0,
          lifetimeEarnedPts: Number(row.lifetime_earned_pts) || 0,
          lifetimeSpentPts: Number(row.lifetime_spent_pts) || 0,
          lifetimeRevokedPts: Number(row.lifetime_revoked_pts) || 0,
          welcomeClaimed: Boolean(row.welcome_claimed),
          hasAccount: Boolean(row.account_id),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/points/user-balances?userId=
 * Returns operator + client balances for one user (null when no account yet).
 */
export const getUserPointsBalances = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const userId = String(req.query.userId || '').trim();
    if (!userId) throw new ApiError(400, 'userId is required');

    const user = await pool.query<{
      id: string;
      role: string;
      email: string | null;
      display_name: string | null;
    }>(
      `SELECT
         id,
         role,
         email,
         COALESCE(
           NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), ''),
           NULLIF(BTRIM(email), ''),
           id::text
         ) AS display_name
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!user.rows[0]) throw new ApiError(404, 'User not found');

    const role = String(user.rows[0].role || '').toUpperCase();
    const [operator, client] = await Promise.all([
      loadBalanceForUser('operator_points', userId),
      loadBalanceForUser('client_points', userId),
    ]);

    const welcome = await pool.query<{ claimed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM points_ledger
         WHERE user_id = $1 AND reason = 'admin_welcome_claim'
       ) AS claimed`,
      [userId]
    );

    const kinds: PointsKind[] = [];
    if (['BARBER', 'CAMPUS_MANAGER', 'ADMIN'].includes(role)) kinds.push('operator');
    if (['CONSUMER', 'ADMIN'].includes(role)) kinds.push('client');

    res.json({
      success: true,
      data: {
        userId,
        role,
        displayName: user.rows[0].display_name,
        email: user.rows[0].email,
        welcomeClaimed: Boolean(welcome.rows[0]?.claimed),
        availableKinds: kinds,
        operator,
        client,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/points/adjust
 * Body: { userId, kind, deltaPts, note? }
 * Positive deltaPts grants points; negative removes (cannot go below 0).
 */
export const adjustPoints = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const userId = String(req.body?.userId || '').trim();
    const { kind } = tableForKind(String(req.body?.kind || '').trim().toLowerCase());
    const deltaPts = Number(req.body?.deltaPts);
    const note = String(req.body?.note || '').trim().slice(0, 500);

    if (!userId) throw new ApiError(400, 'userId is required');
    if (!Number.isFinite(deltaPts) || !Number.isInteger(deltaPts) || deltaPts === 0) {
      throw new ApiError(400, 'deltaPts must be a non-zero integer');
    }
    if (Math.abs(deltaPts) > 1_000_000) {
      throw new ApiError(400, 'deltaPts magnitude too large');
    }

    const user = await pool.query<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!user.rows[0]) throw new ApiError(404, 'User not found');

    const role = String(user.rows[0].role || '').toUpperCase();
    if (kind === 'operator' && !['BARBER', 'CAMPUS_MANAGER', 'ADMIN'].includes(role)) {
      throw new ApiError(400, 'User is not an operator for operator points');
    }
    if (kind === 'client' && !['CONSUMER', 'ADMIN'].includes(role)) {
      throw new ApiError(400, 'User is not a client for client points');
    }

    const result = await applyPointsDelta({
      userId,
      kind,
      deltaPts,
      reason: deltaPts > 0 ? 'admin_grant' : 'admin_clawback',
      meta: {
        byAdminId: req.user?.userId || null,
        note: note || null,
      },
    });

    res.json({
      success: true,
      data: {
        userId,
        kind,
        deltaPts,
        balanceAfter: result.balanceAfter,
        ledgerId: result.ledgerId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/points/reset-welcome-claim
 * Body: { userId }
 * Deletes the admin_welcome_claim ledger row so the user can claim again.
 * Does not change their points balance.
 */
export const resetWelcomeClaim = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const userId = String(req.body?.userId || '').trim();
    if (!userId) throw new ApiError(400, 'userId is required');

    const user = await pool.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!user.rows[0]) throw new ApiError(404, 'User not found');

    const deleted = await pool.query(
      `DELETE FROM points_ledger
       WHERE user_id = $1 AND reason = 'admin_welcome_claim'
       RETURNING id, delta_pts`,
      [userId]
    );

    const removed = deleted.rowCount ?? 0;
    res.json({
      success: true,
      data: {
        userId,
        reset: removed > 0,
        removedLedgerRows: removed,
      },
    });
  } catch (error) {
    next(error);
  }
};
