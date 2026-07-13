import { pool } from '../database/connection';
import { logger } from '../utils/logger';

let labelColumnCached: boolean | null = null;
let sourceColumnCached: boolean | null = null;
let missingColumnWarned = false;
let missingSourceWarned = false;

async function columnExists(columnName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'barbers'
       AND column_name = $1
     LIMIT 1`,
    [columnName]
  );
  return result.rows.length > 0;
}

/** Whether migration 035 `barbers.service_location_label` exists. */
export async function barberServiceLocationLabelColumnExists(): Promise<boolean> {
  if (labelColumnCached !== null) return labelColumnCached;
  labelColumnCached = await columnExists('service_location_label');
  return labelColumnCached;
}

/** Whether migration 042 `barbers.service_location_source` exists. */
export async function barberServiceLocationSourceColumnExists(): Promise<boolean> {
  if (sourceColumnCached !== null) return sourceColumnCached;
  sourceColumnCached = await columnExists('service_location_source');
  return sourceColumnCached;
}

export async function warnIfBarberServiceLocationLabelMissing(): Promise<void> {
  const exists = await barberServiceLocationLabelColumnExists();
  if (!exists && !missingColumnWarned) {
    missingColumnWarned = true;
    logger.warn(
      'barbers.service_location_label missing — run migration 035_barber_service_location_label.sql'
    );
  }
}

export async function warnIfBarberServiceLocationSourceMissing(): Promise<void> {
  const exists = await barberServiceLocationSourceColumnExists();
  if (!exists && !missingSourceWarned) {
    missingSourceWarned = true;
    logger.warn(
      'barbers.service_location_source missing — run migration 042_barber_service_location_source.sql'
    );
  }
}

/** SELECT fragment: `, b.service_location_label` or empty. */
export async function barberServiceLocationLabelSelectSql(): Promise<string> {
  const exists = await barberServiceLocationLabelColumnExists();
  return exists ? ',\n        b.service_location_label' : '';
}

/** SELECT fragment for source + updated_at, or empty. */
export async function barberServiceLocationSourceSelectSql(): Promise<string> {
  const exists = await barberServiceLocationSourceColumnExists();
  return exists
    ? ',\n        b.service_location_source,\n        b.service_location_updated_at'
    : '';
}

export type ServiceLocationSource = 'device' | 'manual' | 'campus_default';

export function normalizeServiceLocationSource(
  raw: unknown
): ServiceLocationSource | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'device' || value === 'manual' || value === 'campus_default') {
    return value;
  }
  return null;
}
