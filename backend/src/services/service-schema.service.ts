import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export const DEFAULT_MIN_DURATION_MINUTES = 15;
export const DEFAULT_MAX_DURATION_MINUTES = 240;

let durationColumnsCached: boolean | null = null;
let missingColumnsWarned = false;

/**
 * Whether migration 033 columns exist on public.services.
 * Cached for the process lifetime — safe to call on every services request.
 */
export async function serviceDurationColumnsExist(): Promise<boolean> {
  if (durationColumnsCached !== null) return durationColumnsCached;

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'services'
       AND column_name = 'default_min_duration_minutes'
     LIMIT 1`
  );
  durationColumnsCached = result.rows.length > 0;
  return durationColumnsCached;
}

/** Log once at startup when columns are missing (requires table owner to run migration 033). */
export async function warnIfServiceDurationColumnsMissing(): Promise<void> {
  const exists = await serviceDurationColumnsExist();
  if (!exists && !missingColumnsWarned) {
    missingColumnsWarned = true;
    logger.warn(
      'services.default_min/max_duration_minutes missing — duration bounds use defaults until migration 033 is applied as the table owner (postgres superuser)'
    );
  }
}

export function serviceSelectSql(hasDurationColumns: boolean): string {
  const base = `id, slug, name, description,
             default_base_price_cents,
             default_min_price_cents,
             default_max_price_cents`;
  if (hasDurationColumns) {
    return `${base},
             default_min_duration_minutes,
             default_max_duration_minutes,
             is_active, created_at, updated_at`;
  }
  return `${base},
             is_active, created_at, updated_at`;
}

/** @deprecated Use warnIfServiceDurationColumnsMissing */
export const initServiceDurationBoundsSchema = warnIfServiceDurationColumnsMissing;
