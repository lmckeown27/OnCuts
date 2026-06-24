import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { serviceProviderWriteRelation } from './service-provider-persistence.service';

let providerTypeColumnCached: boolean | null = null;
let missingColumnWarned = false;

/** Whether migration 036 provider_type exists on the persistence table/view. */
export async function barberProviderTypeColumnExists(): Promise<boolean> {
  if (providerTypeColumnCached !== null) return providerTypeColumnCached;

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('service_providers', 'barbers')
       AND column_name = 'provider_type'
     LIMIT 1`
  );
  providerTypeColumnCached = result.rows.length > 0;
  return providerTypeColumnCached;
}

export async function warnIfBarberProviderTypeMissing(): Promise<void> {
  const exists = await barberProviderTypeColumnExists();
  if (!exists && !missingColumnWarned) {
    missingColumnWarned = true;
    logger.warn(
      'service_providers.provider_type missing — run migration 036_barber_provider_type.sql'
    );
  }
}

/** SELECT fragment for provider kind discriminator. */
export async function barberProviderTypeSelectSql(): Promise<string> {
  const exists = await barberProviderTypeColumnExists();
  return exists
    ? ',\n        b.provider_type'
    : ",\n        'barber'::text as provider_type";
}

/** SQL expression for filtering by provider kind. */
export async function barberProviderTypeExpr(): Promise<string> {
  const exists = await barberProviderTypeColumnExists();
  return exists ? 'b.provider_type' : "'barber'";
}

/** INSERT fragments for provider_type (empty when migration 036 is not applied). */
export async function barberProviderTypeInsertFragments(
  valuePlaceholder?: string
): Promise<{ columns: string; values: string; onConflict: string }> {
  const exists = await barberProviderTypeColumnExists();
  if (!exists) {
    return { columns: '', values: '', onConflict: '' };
  }

  const writeRelation = await serviceProviderWriteRelation();

  return {
    columns: ', provider_type',
    values: valuePlaceholder ? `, ${valuePlaceholder}` : ", 'barber'",
    onConflict: `, provider_type = COALESCE(${writeRelation}.provider_type, EXCLUDED.provider_type)`,
  };
}
