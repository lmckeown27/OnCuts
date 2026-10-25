/**
 * Authenticated OnCuts Points — current user's balance.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

type PointsKind = 'operator' | 'client';

function tableForKind(kind: string): { kind: PointsKind; table: string } {
  if (kind === 'operator') return { kind: 'operator', table: 'operator_points' };
  if (kind === 'client') return { kind: 'client', table: 'client_points' };
  throw new ApiError(400, 'kind must be operator or client');
}

/**
 * GET /api/points/me?kind=operator|client
 * Returns balance for the signed-in user (0 if no account row yet).
 */
export const getMyPointsBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const { kind, table } = tableForKind(String(req.query.kind || '').trim().toLowerCase());

    const exists = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS ok`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.ok) {
      res.json({
        success: true,
        data: {
          kind,
          balancePts: 0,
          lifetimeEarnedPts: 0,
          lifetimeSpentPts: 0,
          hasAccount: false,
        },
      });
      return;
    }

    const result = await pool.query<{
      balance_pts: number;
      lifetime_earned_pts: number;
      lifetime_spent_pts: number;
    }>(
      `SELECT balance_pts, lifetime_earned_pts, lifetime_spent_pts
       FROM ${table}
       WHERE user_id = $1::uuid
       LIMIT 1`,
      [userId]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        kind,
        balancePts: row ? Number(row.balance_pts) || 0 : 0,
        lifetimeEarnedPts: row ? Number(row.lifetime_earned_pts) || 0 : 0,
        lifetimeSpentPts: row ? Number(row.lifetime_spent_pts) || 0 : 0,
        hasAccount: Boolean(row),
      },
    });
  } catch (error) {
    next(error);
  }
};
