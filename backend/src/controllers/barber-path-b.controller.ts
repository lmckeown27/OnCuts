import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const SUI_ADDR = /^0x[0-9a-fA-F]{64}$/;

/**
 * Path B: barber must have a Sui (or legacy hex) payout address for Checkout metadata.
 * GET /api/barber/path-b/payout-status
 */
export async function getPathBPayoutStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Not authenticated');
    }

    const result = await pool.query(
      `SELECT
         NULLIF(TRIM(sui_address), '') AS sui,
         NULLIF(TRIM("walletAddress"), '') AS legacy
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const row = result.rows[0];
    const payoutAddress = (row.sui as string | null) || (row.legacy as string | null) || null;
    const valid = Boolean(payoutAddress && SUI_ADDR.test(payoutAddress));

    res.json({
      success: true,
      data: {
        payout_ready: valid,
        /** Canonical payout id when valid; otherwise null */
        sui_address: valid ? payoutAddress : null,
        /** Raw DB value if present but not valid 0x+64 hex (user should replace) */
        invalid_stored_address: Boolean(payoutAddress && !valid),
        stored_address_preview: !valid && payoutAddress ? `${payoutAddress.slice(0, 10)}…` : null,
      },
    });
  } catch (e) {
    logger.error('getPathBPayoutStatus failed', e);
    next(e);
  }
}
