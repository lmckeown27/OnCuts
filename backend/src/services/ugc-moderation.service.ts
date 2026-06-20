/**
 * UGC moderation: basic content filter, user blocks, reports, developer alerts.
 * Supports App Store Guideline 1.2 (user-generated content).
 *
 * **Peer block (`user_blocks`)** — Initiated by one account toward another (e.g. consumer blocks a
 * service provider). A single row means those two user IDs must not interact with each other
 * (either direction). Only that pair is affected. See `assertNoMessagingBlockBetween`.
 *
 * **Platform ban (`users.isBanned`)** — Trust-and-safety / admin action on a user. That account is
 * frozen for the whole product (sign-in, discovery, etc.), not scoped to one counterparty.
 */

import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendEmail } from './email.service';

const MODERATION_ALERT_EMAIL = process.env.MODERATION_ALERT_EMAIL?.trim();
const MAX_MESSAGE_CHARS = 8000;

/** null = never successfully seen; true = tables exist; false = last probe failed. */
let ugcModerationSchemaCache: boolean | null = null;
let ugcSchemaLastProbeMs = 0;
const UGC_SCHEMA_REPROBE_MS = 60_000;

/**
 * True when migration 028 tables exist. When false, messaging still works but
 * block/report SQL is skipped so production does not 500 before migrate runs.
 * Re-checks every minute when missing so a migrate + no PM2 restart still enables UGC.
 */
export async function isUgcModerationSchemaReady(): Promise<boolean> {
  if (ugcModerationSchemaCache === true) {
    return true;
  }
  const now = Date.now();
  if (
    ugcModerationSchemaCache === false &&
    now - ugcSchemaLastProbeMs < UGC_SCHEMA_REPROBE_MS
  ) {
    return false;
  }
  try {
    const r = await pool.query(
      `SELECT to_regclass('public.user_blocks') AS ub, to_regclass('public.ugc_content_reports') AS rep`
    );
    ugcSchemaLastProbeMs = now;
    const ok = r.rows[0].ub != null && r.rows[0].rep != null;
    ugcModerationSchemaCache = ok;
    if (!ok) {
      logger.warn(
        'UGC moderation tables missing — conversations still work; apply backend/src/database/migrations/028_ugc_safety_blocks_reports.sql (e.g. npm run migrate:sql -- 028_ugc_safety_blocks_reports.sql from backend/)'
      );
    }
    return ok;
  } catch (e) {
    logger.error('Failed to probe UGC moderation schema:', e);
    ugcSchemaLastProbeMs = now;
    ugcModerationSchemaCache = false;
    return false;
  }
}

/** Conservative substring filter; extend list as needed. */
const DISALLOWED_SUBSTRINGS = [
  'child porn',
  'cp link',
  'kill yourself',
  'kys ',
  ' kys',
  'rape you',
  'terrorist attack',
];

function normalizeForFilter(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_\-]+/g, ' ')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

export function validateOutgoingMessageText(content: string): void {
  if (content === undefined || content === null) {
    throw new ApiError(400, 'Message content is required');
  }
  const trimmed = String(content).trim();
  if (!trimmed) {
    throw new ApiError(400, 'Message content is required');
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    throw new ApiError(400, `Message must be at most ${MAX_MESSAGE_CHARS} characters`);
  }
  const norm = normalizeForFilter(trimmed);
  for (const phrase of DISALLOWED_SUBSTRINGS) {
    if (norm.includes(phrase)) {
      throw new ApiError(400, 'This message cannot be sent because it violates community guidelines.');
    }
  }
}

const DEFAULT_IMAGE_MESSAGE_PREVIEW = '📷 Photo';

/** Normalize text vs image payloads before persistence (image may omit caption). */
export function validateAndNormalizeOutgoingMessage(
  messageType: string,
  content: string | null | undefined,
  mediaUrl: string | null | undefined
): { normalizedType: string; contentForStorage: string; mediaUrl: string | null } {
  const normalizedType = messageType === 'image' ? 'image' : 'text';

  if (normalizedType === 'image') {
    const url = mediaUrl != null ? String(mediaUrl).trim() : '';
    if (!url) {
      throw new ApiError(400, 'mediaUrl is required for image messages');
    }
    const trimmed = String(content ?? '').trim();
    const contentForStorage = trimmed || DEFAULT_IMAGE_MESSAGE_PREVIEW;
    validateOutgoingMessageText(contentForStorage);
    return { normalizedType, contentForStorage, mediaUrl: url };
  }

  validateOutgoingMessageText(String(content ?? ''));
  return {
    normalizedType,
    contentForStorage: String(content ?? '').trim(),
    mediaUrl: null,
  };
}

async function assertNoPeerBlockBetween(
  userIdA: string,
  userIdB: string,
  denialMessage: string
): Promise<void> {
  if (!(await isUgcModerationSchemaReady())) {
    return;
  }
  const r = await pool.query(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
        OR (blocker_user_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userIdA, userIdB]
  );
  if (r.rows.length > 0) {
    throw new ApiError(403, denialMessage);
  }
}

/** True if either user has blocked the other (symmetric peer block, not a global platform ban). */
export async function assertNoMessagingBlockBetween(userIdA: string, userIdB: string): Promise<void> {
  await assertNoPeerBlockBetween(userIdA, userIdB, 'Messaging is not available with this user.');
}

/** Same peer-block rule for bookings (consumer ↔ barber user IDs). */
export async function assertNoBookingBlockBetween(
  consumerUserId: string,
  barberUserId: string
): Promise<void> {
  await assertNoPeerBlockBetween(
    consumerUserId,
    barberUserId,
    'This booking is not available because of a block between these accounts.'
  );
}

export async function createUserBlock(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (!(await isUgcModerationSchemaReady())) {
    throw new ApiError(
      503,
      'User blocking is not available until database migration 028_ugc_safety_blocks_reports.sql is applied.',
      'UGC_SCHEMA_MISSING'
    );
  }
  if (blockerUserId === blockedUserId) {
    throw new ApiError(400, 'Cannot block yourself');
  }
  const exists = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [blockedUserId]);
  if (exists.rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }
  await pool.query(
    `INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING`,
    [blockerUserId, blockedUserId]
  );
}

export async function removeUserBlock(blockerUserId: string, blockedUserId: string): Promise<boolean> {
  if (!(await isUgcModerationSchemaReady())) {
    return false;
  }
  const r = await pool.query(
    `DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2 RETURNING blocked_user_id`,
    [blockerUserId, blockedUserId]
  );
  return (r.rowCount ?? 0) > 0;
}

export type BlockedServiceProviderRow = {
  blockedUserId: string;
  blockedAt: string;
  barberRecordId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  campusId: string | null;
  barberIsActive: boolean;
};

/** Cache pg_attribute column names per table (schema drift: Prisma camelCase vs legacy snake_case). */
const pgTableColumnsCache = new Map<string, { cols: Set<string>; at: number }>();
const PG_TABLE_COL_CACHE_MS = 120_000;

function quotePgIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function getPgTableColumns(tableName: string): Promise<Set<string>> {
  const hit = pgTableColumnsCache.get(tableName);
  if (hit && Date.now() - hit.at < PG_TABLE_COL_CACHE_MS) {
    return hit.cols;
  }
  const r = await pool.query<{ col: string }>(
    `SELECT a.attname::text AS col
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public' AND c.relname = $1
       AND a.attnum > 0 AND NOT a.attisdropped`,
    [tableName]
  );
  const cols = new Set(r.rows.map((x) => x.col));
  pgTableColumnsCache.set(tableName, { cols, at: Date.now() });
  return cols;
}

function pickFirstExistingColumn(cols: Set<string>, candidates: readonly string[]): string | null {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

function filterExistingColumns(cols: Set<string>, candidates: readonly string[]): string[] {
  return candidates.filter((c) => cols.has(c));
}

/** COALESCE(NULLIF(TRIM(col), ''), …) across columns — first non-empty wins. */
function coalesceFirstNonEmptyTrim(alias: string, columnNames: string[]): string {
  if (columnNames.length === 0) return 'NULL::text';
  if (columnNames.length === 1) {
    const c = columnNames[0];
    return `NULLIF(TRIM(${alias}.${quotePgIdent(c)}::text), '')`;
  }
  const parts = columnNames.map(
    (c) => `NULLIF(TRIM(${alias}.${quotePgIdent(c)}::text), '')`
  );
  return `COALESCE(${parts.join(', ')})`;
}

function coalesceColumnValues(alias: string, columnNames: string[]): string {
  if (columnNames.length === 0) return 'NULL::text';
  if (columnNames.length === 1) {
    const c = columnNames[0];
    return `${alias}.${quotePgIdent(c)}`;
  }
  return `COALESCE(${columnNames.map((c) => `${alias}.${quotePgIdent(c)}`).join(', ')})`;
}

async function pgRegclassExists(regclass: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1::text) IS NOT NULL AS ok`, [regclass]);
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Users the blocker has peer-blocked who have a barber profile (service providers for booking/messaging).
 * One row per blocked user (prefers an active barber row when duplicates exist).
 *
 * Resolves display name and avatar across Prisma-style (`displayName`, `avatarUrl`) and legacy
 * (`display_name`, `avatar_url`, etc.) columns so mobile/web lists are not blank. Falls back to
 * cached `conversations.barber_name` / `consumer_name` when user profile fields are still empty.
 */
export async function listBlockedServiceProviders(blockerUserId: string): Promise<BlockedServiceProviderRow[]> {
  if (!(await isUgcModerationSchemaReady())) {
    return [];
  }

  const uCols = await getPgTableColumns('users');
  const bCols = await getPgTableColumns('barbers');

  const barberUserCol = pickFirstExistingColumn(bCols, ['userId', 'user_id']);
  const campusCol = pickFirstExistingColumn(bCols, ['campusId', 'campus_id']);
  const activeCol = pickFirstExistingColumn(bCols, ['isActive', 'is_active']);
  const createdCol = pickFirstExistingColumn(bCols, ['createdAt', 'created_at', 'updatedAt', 'updated_at']);

  if (!barberUserCol || !campusCol || !activeCol) {
    logger.warn(
      'listBlockedServiceProviders: barbers table missing expected columns (user link / campus / active)'
    );
    return [];
  }

  const displayNameCols = filterExistingColumns(uCols, ['displayName', 'display_name']);
  const firstNameCols = filterExistingColumns(uCols, ['first_name', 'firstName']);
  const lastNameCols = filterExistingColumns(uCols, ['last_name', 'lastName']);
  const instagramCols = filterExistingColumns(uCols, ['instagram_handle', 'instagramHandle']);
  const avatarCols = filterExistingColumns(uCols, ['avatarUrl', 'avatar_url']);

  const displayFromUserCols =
    displayNameCols.length > 0 ? coalesceFirstNonEmptyTrim('u', displayNameCols) : 'NULL::text';

  let displayFromFullName = 'NULL::text';
  if (firstNameCols.length > 0 || lastNameCols.length > 0) {
    const firstSql = firstNameCols.length > 0 ? coalesceColumnValues('u', firstNameCols) : `''::text`;
    const lastSql = lastNameCols.length > 0 ? coalesceColumnValues('u', lastNameCols) : `''::text`;
    displayFromFullName = `NULLIF(TRIM(CONCAT_WS(' ', ${firstSql}::text, ${lastSql}::text)), '')`;
  }

  const displayFromInstagram =
    instagramCols.length > 0 ? coalesceFirstNonEmptyTrim('u', instagramCols) : 'NULL::text';

  const hasConversations = await pgRegclassExists('public.conversations');
  const convWhere = hasConversations
    ? `(c.user1_id = $1::uuid AND c.user2_id = ub.blocked_user_id)
           OR (c.user2_id = $1::uuid AND c.user1_id = ub.blocked_user_id)`
    : '';

  const displayFromConversation = hasConversations
    ? `(SELECT COALESCE(
          NULLIF(TRIM(c.barber_name::text), ''),
          NULLIF(TRIM(c.consumer_name::text), '')
        )
        FROM conversations c
        WHERE ${convWhere}
        ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC NULLS LAST
        LIMIT 1)`
    : 'NULL::text';

  const mergedDisplaySql = `COALESCE(
    ${displayFromUserCols},
    ${displayFromFullName},
    ${displayFromInstagram},
    ${displayFromConversation}
  )`;

  const avatarFromUser =
    avatarCols.length > 0 ? coalesceFirstNonEmptyTrim('u', avatarCols) : 'NULL::text';

  const avatarFromConversation = hasConversations
    ? `(SELECT COALESCE(
          NULLIF(TRIM(c.barber_profile_picture::text), ''),
          NULLIF(TRIM(c.consumer_profile_picture::text), '')
        )
        FROM conversations c
        WHERE ${convWhere}
        ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC NULLS LAST
        LIMIT 1)`
    : 'NULL::text';

  const mergedAvatarSql = hasConversations
    ? `COALESCE(${avatarFromUser}, ${avatarFromConversation})`
    : avatarFromUser;

  const mergedFirstSql =
    firstNameCols.length > 0 ? coalesceColumnValues('u', firstNameCols) : 'NULL::text';
  const mergedLastSql = lastNameCols.length > 0 ? coalesceColumnValues('u', lastNameCols) : 'NULL::text';

  const emailSql = uCols.has('email') ? `u.${quotePgIdent('email')}` : 'NULL::text';

  const orderCreated = createdCol ? `b.${quotePgIdent(createdCol)}` : 'b.id';

  const sql = `
    SELECT DISTINCT ON (ub.blocked_user_id)
       ub.blocked_user_id::text AS blocked_user_id,
       ub.created_at AS blocked_at,
       b.id::text AS barber_record_id,
       ${mergedFirstSql} AS first_name,
       ${mergedLastSql} AS last_name,
       ${mergedDisplaySql} AS display_name,
       ${mergedAvatarSql} AS avatar_url,
       ${emailSql} AS email,
       b.${quotePgIdent(campusCol)}::text AS campus_id,
       b.${quotePgIdent(activeCol)} AS barber_is_active
     FROM user_blocks ub
     JOIN users u ON u.id = ub.blocked_user_id
     JOIN barbers b ON b.${quotePgIdent(barberUserCol)} = u.id
     WHERE ub.blocker_user_id = $1::uuid
     ORDER BY ub.blocked_user_id, b.${quotePgIdent(activeCol)} DESC NULLS LAST, ${orderCreated} DESC NULLS LAST`;

  const r = await pool.query(sql, [blockerUserId]);
  return r.rows.map((row) => ({
    blockedUserId: row.blocked_user_id,
    blockedAt: row.blocked_at instanceof Date ? row.blocked_at.toISOString() : String(row.blocked_at),
    barberRecordId: row.barber_record_id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    email: row.email,
    campusId: row.campus_id,
    barberIsActive: row.barber_is_active === true,
  }));
}

export async function listBlockedUserIds(blockerUserId: string): Promise<string[]> {
  if (!(await isUgcModerationSchemaReady())) {
    return [];
  }
  const r = await pool.query(
    `SELECT blocked_user_id::text FROM user_blocks WHERE blocker_user_id = $1 ORDER BY created_at DESC`,
    [blockerUserId]
  );
  return r.rows.map((row) => row.blocked_user_id);
}

export async function createContentReport(params: {
  reporterUserId: string;
  reportedUserId: string;
  conversationId: number | null;
  messageId: number | null;
  reason: string;
  detail?: string | null;
}): Promise<string> {
  const { reporterUserId, reportedUserId, conversationId, messageId, reason, detail } = params;
  if (!(await isUgcModerationSchemaReady())) {
    throw new ApiError(
      503,
      'Reporting is not available until database migration 028_ugc_safety_blocks_reports.sql is applied.',
      'UGC_SCHEMA_MISSING'
    );
  }
  if (reporterUserId === reportedUserId) {
    throw new ApiError(400, 'Cannot report yourself');
  }
  const reasonTrim = String(reason || '').trim();
  if (!reasonTrim || reasonTrim.length > 120) {
    throw new ApiError(400, 'A valid reason is required');
  }

  if (conversationId == null && messageId == null) {
    throw new ApiError(400, 'conversationId or messageId is required');
  }

  let conversationIdForInsert: number | null = conversationId;
  let messageIdForInsert: number | null = messageId;

  if (messageId != null) {
    const msg = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND m.is_deleted = false
         AND (c.user1_id = $2 OR c.user2_id = $2)`,
      [messageId, reporterUserId]
    );
    if (msg.rows.length === 0) {
      throw new ApiError(404, 'Message not found');
    }
    const row = msg.rows[0];
    if (String(row.sender_id) !== String(reportedUserId)) {
      throw new ApiError(400, 'Reported user must match the message sender');
    }
    if (
      conversationId != null &&
      parseInt(String(row.conversation_id), 10) !== conversationId
    ) {
      throw new ApiError(400, 'messageId does not belong to this conversation');
    }
    conversationIdForInsert = row.conversation_id;
  } else if (conversationId != null) {
    const conv = await pool.query(
      `SELECT user1_id, user2_id FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [conversationId, reporterUserId]
    );
    if (conv.rows.length === 0) {
      throw new ApiError(403, 'You can only report conversations you participate in');
    }
    const cr = conv.rows[0];
    const otherUserId =
      String(cr.user1_id) === String(reporterUserId) ? String(cr.user2_id) : String(cr.user1_id);
    if (String(reportedUserId) !== otherUserId) {
      throw new ApiError(400, 'Reported user must be the other participant in this conversation');
    }
    // Client often omits messageId; link the reported party's latest message so admins can review/removal-target it.
    const latestFromReported = await pool.query(
      `SELECT id FROM messages
       WHERE conversation_id = $1 AND sender_id = $2::uuid AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversationId, reportedUserId]
    );
    if (latestFromReported.rows.length > 0) {
      messageIdForInsert = latestFromReported.rows[0].id as number;
    }
  }

  const ins = await pool.query(
    `INSERT INTO ugc_content_reports (
       reporter_user_id, reported_user_id, conversation_id, message_id, reason, detail
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id::text`,
    [
      reporterUserId,
      reportedUserId,
      conversationIdForInsert,
      messageIdForInsert,
      reasonTrim,
      detail?.trim() || null,
    ]
  );
  const reportId = ins.rows[0].id as string;

  const subject = `[CampusCuts] UGC report ${reportId}`;
  const body = [
    `Report ID: ${reportId}`,
    `Reporter: ${reporterUserId}`,
    `Reported user: ${reportedUserId}`,
    `Conversation: ${conversationIdForInsert ?? 'n/a'}`,
    `Message: ${messageIdForInsert ?? 'n/a'}`,
    `Reason: ${reasonTrim}`,
    detail?.trim() ? `Detail: ${detail.trim()}` : '',
    '',
    'Review within 24h per App Store guidelines: remove offending content and take account action if warranted.',
  ]
    .filter(Boolean)
    .join('\n');

  logger.warn('ugc_content_report_created', {
    reportId,
    reporterUserId,
    reportedUserId,
    conversationId: conversationIdForInsert,
    messageId: messageIdForInsert,
    reason: reasonTrim,
  });

  if (MODERATION_ALERT_EMAIL) {
    sendEmail(MODERATION_ALERT_EMAIL, subject, body).catch((err) => {
      logger.error('Failed to send moderation alert email:', err);
    });
  }

  return reportId;
}

export async function notifyDeveloperOfBlock(params: {
  blockerUserId: string;
  blockedUserId: string;
}): Promise<void> {
  const { blockerUserId, blockedUserId } = params;
  const subject = `[CampusCuts] User block (UGC safety)`;
  const body = `User ${blockerUserId} blocked ${blockedUserId}.\n\nReview if reports are associated with the blocked account.`;
  logger.info('user_block_created', { blockerUserId, blockedUserId });
  if (MODERATION_ALERT_EMAIL) {
    sendEmail(MODERATION_ALERT_EMAIL, subject, body).catch((err) => {
      logger.error('Failed to send block notification email:', err);
    });
  }
}
