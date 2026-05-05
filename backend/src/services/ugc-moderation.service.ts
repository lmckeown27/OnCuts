/**
 * UGC moderation: basic content filter, user blocks, reports, developer alerts.
 * Supports App Store Guideline 1.2 (user-generated content).
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

export async function assertNoMessagingBlockBetween(
  userIdA: string,
  userIdB: string
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
    throw new ApiError(403, 'Messaging is not available with this user.');
  }
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

export async function removeUserBlock(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (!(await isUgcModerationSchemaReady())) {
    return;
  }
  await pool.query(
    `DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
    [blockerUserId, blockedUserId]
  );
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
