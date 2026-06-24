import { pool } from '../database/connection';

let persistenceRelationCached: string | null = null;

/**
 * Primary provider persistence relation.
 * After migration 037 this is `service_providers`; before that it is `barbers`.
 */
export async function serviceProviderPersistenceTable(): Promise<string> {
  if (persistenceRelationCached) return persistenceRelationCached;

  const result = await pool.query(
    `SELECT CASE
       WHEN to_regclass('public.service_providers') IS NOT NULL THEN 'service_providers'
       ELSE 'barbers'
     END AS relation`
  );
  persistenceRelationCached = result.rows[0]?.relation === 'service_providers'
    ? 'service_providers'
    : 'barbers';
  return persistenceRelationCached;
}

/** Relation safe for INSERT/UPDATE (barbers view after migration 037, else table). */
export async function serviceProviderWriteRelation(): Promise<string> {
  const viewCheck = await pool.query(
    `SELECT 1
     FROM pg_views
     WHERE schemaname = 'public' AND viewname = 'barbers'
     LIMIT 1`
  );
  if (viewCheck.rows.length > 0) return 'barbers';
  return serviceProviderPersistenceTable();
}

/** Whether migration 037 has renamed the base table. */
export async function serviceProvidersTableRenamed(): Promise<boolean> {
  return (await serviceProviderPersistenceTable()) === 'service_providers';
}

export function resetServiceProviderPersistenceCache(): void {
  persistenceRelationCached = null;
}

let migration037Warned = false;

/** Log once when migration 037 has not been applied. */
export async function warnIfServiceProvidersMigrationPending(): Promise<void> {
  if (migration037Warned) return;
  if (await serviceProvidersTableRenamed()) return;
  migration037Warned = true;
  const { logger } = await import('../utils/logger');
  logger.warn(
    'barbers table not renamed to service_providers — run migration 037_rename_barbers_to_service_providers.sql'
  );
}
