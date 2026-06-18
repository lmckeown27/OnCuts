import { pool } from '../database/connection';
import { logger } from '../utils/logger';

let auditTableCached: boolean | null = null;
let ensureInFlight: Promise<boolean> | null = null;
let missingTableWarned = false;

async function auditTableExists(): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'audit_logs'
     LIMIT 1`
  );
  return result.rows.length > 0;
}

/**
 * Create audit_logs if missing. Returns true when the table is available.
 * Unlike ALTER on services, CREATE TABLE IF NOT EXISTS usually succeeds for the app DB role.
 */
export async function ensureAuditLogsTable(): Promise<boolean> {
  if (auditTableCached) return true;
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    if (await auditTableExists()) {
      auditTableCached = true;
      return true;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGSERIAL PRIMARY KEY,
          actor_user_id UUID NULL,
          action TEXT NOT NULL,
          object_type TEXT,
          object_id TEXT,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC)`
      );
      auditTableCached = true;
      logger.info('audit_logs table ready');
      return true;
    } catch (error) {
      if (!missingTableWarned) {
        missingTableWarned = true;
        logger.warn('audit_logs table unavailable — audit entries will be skipped until migration 034 is applied', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    }
  })();

  try {
    return await ensureInFlight;
  } finally {
    ensureInFlight = null;
  }
}

export async function warnIfAuditLogsTableMissing(): Promise<void> {
  await ensureAuditLogsTable();
}
