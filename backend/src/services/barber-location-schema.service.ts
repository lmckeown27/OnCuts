import { pool } from '../database/connection';
import { logger } from '../utils/logger';

let labelColumnCached: boolean | null = null;
let missingColumnWarned = false;

/** Whether migration 035 `barbers.service_location_label` exists. */
export async function barberServiceLocationLabelColumnExists(): Promise<boolean> {
  if (labelColumnCached !== null) return labelColumnCached;

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'barbers'
       AND column_name = 'service_location_label'
     LIMIT 1`
  );
  labelColumnCached = result.rows.length > 0;
  return labelColumnCached;
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

/** SELECT fragment: `, b.service_location_label` or empty. */
export async function barberServiceLocationLabelSelectSql(): Promise<string> {
  const exists = await barberServiceLocationLabelColumnExists();
  return exists ? ',\n        b.service_location_label' : '';
}
