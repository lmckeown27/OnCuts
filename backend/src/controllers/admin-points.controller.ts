/**
 * Admin Points — read-only balance browser for operator_points / client_points.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

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

/**
 * GET /api/admin/points/balances?kind=operator|client&limit&offset
 */
export const getPointsBalances = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { kind, table } = tableForKind(String(req.query.kind || '').trim().toLowerCase());
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    const exists = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS ok`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.ok) {
      throw new ApiError(404, `${table} not found — apply migration 093`);
    }

    const countResult = await pool.query<{ count: string; balance_sum: string }>(
      `SELECT COUNT(*)::text AS count,
              COALESCE(SUM(balance_pts), 0)::text AS balance_sum
       FROM ${table}`
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10) || 0;
    const balancePtsSum = parseInt(countResult.rows[0]?.balance_sum || '0', 10) || 0;

    const rowsResult = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         p.balance_pts,
         p.lifetime_earned_pts,
         p.lifetime_spent_pts,
         p.meta,
         p.created_at,
         p.updated_at,
         u.email,
         COALESCE(
           NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
           NULLIF(BTRIM(to_jsonb(u)->>'displayName'), ''),
           NULLIF(BTRIM(u.email), ''),
           p.user_id::text
         ) AS display_name
       FROM ${table} p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.updated_at DESC NULLS LAST, p.id
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const items = rowsResult.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      displayName: row.display_name != null ? String(row.display_name) : null,
      email: row.email != null ? String(row.email) : null,
      balancePts: Number(row.balance_pts) || 0,
      lifetimeEarnedPts: Number(row.lifetime_earned_pts) || 0,
      lifetimeSpentPts: Number(row.lifetime_spent_pts) || 0,
      meta: row.meta ?? {},
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    }));

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
