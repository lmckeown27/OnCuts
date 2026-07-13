import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export const DEFAULT_MIN_DURATION_MINUTES = 15;
export const DEFAULT_MAX_DURATION_MINUTES = 240;

let durationColumnsCached: boolean | null = null;
let providerTypeColumnCached: boolean | null = null;
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

/** Whether migration 047 `services.provider_type` exists.
 * Only caches a positive result so a post-start migration is picked up without restart.
 */
export async function serviceProviderTypeColumnExist(): Promise<boolean> {
  if (providerTypeColumnCached === true) return true;

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'services'
       AND column_name = 'provider_type'
     LIMIT 1`
  );
  const exists = result.rows.length > 0;
  if (exists) providerTypeColumnCached = true;
  return exists;
}

/** Known beauty catalog slugs/names used to backfill tags if DB was left at default barber. */
export const KNOWN_BEAUTY_SERVICE_KEYS = new Set([
  'braids',
  'makeup',
  'nails',
  'lashes',
  'tanning',
]);

export function inferServiceProviderType(
  slug: unknown,
  name: unknown,
  stored?: unknown
): 'barber' | 'beauty' {
  const storedNorm = stored != null ? String(stored).trim().toLowerCase() : '';
  if (storedNorm === 'beauty') return 'beauty';
  if (storedNorm === 'barber') {
    // Fall through to name/slug inference for mis-tagged defaults.
  }
  const key = String(slug ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const nameKey = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (KNOWN_BEAUTY_SERVICE_KEYS.has(key) || KNOWN_BEAUTY_SERVICE_KEYS.has(nameKey)) {
    return 'beauty';
  }
  return storedNorm === 'barber' ? 'barber' : 'barber';
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

export function serviceSelectSql(
  hasDurationColumns: boolean,
  hasProviderTypeColumn: boolean = false
): string {
  const base = `id, slug, name, description,
             default_base_price_cents,
             default_min_price_cents,
             default_max_price_cents`;
  const providerType = hasProviderTypeColumn ? `,\n             provider_type` : '';
  if (hasDurationColumns) {
    return `${base},
             default_min_duration_minutes,
             default_max_duration_minutes${providerType},
             is_active, created_at, updated_at`;
  }
  return `${base}${providerType},
             is_active, created_at, updated_at`;
}

/** @deprecated Use warnIfServiceDurationColumnsMissing */
export const initServiceDurationBoundsSchema = warnIfServiceDurationColumnsMissing;
