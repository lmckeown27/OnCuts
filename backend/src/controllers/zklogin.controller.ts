import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { deriveZkLoginSalt } from '../services/zklogin-salt.service';
import { logger } from '../utils/logger';

/**
 * Return deterministic salt for zkLogin address derivation (JWT iss + sub).
 * Rate-limit at the edge in production.
 */
export async function postZkLoginSalt(req: Request, res: Response, next: NextFunction) {
  try {
    const { iss, sub } = req.body as { iss?: string; sub?: string };
    if (!iss || !sub) {
      throw new ApiError(400, 'iss and sub required');
    }
    const salt = deriveZkLoginSalt(iss, sub);
    res.json({ success: true, salt });
  } catch (e) {
    next(e);
  }
}

/** Persist zkLogin Sui address for the authenticated user (barber or consumer). */
export async function putZkLoginAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { suiAddress, zkLoginSalt } = req.body as {
      suiAddress?: string;
      zkLoginSalt?: string;
    };
    if (!suiAddress || !/^0x[0-9a-fA-F]{64}$/.test(suiAddress)) {
      throw new ApiError(400, 'Valid suiAddress (0x + 64 hex) required');
    }

    await pool.query(
      `UPDATE users SET sui_address = $1, zk_login_salt = COALESCE($2, zk_login_salt), "updatedAt" = NOW() WHERE id = $3`,
      [suiAddress, zkLoginSalt || null, userId]
    );

    logger.info('User linked zkLogin Sui address', { userId });

    res.json({ success: true, suiAddress });
  } catch (e) {
    next(e);
  }
}
