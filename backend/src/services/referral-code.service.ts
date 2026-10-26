/**
 * Personal referral codes (XXXX-XXXX) — generate, reveal, rotate, validate, Check 1 claim.
 */

import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export type ReferrerKind = 'operator' | 'client';

export interface ReferralProgramSettings {
  programEnabled: boolean;
  pointsPerDollar: number;
  operatorM1: number;
  operatorM2: number;
  clientM1: number;
  clientM2: number;
  holdDays: number;
  qualifyWindowDays: number;
  minBookingCents: number;
  newOpKickbackPercent: number;
  maxSpendPercent: number;
  rotationsPerDay: number;
  maxUsesPerMonth: number;
  validateMaxAttempts: number;
  validateLockoutHours: number;
  promptCooldownDays: number;
  promptMaxDismissals: number;
  /** Admins: show refer-operators prompt on entry with no cooldown / max dismissals. */
  adminIndefinitePrompts: boolean;
}

const DEFAULT_SETTINGS: ReferralProgramSettings = {
  programEnabled: true,
  pointsPerDollar: 10,
  operatorM1: 250,
  operatorM2: 500,
  clientM1: 350,
  clientM2: 700,
  holdDays: 7,
  qualifyWindowDays: 60,
  minBookingCents: 2000,
  newOpKickbackPercent: 10,
  maxSpendPercent: 100,
  rotationsPerDay: 3,
  maxUsesPerMonth: 10,
  validateMaxAttempts: 5,
  validateLockoutHours: 24,
  promptCooldownDays: 30,
  promptMaxDismissals: 3,
  adminIndefinitePrompts: false,
};

export function normalizeReferralCode(raw: string): string {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 8) return String(raw || '').trim().toUpperCase();
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export function maskReferralCode(code: string): string {
  const n = normalizeReferralCode(code);
  if (!CODE_RE.test(n)) return '••••-••••';
  return `${n.slice(0, 4)}-••••`;
}

function randomCodeSegment(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function generateReferralCodeValue(): string {
  return `${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
}

export async function tablesReady(): Promise<boolean> {
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.referral_codes') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  try {
    const r = await pool.query(
      `SELECT
         COALESCE(referral_program_enabled, TRUE) AS program_enabled,
         COALESCE(points_per_dollar, 10) AS points_per_dollar,
         COALESCE(referral_operator_m1_pts, 250) AS operator_m1,
         COALESCE(referral_operator_m2_pts, 500) AS operator_m2,
         COALESCE(referral_client_m1_pts, 350) AS client_m1,
         COALESCE(referral_client_m2_pts, 700) AS client_m2,
         COALESCE(referral_hold_days, 7) AS hold_days,
         COALESCE(referral_qualify_window_days, 60) AS qualify_window_days,
         COALESCE(referral_min_booking_cents, 2000) AS min_booking_cents,
         COALESCE(referral_new_op_kickback_percent, 10) AS new_op_kickback,
         COALESCE(referral_max_spend_percent, 100) AS max_spend,
         COALESCE(referral_code_rotations_per_day, 3) AS rotations_per_day,
         COALESCE(referral_code_max_uses_per_month, 10) AS max_uses_month,
         COALESCE(referral_validate_max_attempts, 5) AS max_attempts,
         COALESCE(referral_validate_lockout_hours, 24) AS lockout_hours,
         COALESCE(referral_prompt_cooldown_days, 30) AS prompt_cooldown,
         COALESCE(referral_prompt_max_dismissals, 3) AS prompt_max_dismiss,
         COALESCE(referral_admin_indefinite_prompts, FALSE) AS admin_indefinite_prompts
       FROM platform_settings WHERE id = 1 LIMIT 1`
    );
    const row = r.rows[0];
    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      programEnabled: Boolean(row.program_enabled),
      pointsPerDollar: Number(row.points_per_dollar) || 10,
      operatorM1: Number(row.operator_m1) || 250,
      operatorM2: Number(row.operator_m2) || 500,
      clientM1: Number(row.client_m1) || 350,
      clientM2: Number(row.client_m2) || 700,
      holdDays: Number(row.hold_days) || 7,
      qualifyWindowDays: Number(row.qualify_window_days) || 60,
      minBookingCents: Number(row.min_booking_cents) || 2000,
      newOpKickbackPercent: Number(row.new_op_kickback) || 10,
      maxSpendPercent: Number(row.max_spend) || 100,
      rotationsPerDay: Number(row.rotations_per_day) || 3,
      maxUsesPerMonth: Number(row.max_uses_month) || 10,
      validateMaxAttempts: Number(row.max_attempts) || 5,
      validateLockoutHours: Number(row.lockout_hours) || 24,
      promptCooldownDays: Number(row.prompt_cooldown) || 30,
      promptMaxDismissals: Number(row.prompt_max_dismiss) || 3,
      adminIndefinitePrompts: Boolean(row.admin_indefinite_prompts),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function codeIsBlockedFromReissue(code: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM referral_code_history
     WHERE code = $1 AND reissue_blocked_until > NOW()
     LIMIT 1`,
    [code]
  );
  return r.rows.length > 0;
}

export async function ensureActiveReferralCode(userId: string): Promise<{
  id: string;
  code: string;
  createdAt: string;
  useCount: number;
  lastUsedAt: string | null;
  usesThisMonth: number;
}> {
  if (!(await tablesReady())) {
    throw new ApiError(503, 'Referral program is not available yet');
  }

  const existing = await pool.query(
    `SELECT id, code, created_at, use_count, last_used_at, uses_this_month, month_bucket
     FROM referral_codes
     WHERE user_id = $1 AND is_active = TRUE
     LIMIT 1`,
    [userId]
  );

  const monthBucket = new Date().toISOString().slice(0, 7);
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.month_bucket !== monthBucket) {
      await pool.query(
        `UPDATE referral_codes SET uses_this_month = 0, month_bucket = $2
         WHERE id = $1`,
        [row.id, monthBucket]
      );
      row.uses_this_month = 0;
    }
    return {
      id: row.id,
      code: row.code,
      createdAt: row.created_at,
      useCount: Number(row.use_count) || 0,
      lastUsedAt: row.last_used_at,
      usesThisMonth: Number(row.uses_this_month) || 0,
    };
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const code = generateReferralCodeValue();
    if (await codeIsBlockedFromReissue(code)) continue;
    try {
      const inserted = await pool.query(
        `INSERT INTO referral_codes (user_id, code, is_active, month_bucket)
         VALUES ($1, $2, TRUE, $3)
         RETURNING id, code, created_at, use_count, last_used_at, uses_this_month`,
        [userId, code, monthBucket]
      );
      const row = inserted.rows[0];
      return {
        id: row.id,
        code: row.code,
        createdAt: row.created_at,
        useCount: 0,
        lastUsedAt: null,
        usesThisMonth: 0,
      };
    } catch (err: any) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }
  throw new ApiError(500, 'Could not allocate a referral code');
}

export async function rotateReferralCode(userId: string): Promise<{
  id: string;
  code: string;
  createdAt: string;
}> {
  const settings = await getReferralProgramSettings();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT * FROM referral_codes WHERE user_id = $1 AND is_active = TRUE FOR UPDATE`,
      [userId]
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      const created = await ensureActiveReferralCode(userId);
      return { id: created.id, code: created.code, createdAt: created.createdAt };
    }
    const row = current.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    let rotationsToday = Number(row.rotations_today) || 0;
    if (String(row.rotation_day).slice(0, 10) !== today) {
      rotationsToday = 0;
    }
    if (rotationsToday >= settings.rotationsPerDay) {
      throw new ApiError(429, `You can rotate your code at most ${settings.rotationsPerDay} times per day`);
    }

    await client.query(
      `UPDATE referral_codes
       SET is_active = FALSE, retired_at = NOW(), rotated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `INSERT INTO referral_code_history
         (user_id, code, code_id, created_at, retired_at, reissue_blocked_until, use_count, last_used_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '365 days', $5, $6)`,
      [userId, row.code, row.id, row.created_at, row.use_count, row.last_used_at]
    );

    let newCode: string | null = null;
    let newId: string | null = null;
    let createdAt: string | null = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = generateReferralCodeValue();
      const blocked = await client.query(
        `SELECT 1 FROM referral_code_history WHERE code = $1 AND reissue_blocked_until > NOW() LIMIT 1`,
        [candidate]
      );
      if (blocked.rows.length) continue;
      try {
        const ins = await client.query(
          `INSERT INTO referral_codes
             (user_id, code, is_active, month_bucket, rotations_today, rotation_day)
           VALUES ($1, $2, TRUE, to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'), $3, CURRENT_DATE)
           RETURNING id, code, created_at`,
          [userId, candidate, rotationsToday + 1]
        );
        newId = ins.rows[0].id;
        newCode = ins.rows[0].code;
        createdAt = ins.rows[0].created_at;
        break;
      } catch (err: any) {
        if (err?.code === '23505') continue;
        throw err;
      }
    }
    if (!newId || !newCode || !createdAt) {
      throw new ApiError(500, 'Could not allocate a new referral code');
    }
    await client.query('COMMIT');
    return { id: newId, code: newCode, createdAt };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

async function getAttemptKey(opts: { userId?: string | null; phoneE164?: string | null }): Promise<string> {
  if (opts.phoneE164) return `phone:${opts.phoneE164}`;
  if (opts.userId) return `user:${opts.userId}`;
  return `anon:${opts.userId || 'unknown'}`;
}

async function assertNotLocked(attemptKey: string, settings: ReferralProgramSettings): Promise<void> {
  const r = await pool.query(
    `SELECT fail_count, locked_until FROM referral_code_attempts WHERE attempt_key = $1`,
    [attemptKey]
  );
  const row = r.rows[0];
  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    throw new ApiError(
      429,
      `Too many incorrect referral codes. Try again after ${new Date(row.locked_until).toISOString()}`
    );
  }
}

async function recordFailedAttempt(attemptKey: string, settings: ReferralProgramSettings): Promise<void> {
  await pool.query(
    `INSERT INTO referral_code_attempts (attempt_key, fail_count, updated_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (attempt_key) DO UPDATE SET
       fail_count = CASE
         WHEN referral_code_attempts.locked_until IS NOT NULL
           AND referral_code_attempts.locked_until <= NOW()
         THEN 1
         ELSE referral_code_attempts.fail_count + 1
       END,
       locked_until = CASE
         WHEN (
           CASE
             WHEN referral_code_attempts.locked_until IS NOT NULL
               AND referral_code_attempts.locked_until <= NOW()
             THEN 1
             ELSE referral_code_attempts.fail_count + 1
           END
         ) >= $2
         THEN NOW() + ($3 || ' hours')::interval
         ELSE referral_code_attempts.locked_until
       END,
       updated_at = NOW()`,
    [attemptKey, settings.validateMaxAttempts, String(settings.validateLockoutHours)]
  );
}

async function clearAttempts(attemptKey: string): Promise<void> {
  await pool.query(`DELETE FROM referral_code_attempts WHERE attempt_key = $1`, [attemptKey]);
}

export type ValidateReferralResult =
  | {
      ok: true;
      codeId: string;
      code: string;
      referrerId: string;
      referrerKind: ReferrerKind;
    }
  | { ok: false; error: string; code?: string };

async function resolveReferrerKind(referrerId: string): Promise<ReferrerKind> {
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [referrerId]);
  const role = String(r.rows[0]?.role || '').toUpperCase();
  if (role === 'BARBER' || role === 'ADMIN' || role === 'OPERATOR') return 'operator';
  return 'client';
}

export async function clientHasCompletedBooking(userId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM bookings
     WHERE "consumerId" = $1
       AND UPPER(COALESCE(status::text, '')) IN ('COMPLETED', 'PAID', 'COMPLETE')
     LIMIT 1`,
    [userId]
  );
  if (r.rows.length) return true;
  // Also accept paid bookings as "completed" for eligibility
  const r2 = await pool.query(
    `SELECT 1 FROM bookings
     WHERE "consumerId" = $1
       AND (COALESCE("paidAt", paid_at) IS NOT NULL)
     LIMIT 1`,
    [userId]
  );
  return r2.rows.length > 0;
}

/**
 * Validate a referral code for Check 1 (does not create attribution).
 */
export async function validateReferralCode(opts: {
  code: string;
  claimantUserId?: string | null;
  claimantPhoneE164?: string | null;
}): Promise<ValidateReferralResult> {
  if (!(await tablesReady())) {
    return { ok: false, error: 'Referral program is not available yet', code: 'unavailable' };
  }
  const settings = await getReferralProgramSettings();
  if (!settings.programEnabled) {
    return { ok: false, error: 'Referral program is disabled', code: 'disabled' };
  }

  const attemptKey = await getAttemptKey({
    userId: opts.claimantUserId,
    phoneE164: opts.claimantPhoneE164,
  });
  await assertNotLocked(attemptKey, settings);

  const code = normalizeReferralCode(opts.code);
  if (!CODE_RE.test(code)) {
    await recordFailedAttempt(attemptKey, settings);
    return { ok: false, error: 'That referral code is not valid', code: 'invalid_format' };
  }

  const history = await pool.query(
    `SELECT 1 FROM referral_code_history WHERE code = $1 LIMIT 1`,
    [code]
  );
  if (history.rows.length) {
    await recordFailedAttempt(attemptKey, settings);
    return {
      ok: false,
      error: 'This referral code was rotated and is no longer valid',
      code: 'rotated',
    };
  }

  const active = await pool.query(
    `SELECT id, user_id, code, is_active, uses_this_month, month_bucket
     FROM referral_codes WHERE code = $1 LIMIT 1`,
    [code]
  );
  if (!active.rows[0] || !active.rows[0].is_active) {
    await recordFailedAttempt(attemptKey, settings);
    return { ok: false, error: 'That referral code is not valid', code: 'not_found' };
  }

  const row = active.rows[0];
  if (opts.claimantUserId && row.user_id === opts.claimantUserId) {
    return { ok: false, error: 'You cannot use your own referral code', code: 'own_code' };
  }

  if (opts.claimantUserId) {
    const already = await pool.query(
      `SELECT 1 FROM referral_attributions WHERE referred_user_id = $1 LIMIT 1`,
      [opts.claimantUserId]
    );
    if (already.rows.length) {
      return {
        ok: false,
        error: 'This account has already used a referral code',
        code: 'already_referred',
      };
    }
  }

  if (opts.claimantPhoneE164) {
    const phoneUsed = await pool.query(
      `SELECT 1 FROM referral_attributions WHERE referred_phone_e164 = $1 LIMIT 1`,
      [opts.claimantPhoneE164]
    );
    if (phoneUsed.rows.length) {
      return {
        ok: false,
        error: 'This phone number has already been used with a referral',
        code: 'phone_already_referred',
      };
    }
  }

  const monthBucket = new Date().toISOString().slice(0, 7);
  let usesThisMonth = Number(row.uses_this_month) || 0;
  if (row.month_bucket !== monthBucket) usesThisMonth = 0;
  if (usesThisMonth >= settings.maxUsesPerMonth) {
    return {
      ok: false,
      error: 'This referral code has reached its monthly limit',
      code: 'monthly_cap',
    };
  }

  const referrerKind = await resolveReferrerKind(row.user_id);
  if (referrerKind === 'client') {
    const eligible = await clientHasCompletedBooking(row.user_id);
    if (!eligible) {
      return {
        ok: false,
        error: 'This referrer is not eligible to refer yet',
        code: 'referrer_ineligible',
      };
    }
  }

  await clearAttempts(attemptKey);
  return {
    ok: true,
    codeId: row.id,
    code: row.code,
    referrerId: row.user_id,
    referrerKind,
  };
}

/**
 * Check 1: lock attribution to referrer for a new operator user.
 */
export async function claimReferralAtCheck1(opts: {
  code: string;
  referredUserId: string;
  referredPhoneE164?: string | null;
}): Promise<{ attributionId: string; referrerId: string; referrerKind: ReferrerKind }> {
  const validated = await validateReferralCode({
    code: opts.code,
    claimantUserId: opts.referredUserId,
    claimantPhoneE164: opts.referredPhoneE164,
  });
  if (!validated.ok) {
    throw new ApiError(400, validated.error);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const monthBucket = new Date().toISOString().slice(0, 7);
    await client.query(
      `UPDATE referral_codes SET
         use_count = use_count + 1,
         last_used_at = NOW(),
         uses_this_month = CASE WHEN month_bucket = $2 THEN uses_this_month + 1 ELSE 1 END,
         month_bucket = $2
       WHERE id = $1`,
      [validated.codeId, monthBucket]
    );

    const ins = await client.query(
      `INSERT INTO referral_attributions
         (referrer_id, referred_user_id, code_id, code_snapshot, referrer_kind, referred_phone_e164, check1_at, check2_status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'pending')
       RETURNING id`,
      [
        validated.referrerId,
        opts.referredUserId,
        validated.codeId,
        validated.code,
        validated.referrerKind,
        opts.referredPhoneE164 || null,
      ]
    );
    await client.query('COMMIT');
    logger.info('referral_check1_claimed', {
      attributionId: ins.rows[0].id,
      referrerId: validated.referrerId,
      referredUserId: opts.referredUserId,
    });
    return {
      attributionId: ins.rows[0].id,
      referrerId: validated.referrerId,
      referrerKind: validated.referrerKind,
    };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (err?.code === '23505') {
      throw new ApiError(400, 'This account has already used a referral code');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function listCodeHistory(userId: string) {
  const r = await pool.query(
    `SELECT code, created_at, retired_at, use_count, last_used_at, reissue_blocked_until
     FROM referral_code_history
     WHERE user_id = $1
     ORDER BY retired_at DESC
     LIMIT 50`,
    [userId]
  );
  return r.rows.map((row) => ({
    code: maskReferralCode(row.code),
    codeFullHidden: true,
    createdAt: row.created_at,
    retiredAt: row.retired_at,
    useCount: Number(row.use_count) || 0,
    lastUsedAt: row.last_used_at,
    reissueBlockedUntil: row.reissue_blocked_until,
  }));
}

export async function listMyAttributions(referrerId: string) {
  const r = await pool.query(
    `SELECT
       a.id,
       a.referred_user_id,
       a.referrer_kind,
       a.check1_at,
       a.check2_status,
       a.check2_at,
       a.qualifying_booking_count,
       a.m1_awarded_at,
       a.m2_hold_until,
       a.m2_awarded_at,
       u."firstName" AS first_name,
       u."lastName" AS last_name
     FROM referral_attributions a
     JOIN users u ON u.id = a.referred_user_id
     WHERE a.referrer_id = $1
     ORDER BY a.created_at DESC
     LIMIT 100`,
    [referrerId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    referredUserId: row.referred_user_id,
    displayName:
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Operator',
    check1At: row.check1_at,
    check2Status: row.check2_status,
    check2At: row.check2_at,
    qualifyingBookingCount: Number(row.qualifying_booking_count) || 0,
    m1AwardedAt: row.m1_awarded_at,
    m2HoldUntil: row.m2_hold_until,
    m2AwardedAt: row.m2_awarded_at,
  }));
}

export async function listCodeRequests(operatorUserId: string) {
  const r = await pool.query(
    `SELECT id, requester_name, requester_email, requester_phone, message, status, created_at
     FROM referral_code_requests
     WHERE operator_user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [operatorUserId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createCodeRequest(opts: {
  operatorUserId: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  message?: string;
}) {
  if (!(await tablesReady())) {
    throw new ApiError(503, 'Referral program is not available yet');
  }
  const r = await pool.query(
    `INSERT INTO referral_code_requests
       (operator_user_id, requester_name, requester_email, requester_phone, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [
      opts.operatorUserId,
      opts.requesterName || null,
      opts.requesterEmail || null,
      opts.requesterPhone || null,
      opts.message || null,
    ]
  );
  return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
}
