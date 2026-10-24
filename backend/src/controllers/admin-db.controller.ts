/**
 * Admin read-only curated Postgres browser (Data → Database).
 * Table names must match the allowlist — no arbitrary SQL.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

type DbDomainId =
  | 'users'
  | 'operators'
  | 'bookings'
  | 'messaging'
  | 'payments'
  | 'places'
  | 'platform';

interface CatalogTable {
  name: string;
  label: string;
}

interface CatalogDomain {
  id: DbDomainId;
  label: string;
  tables: CatalogTable[];
}

const CATALOG_SPEC: {
  id: DbDomainId;
  label: string;
  tables: { name: string; label: string }[];
}[] = [
  {
    id: 'users',
    label: 'Users',
    tables: [
      { name: 'users', label: 'users' },
      { name: 'mobile_devices', label: 'mobile_devices' },
      { name: 'webauthn_credentials', label: 'webauthn_credentials' },
    ],
  },
  {
    id: 'operators',
    label: 'Operators',
    tables: [
      { name: 'service_providers', label: 'service_providers' },
      { name: 'barber_applications', label: 'barber_applications' },
      { name: 'operator_portfolio_items', label: 'operator_portfolio_items' },
    ],
  },
  {
    id: 'bookings',
    label: 'Bookings',
    tables: [
      { name: 'bookings', label: 'bookings' },
      { name: 'booking_reschedule_requests', label: 'booking_reschedule_requests' },
    ],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    tables: [
      { name: 'conversations', label: 'conversations' },
      { name: 'messages', label: 'messages' },
      { name: 'chat_messages', label: 'chat_messages' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    tables: [
      { name: 'payment_transactions', label: 'payment_transactions' },
      { name: 'pending_payouts', label: 'pending_payouts' },
      { name: 'ledger_entries', label: 'ledger_entries' },
    ],
  },
  {
    id: 'places',
    label: 'Places',
    tables: [
      { name: 'campuses', label: 'campuses' },
      { name: 'campus_locations', label: 'campus_locations' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    tables: [
      { name: 'platform_settings', label: 'platform_settings' },
      { name: 'audit_logs', label: 'audit_logs' },
      { name: 'notification_templates', label: 'notification_templates' },
      { name: 'services', label: 'services' },
    ],
  },
];

/** Flat allowlist: only these names may be queried. */
const ALLOWED_TABLES = new Set(CATALOG_SPEC.flatMap((d) => d.tables.map((t) => t.name)));

function requireAdmin(req: AuthRequest): void {
  if (req.user!.role?.toLowerCase() !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
}

function quoteIdent(name: string): string {
  if (!ALLOWED_TABLES.has(name)) {
    throw new ApiError(400, 'Table not allowed');
  }
  return `"${name.replace(/"/g, '""')}"`;
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: string | null }>(
    `SELECT to_regclass($1) AS exists`,
    [`public.${tableName}`]
  );
  return result.rows[0]?.exists != null;
}

function serializeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * GET /api/admin/db/catalog
 */
export const getDbCatalog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const domains: CatalogDomain[] = [];
    for (const domain of CATALOG_SPEC) {
      const tables: CatalogTable[] = [];
      for (const table of domain.tables) {
        if (await tableExists(table.name)) {
          tables.push({ name: table.name, label: table.label });
        }
      }
      if (tables.length > 0) {
        domains.push({ id: domain.id, label: domain.label, tables });
      }
    }

    res.json({ success: true, data: { domains } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/db/tables/:table
 * Query: limit (default 50, max 200), offset
 */
export const getDbTable = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const table = String(req.params.table || '').trim();
    if (!ALLOWED_TABLES.has(table)) {
      throw new ApiError(404, 'Table not found');
    }
    if (!(await tableExists(table))) {
      throw new ApiError(404, 'Table not found');
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const quoted = quoteIdent(table);

    const columnsResult = await pool.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );

    const columns = columnsResult.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
    }));

    const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quoted}`);
    const total = parseInt(countResult.rows[0]?.count || '0', 10) || 0;

    const rowsResult = await pool.query(
      `SELECT * FROM ${quoted} ORDER BY 1 DESC NULLS LAST LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const rows = rowsResult.rows.map((row) => {
      const out: Record<string, string | number | boolean | null> = {};
      for (const col of columns) {
        out[col.name] = serializeCell(row[col.name]);
      }
      return out;
    });

    res.json({
      success: true,
      data: {
        table,
        columns,
        rows,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
};
