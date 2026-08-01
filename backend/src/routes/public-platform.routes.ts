/**
 * Public platform frontend config (no auth).
 */

import express, { Request, Response, NextFunction } from 'express';
import { getFrontendConfigPayload } from '../utils/platform-frontend-settings';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/platform/frontend-config
 */
router.get('/frontend-config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getFrontendConfigPayload();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('frontend-config failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

export default router;
