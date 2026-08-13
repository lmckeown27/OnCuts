import { randomUUID } from 'crypto';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import pushNotificationService from './pushNotification.service';

export type NotificationAudience = 'consumer' | 'operator' | 'both';
export type NotificationSide = 'consumer' | 'operator';
export type NotificationKind = 'system' | 'custom';

export type TemplateVars = Record<string, string | number | undefined | null>;

export interface NotificationTemplateRow {
  id: string;
  key: string;
  kind: NotificationKind;
  label: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
  placeholders?: string[];
}

export interface SystemTemplateDefault {
  key: string;
  label: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  placeholders: string[];
}

export const SYSTEM_TEMPLATE_DEFAULTS: SystemTemplateDefault[] = [
  {
    key: 'new_booking_request',
    label: 'New booking request',
    title: 'New Booking Request!',
    body: '{{consumerName}} wants to book a {{service}} with you',
    audience: 'operator',
    placeholders: ['consumerName', 'service'],
  },
  {
    key: 'booking_accepted',
    label: 'Booking accepted',
    title: 'Booking Accepted!',
    body: '{{barberName}} accepted your booking request. Pay now to confirm.',
    audience: 'consumer',
    placeholders: ['barberName'],
  },
  {
    key: 'booking_declined',
    label: 'Booking declined',
    title: 'Booking Declined',
    body: '{{barberName}} was unable to accept your booking request{{reasonSuffix}}',
    audience: 'consumer',
    placeholders: ['barberName', 'reasonSuffix'],
  },
  {
    key: 'booking_cancelled',
    label: 'Booking cancelled',
    title: 'Booking Cancelled',
    body: '{{message}}',
    audience: 'both',
    placeholders: ['message'],
  },
  {
    key: 'booking_reminder',
    label: 'Appointment reminder',
    title: 'Appointment in {{hoursUntilLabel}}',
    body: '{{service}} with {{counterpartyName}} is coming up soon.',
    audience: 'both',
    placeholders: ['hoursUntilLabel', 'service', 'counterpartyName'],
  },
  {
    key: 'booking_reminder_start',
    label: 'Appointment starting now',
    title: 'Appointment starting now',
    body: '{{service}} with {{counterpartyName}} is starting now.',
    audience: 'both',
    placeholders: ['service', 'counterpartyName'],
  },
  {
    key: 'application_approved',
    label: 'Application accepted',
    title: 'Your {{operatorType}} application was accepted. Welcome to OnCuts',
    body: 'Your {{operatorType}} application was accepted. Welcome to OnCuts',
    audience: 'operator',
    placeholders: ['operatorType'],
  },
  {
    key: 'payment_received',
    label: 'Payment received',
    title: 'Payment Received!',
    body: '{{message}}',
    audience: 'operator',
    placeholders: ['message', 'amount'],
  },
  {
    key: 'payment_request',
    label: 'Add a tip',
    title: 'Add a tip',
    body: '{{barberName}} completed your {{service}}. Consider leaving a tip.',
    audience: 'consumer',
    placeholders: ['barberName', 'service'],
  },
  {
    key: 'schedule_change_requested',
    label: 'Schedule change requested',
    title: 'Schedule change requested',
    body: '{{consumerName}} requested to move the appointment to {{formattedDate}} at {{formattedTime}}',
    audience: 'operator',
    placeholders: ['consumerName', 'formattedDate', 'formattedTime'],
  },
  {
    key: 'schedule_change_approved',
    label: 'Schedule change approved',
    title: 'Schedule change approved',
    body: 'Your appointment was moved to {{formattedDate}} at {{formattedTime}}',
    audience: 'consumer',
    placeholders: ['formattedDate', 'formattedTime'],
  },
  {
    key: 'schedule_change_declined',
    label: 'Schedule change declined',
    title: 'Schedule change declined',
    body: 'Your provider declined the requested schedule change. Your original appointment time still stands.',
    audience: 'consumer',
    placeholders: [],
  },
  {
    key: 'booking_rescheduled',
    label: 'Booking rescheduled',
    title: 'Booking Updated',
    body: '{{counterpartyName}} has rescheduled {{reschedulePhrase}} to {{formattedDate}} at {{formattedTime}}',
    audience: 'both',
    placeholders: ['counterpartyName', 'reschedulePhrase', 'formattedDate', 'formattedTime'],
  },
  {
    key: 'booking_details_updated',
    label: 'Booking details updated',
    title: 'Booking details updated',
    body: '{{counterpartyName}} updated details for {{detailsPhrase}}.',
    audience: 'both',
    placeholders: ['counterpartyName', 'detailsPhrase'],
  },
  {
    key: 'new_review',
    label: 'New review',
    title: 'New {{satisfactionLabel}} Review',
    body: '{{consumerName}} left you a {{satisfactionLabel}} review{{commentSuffix}}',
    audience: 'operator',
    placeholders: ['satisfactionLabel', 'consumerName', 'commentSuffix'],
  },
];

const DEFAULT_BY_KEY = new Map(SYSTEM_TEMPLATE_DEFAULTS.map((row) => [row.key, row]));

let schemaReady = false;

export function interpolate(template: string, vars: TemplateVars = {}): string {
  return String(template ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value == null) return '';
    return String(value);
  });
}

export function shouldSend(audience: NotificationAudience, side: NotificationSide): boolean {
  if (audience === 'both') return true;
  return audience === side;
}

export function parseAudience(raw: unknown): NotificationAudience | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'consumer' || value === 'operator' || value === 'both') return value;
  return null;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
      label TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience TEXT NOT NULL CHECK (audience IN ('consumer', 'operator', 'both')),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  for (const row of SYSTEM_TEMPLATE_DEFAULTS) {
    await pool.query(
      `INSERT INTO notification_templates (key, kind, label, title, body, audience, enabled)
       VALUES ($1, 'system', $2, $3, $4, $5, TRUE)
       ON CONFLICT (key) DO NOTHING`,
      [row.key, row.label, row.title, row.body, row.audience]
    );
  }
  schemaReady = true;
}

function mapRow(row: Record<string, unknown>): NotificationTemplateRow {
  const key = String(row.key);
  const defaults = DEFAULT_BY_KEY.get(key);
  return {
    id: String(row.id),
    key,
    kind: row.kind === 'custom' ? 'custom' : 'system',
    label: String(row.label),
    title: String(row.title),
    body: String(row.body),
    audience: (row.audience as NotificationAudience) || 'both',
    enabled: row.enabled !== false,
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    placeholders: defaults?.placeholders ?? [],
  };
}

export async function resolveTemplate(key: string): Promise<{
  title: string;
  body: string;
  audience: NotificationAudience;
  enabled: boolean;
}> {
  const fallback = DEFAULT_BY_KEY.get(key);
  try {
    await ensureSchema();
    const result = await pool.query(
      `SELECT title, body, audience, enabled FROM notification_templates WHERE key = $1 LIMIT 1`,
      [key]
    );
    const row = result.rows[0];
    if (row) {
      return {
        title: String(row.title || fallback?.title || ''),
        body: String(row.body || fallback?.body || ''),
        audience: parseAudience(row.audience) || fallback?.audience || 'both',
        enabled: row.enabled !== false,
      };
    }
  } catch (err) {
    logger.warn('notification template lookup failed; using fallback', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (fallback) {
    return {
      title: fallback.title,
      body: fallback.body,
      audience: fallback.audience,
      enabled: true,
    };
  }
  return { title: '', body: '', audience: 'both', enabled: true };
}

export async function sendTemplatedNotification(opts: {
  userId: string | number | null | undefined;
  key: string;
  side: NotificationSide;
  vars?: TemplateVars;
  type?: string;
  data?: Record<string, unknown>;
  fallbackTitle?: string;
  fallbackBody?: string;
}): Promise<boolean> {
  const userId = String(opts.userId ?? '').trim();
  if (!userId) return false;

  const tpl = await resolveTemplate(opts.key);
  if (!tpl.enabled || !shouldSend(tpl.audience, opts.side)) return false;

  const vars = opts.vars ?? {};
  const title = interpolate(tpl.title, vars) || opts.fallbackTitle || '';
  const body = interpolate(tpl.body, vars) || opts.fallbackBody || title;
  if (!title && !body) return false;

  const type = opts.type || opts.key;
  const data = { ...(opts.data ?? {}), type };

  try {
    await notificationService.saveNotification({
      userId,
      type,
      title,
      message: body,
      data,
    });
    await pushNotificationService.sendMirrorPush(userId, title, body, type, data);
    return true;
  } catch (err) {
    logger.warn('Failed templated notification', {
      userId,
      key: opts.key,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function listNotificationTemplates(): Promise<NotificationTemplateRow[]> {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, key, kind, label, title, body, audience, enabled, last_sent_at, created_at, updated_at
       FROM notification_templates
      ORDER BY CASE WHEN kind = 'system' THEN 0 ELSE 1 END, label ASC, created_at DESC`
  );
  return result.rows.map(mapRow);
}

export async function createCustomTemplate(opts: {
  label?: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  updatedBy?: string;
}): Promise<NotificationTemplateRow> {
  await ensureSchema();
  const title = String(opts.title ?? '').trim();
  const body = String(opts.body ?? '').trim();
  if (!title || !body) {
    throw new Error('title and body are required');
  }
  const key = `custom_${randomUUID()}`;
  const label = String(opts.label ?? '').trim() || title;
  const result = await pool.query(
    `INSERT INTO notification_templates
       (key, kind, label, title, body, audience, enabled, updated_by)
     VALUES ($1, 'custom', $2, $3, $4, $5, TRUE, $6)
     RETURNING id, key, kind, label, title, body, audience, enabled, last_sent_at, created_at, updated_at`,
    [key, label, title, body, opts.audience, opts.updatedBy ?? null]
  );
  return mapRow(result.rows[0]);
}

export async function updateNotificationTemplate(
  id: string,
  patch: {
    label?: string;
    title?: string;
    body?: string;
    audience?: NotificationAudience;
    enabled?: boolean;
  },
  updatedBy?: string
): Promise<NotificationTemplateRow> {
  await ensureSchema();
  const result = await pool.query(
    `UPDATE notification_templates SET
       label = COALESCE($2, label),
       title = COALESCE($3, title),
       body = COALESCE($4, body),
       audience = COALESCE($5, audience),
       enabled = COALESCE($6, enabled),
       updated_at = NOW(),
       updated_by = $7
     WHERE id = $1
     RETURNING id, key, kind, label, title, body, audience, enabled, last_sent_at, created_at, updated_at`,
    [
      id,
      patch.label ?? null,
      patch.title ?? null,
      patch.body ?? null,
      patch.audience ?? null,
      patch.enabled ?? null,
      updatedBy ?? null,
    ]
  );
  if (result.rows.length === 0) {
    throw new Error('Notification template not found');
  }
  return mapRow(result.rows[0]);
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  await ensureSchema();
  const result = await pool.query(
    `DELETE FROM notification_templates WHERE id = $1 AND kind = 'custom' RETURNING id`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new Error('Custom notification not found');
  }
}

function rolesForAudience(audience: NotificationAudience): string[] {
  if (audience === 'consumer') return ['CONSUMER'];
  if (audience === 'operator') return ['BARBER'];
  return ['CONSUMER', 'BARBER'];
}

export async function queueCustomBroadcast(id: string): Promise<{ queued: number; audience: NotificationAudience }> {
  await ensureSchema();
  const found = await pool.query(
    `SELECT id, key, kind, title, body, audience, enabled
       FROM notification_templates
      WHERE id = $1`,
    [id]
  );
  const row = found.rows[0];
  if (!row) throw new Error('Notification template not found');
  if (row.kind !== 'custom') throw new Error('Only custom notifications can be sent');
  if (row.enabled === false) throw new Error('Notification is disabled');

  const audience = parseAudience(row.audience) || 'both';
  const roles = rolesForAudience(audience);
  const users = await pool.query(
    `SELECT id FROM users
      WHERE role::text = ANY($1::text[])
        AND ("isBanned" IS NOT TRUE)`,
    [roles]
  );

  await pool.query(`UPDATE notification_templates SET last_sent_at = NOW() WHERE id = $1`, [id]);

  const title = String(row.title);
  const body = String(row.body);
  const userIds = users.rows.map((u) => String(u.id));

  void (async () => {
    let sent = 0;
    for (const userId of userIds) {
      try {
        await notificationService.saveNotification({
          userId,
          type: 'admin_announcement',
          title,
          message: body,
          data: { templateId: id, action: 'open_home' },
        });
        await pushNotificationService.sendMirrorPush(
          userId,
          title,
          body,
          'admin_announcement',
          { templateId: id, action: 'open_home' }
        );
        sent += 1;
      } catch (err) {
        logger.warn('Custom announcement send failed', {
          userId,
          templateId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    logger.info('Custom announcement broadcast finished', {
      templateId: id,
      queued: userIds.length,
      sent,
    });
  })();

  return { queued: userIds.length, audience };
}
