import { pool } from '../database/connection';
import { logger } from '../utils/logger';

const DEFAULT_MIN_DURATION_MINUTES = 15;
const DEFAULT_MAX_DURATION_MINUTES = 240;

/**
 * Ensures services.default_min/max_duration_minutes exist (migration 033).
 * Safe to run on every boot — uses IF NOT EXISTS.
 */
export async function initServiceDurationBoundsSchema(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE services
        ADD COLUMN IF NOT EXISTS default_min_duration_minutes INT,
        ADD COLUMN IF NOT EXISTS default_max_duration_minutes INT
    `);

    await pool.query(
      `UPDATE services
       SET
         default_min_duration_minutes = COALESCE(default_min_duration_minutes, $1),
         default_max_duration_minutes = COALESCE(default_max_duration_minutes, $2)
       WHERE default_min_duration_minutes IS NULL OR default_max_duration_minutes IS NULL`,
      [DEFAULT_MIN_DURATION_MINUTES, DEFAULT_MAX_DURATION_MINUTES]
    );

    await pool.query(`
      ALTER TABLE services
        ALTER COLUMN default_min_duration_minutes SET DEFAULT ${DEFAULT_MIN_DURATION_MINUTES},
        ALTER COLUMN default_max_duration_minutes SET DEFAULT ${DEFAULT_MAX_DURATION_MINUTES}
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'service_duration_bounds_valid'
        ) THEN
          ALTER TABLE services
            ADD CONSTRAINT service_duration_bounds_valid CHECK (
              default_min_duration_minutes <= default_max_duration_minutes
            );
        END IF;
      END $$
    `);

    logger.info('Service duration bounds schema ready');
  } catch (error) {
    logger.warn('Service duration bounds schema init failed (services API may 500 until migration 033 is applied)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
