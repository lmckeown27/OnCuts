import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export const DEFAULT_MIN_DURATION_MINUTES = 15;
export const DEFAULT_MAX_DURATION_MINUTES = 240;

let schemaEnsured = false;
let ensureInFlight: Promise<void> | null = null;

async function durationColumnsExist(): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'services'
       AND column_name = 'default_min_duration_minutes'
     LIMIT 1`
  );
  return result.rows.length > 0;
}

/**
 * Ensures services.default_min/max_duration_minutes exist (migration 033).
 * Idempotent — safe on every request until columns are present.
 */
export async function ensureServiceDurationBoundsSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (ensureInFlight) {
    await ensureInFlight;
    return;
  }

  ensureInFlight = (async () => {
    if (await durationColumnsExist()) {
      schemaEnsured = true;
      return;
    }

    logger.info('Adding service duration bound columns to services table...');

    await pool.query(
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS default_min_duration_minutes INT`
    );
    await pool.query(
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS default_max_duration_minutes INT`
    );

    await pool.query(
      `UPDATE services
       SET
         default_min_duration_minutes = COALESCE(default_min_duration_minutes, $1),
         default_max_duration_minutes = COALESCE(default_max_duration_minutes, $2)
       WHERE default_min_duration_minutes IS NULL OR default_max_duration_minutes IS NULL`,
      [DEFAULT_MIN_DURATION_MINUTES, DEFAULT_MAX_DURATION_MINUTES]
    );

    await pool.query(
      `ALTER TABLE services
         ALTER COLUMN default_min_duration_minutes SET DEFAULT $1,
         ALTER COLUMN default_max_duration_minutes SET DEFAULT $2`,
      [DEFAULT_MIN_DURATION_MINUTES, DEFAULT_MAX_DURATION_MINUTES]
    );

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

    schemaEnsured = true;
    logger.info('Service duration bounds schema ready');
  })();

  try {
    await ensureInFlight;
  } finally {
    ensureInFlight = null;
  }
}

/** @deprecated Use ensureServiceDurationBoundsSchema */
export const initServiceDurationBoundsSchema = ensureServiceDurationBoundsSchema;
