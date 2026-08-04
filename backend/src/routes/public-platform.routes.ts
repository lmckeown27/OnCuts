/**
 * Public platform frontend config (no auth).
 */

import express, { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { getFrontendConfigPayload } from '../utils/platform-frontend-settings';
import {
  DEFAULT_MAX_DURATION_MINUTES,
  DEFAULT_MIN_DURATION_MINUTES,
  inferServiceProviderType,
  serviceDurationColumnsExist,
  serviceProviderTypeColumnExist,
  serviceSelectSql,
} from '../services/service-schema.service';
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

/**
 * GET /api/v1/platform/services
 * Active service catalog for applicants and other unauthenticated clients.
 * Optional query: providerType=barber|beauty
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasDurationColumns = await serviceDurationColumnsExist();
    const hasProviderTypeColumn = await serviceProviderTypeColumnExist();

    const providerTypeRaw = typeof req.query.providerType === 'string'
      ? req.query.providerType.trim().toLowerCase()
      : '';
    const providerTypeFilter =
      providerTypeRaw === 'beauty' || providerTypeRaw === 'barber' ? providerTypeRaw : null;

    const result = await pool.query(
      `SELECT ${serviceSelectSql(hasDurationColumns, hasProviderTypeColumn)}
       FROM services
       WHERE is_active = true
       ORDER BY name ASC`
    );

    let data = result.rows.map((row: Record<string, unknown>) => {
      const providerType = inferServiceProviderType(row.slug, row.name, row.provider_type);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        basePriceCents: row.default_base_price_cents,
        minPriceCents: row.default_min_price_cents,
        maxPriceCents: row.default_max_price_cents,
        minDurationMinutes: row.default_min_duration_minutes ?? DEFAULT_MIN_DURATION_MINUTES,
        maxDurationMinutes: row.default_max_duration_minutes ?? DEFAULT_MAX_DURATION_MINUTES,
        providerType,
        isActive: row.is_active,
      };
    });

    if (providerTypeFilter) {
      data = data.filter((s) => s.providerType === providerTypeFilter);
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error('platform services catalog failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

export default router;
