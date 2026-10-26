/**
 * Admin read-only Postgres browser (Data → Database).
 * Discovers public base tables; groups known ones into domains.
 * Table names must exist in public schema — no arbitrary SQL.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

type DbDomainId =
  | 'users'
  | 'operators'
  | 'catalog'
  | 'bookings'
  | 'messaging'
  | 'payments'
  | 'places'
  | 'points'
  | 'platform'
  | 'safety'
  | 'other';

interface CatalogTable {
  name: string;
  label: string;
}

interface CatalogDomain {
  id: DbDomainId;
  label: string;
  tables: CatalogTable[];
}

/** Domain order + labels for the UI. */
const DOMAIN_META: { id: DbDomainId; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'operators', label: 'Operators' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'payments', label: 'Payments' },
  { id: 'places', label: 'Places' },
  { id: 'points', label: 'Points' },
  { id: 'platform', label: 'Platform' },
  { id: 'safety', label: 'Safety' },
  { id: 'other', label: 'Other' },
];

/**
 * Known table → domain. Anything else discovered in public lands in Other.
 * Includes lookups like provider_types and the services catalog.
 */
const TABLE_DOMAIN: Record<string, DbDomainId> = {
  // Users / auth
  users: 'users',
  mobile_devices: 'users',
  customer_profiles: 'users',
  verification_requests: 'users',
  referrals: 'users',

  // Operators
  service_providers: 'operators',
  barbers: 'operators',
  barber_applications: 'operators',
  operator_portfolio_items: 'operators',
  operator_portfolio_section_orders: 'operators',
  portfolio_images: 'operators',
  barber_time_blocks: 'operators',
  availability: 'operators',
  barber_locations: 'operators',
  barber_metrics: 'operators',
  barber_scores: 'operators',
  barber_prices: 'operators',
  barber_payouts: 'operators',
  barber_rank_history: 'operators',
  barber_student_blocks: 'operators',

  // Catalog / types
  provider_types: 'catalog',
  services: 'catalog',
  markets: 'catalog',
  pricing_config: 'catalog',
  pricing_config_audit: 'catalog',
  campus_market_metrics: 'catalog',
  price_recompute_log: 'catalog',
  price_anomalies: 'catalog',
  surge_events: 'catalog',

  // Bookings / reviews
  bookings: 'bookings',
  booking_reschedule_requests: 'bookings',
  booking_metadata: 'bookings',
  booking_messages: 'bookings',
  booking_request_notifications: 'bookings',
  customer_reviews: 'bookings',
  review_metadata: 'bookings',
  review_weighting_config: 'bookings',
  review_weight_audit: 'bookings',

  // Messaging / notifications
  conversations: 'messaging',
  messages: 'messaging',
  chat_messages: 'messaging',
  archived_booking_messages: 'messaging',
  notifications: 'messaging',
  notification_logs: 'messaging',
  notification_templates: 'messaging',

  // Payments / ledger
  payment_transactions: 'payments',
  payments: 'payments',
  pending_payouts: 'payments',
  ledger_entries: 'payments',
  withdrawal_requests: 'payments',
  withdrawal_queue: 'payments',
  withdrawal_batches: 'payments',
  balances: 'payments',
  transactions: 'payments',
  escrow_holds: 'payments',
  platform_fees: 'payments',
  stripe_events: 'payments',
  stripe_webhook_events: 'payments',
  moonpay_offramp_sessions: 'payments',
  circle_transactions: 'payments',
  aptos_transactions: 'payments',
  onchain_records: 'payments',
  gas_wallets: 'payments',
  gas_top_up_requests: 'payments',
  gas_wallet_audit_logs: 'payments',
  gas_estimation_config: 'payments',
  reconciliation_reports: 'payments',

  // Places
  campuses: 'places',
  campus_locations: 'places',
  campus_location_aliases: 'places',
  location_enrichment_log: 'places',
  location_merge_log: 'places',

  // Points (referral balances)
  operator_points: 'points',
  client_points: 'points',
  referral_codes: 'points',
  referral_code_history: 'points',
  referral_code_attempts: 'points',
  referral_attributions: 'points',
  referral_code_requests: 'points',
  points_ledger: 'points',
  referral_prompt_state: 'points',

  // Platform
  platform_settings: 'platform',
  audit_logs: 'platform',
  analytics_events: 'platform',
  sync_status: 'platform',
  student_metrics: 'platform',
  student_scores: 'platform',
  student_grade_levels: 'platform',
  student_restrictions: 'platform',
  student_grading_config: 'platform',
  student_grading_audit: 'platform',

  // Safety / UGC
  user_blocks: 'safety',
  ugc_content_reports: 'safety',
};

/** PostGIS / system relation noise — never show or query. */
const EXCLUDED_TABLES = new Set([
  'spatial_ref_sys',
  'geography_columns',
  'geometry_columns',
  'raster_columns',
  'raster_overviews',
]);

const TABLE_NAME_RE = /^[a-z_][a-z0-9_]*$/;

function requireAdmin(req: AuthRequest): void {
  if (req.user!.role?.toLowerCase() !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
}

async function listPublicBaseTables(): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return result.rows
    .map((r) => r.table_name)
    .filter((name) => TABLE_NAME_RE.test(name) && !EXCLUDED_TABLES.has(name));
}

async function isPublicBaseTable(tableName: string): Promise<boolean> {
  if (!TABLE_NAME_RE.test(tableName) || EXCLUDED_TABLES.has(tableName)) {
    return false;
  }
  const result = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = $1
     ) AS ok`,
    [tableName]
  );
  return Boolean(result.rows[0]?.ok);
}

function quoteIdent(name: string): string {
  if (!TABLE_NAME_RE.test(name) || EXCLUDED_TABLES.has(name)) {
    throw new ApiError(400, 'Table not allowed');
  }
  return `"${name.replace(/"/g, '""')}"`;
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

    const tableNames = await listPublicBaseTables();
    const buckets = new Map<DbDomainId, CatalogTable[]>();
    for (const meta of DOMAIN_META) {
      buckets.set(meta.id, []);
    }

    for (const name of tableNames) {
      const domainId = TABLE_DOMAIN[name] ?? 'other';
      buckets.get(domainId)!.push({ name, label: name });
    }

    const domains: CatalogDomain[] = DOMAIN_META.filter(
      (meta) => (buckets.get(meta.id)?.length ?? 0) > 0
    ).map((meta) => ({
      id: meta.id,
      label: meta.label,
      tables: buckets.get(meta.id)!,
    }));

    res.json({ success: true, data: { domains } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/db/tables/:table
 * Query: limit (default 50, max 200), offset
 * Optional view=unique_users for mobile_devices (one row per user_id).
 */
export const getDbTable = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const table = String(req.params.table || '').trim();
    if (!(await isPublicBaseTable(table))) {
      throw new ApiError(404, 'Table not found');
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const viewRaw = String(req.query.view || '').trim().toLowerCase();
    const uniqueUsersView = table === 'mobile_devices' && viewRaw === 'unique_users';
    const quoted = quoteIdent(table);

    if (uniqueUsersView) {
      const columns = [
        { name: 'user_id', dataType: 'uuid' },
        { name: 'device_count', dataType: 'integer' },
        { name: 'active_device_count', dataType: 'integer' },
        { name: 'has_active', dataType: 'boolean' },
        { name: 'platforms', dataType: 'text' },
        { name: 'bundle_ids', dataType: 'text' },
        { name: 'apns_environments', dataType: 'text' },
        { name: 'first_registered_at', dataType: 'timestamp without time zone' },
        { name: 'last_updated_at', dataType: 'timestamp without time zone' },
      ];

      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id)::text AS count FROM mobile_devices`
      );
      const total = parseInt(countResult.rows[0]?.count || '0', 10) || 0;

      const rowsResult = await pool.query(
        `SELECT
           user_id,
           COUNT(*)::int AS device_count,
           COUNT(*) FILTER (WHERE is_active IS TRUE)::int AS active_device_count,
           BOOL_OR(is_active IS TRUE) AS has_active,
           string_agg(DISTINCT platform, ', ') AS platforms,
           string_agg(DISTINCT bundle_id, ', ')
             FILTER (WHERE bundle_id IS NOT NULL AND bundle_id <> '') AS bundle_ids,
           string_agg(DISTINCT COALESCE(apns_environment, 'production'), ', ') AS apns_environments,
           MIN(created_at) AS first_registered_at,
           MAX(updated_at) AS last_updated_at
         FROM mobile_devices
         GROUP BY user_id
         ORDER BY MAX(updated_at) DESC NULLS LAST, user_id
         LIMIT $1 OFFSET $2`,
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
          view: 'unique_users',
          columns,
          rows,
          total,
          limit,
          offset,
        },
      });
      return;
    }

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
        view: 'rows',
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
