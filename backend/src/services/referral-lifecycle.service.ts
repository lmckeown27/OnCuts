/**
 * Check 2 verification, milestone awards, qualifying bookings, clawbacks, new-op kickback.
 */

import Stripe from 'stripe';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  getReferralProgramSettings,
  tablesReady,
  type ReferrerKind,
} from './referral-code.service';
import { applyPointsDelta } from './points-ledger.service';

function namesDiffer(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return true;
  return na !== nb;
}

/**
 * Run Check 2 after Stripe Connect onboarding for a referred operator.
 */
export async function runReferralCheck2(opts: {
  referredUserId: string;
  stripeAccount?: Stripe.Account | null;
}): Promise<{ status: string; flags: Record<string, unknown> } | null> {
  if (!(await tablesReady())) return null;

  const attr = await pool.query(
    `SELECT a.*, r.first_name AS ref_first, r.last_name AS ref_last,
            u.first_name AS new_first, u.last_name AS new_last,
            u.phone_e164 AS new_phone,
            r.phone_e164 AS ref_phone
     FROM referral_attributions a
     JOIN users r ON r.id = a.referrer_id
     JOIN users u ON u.id = a.referred_user_id
     WHERE a.referred_user_id = $1
     LIMIT 1`,
    [opts.referredUserId]
  );
  if (!attr.rows[0]) return null;
  const row = attr.rows[0];
  if (row.check2_status === 'passed' || row.check2_status === 'failed') {
    return { status: row.check2_status, flags: row.check2_flags || {} };
  }

  const flags: Record<string, unknown> = {};
  const account = opts.stripeAccount;

  // Stripe identity / capabilities
  const identityOk = Boolean(
    account &&
      account.charges_enabled &&
      account.payouts_enabled &&
      (account.details_submitted || account.requirements?.disabled_reason == null)
  );
  if (!identityOk) flags.stripeIdentityIncomplete = true;

  // New to OnCuts: referred user should not already have prior completed operator bookings as barber before attribution
  const priorOps = await pool.query(
    `SELECT 1 FROM bookings
     WHERE "barberId" = $1
       AND created_at < $2
       AND COALESCE("paidAt", paid_at) IS NOT NULL
     LIMIT 1`,
    [opts.referredUserId, row.check1_at || row.created_at || new Date()]
  );
  if (priorOps.rows.length) flags.notNewToOnCuts = true;

  // Name differs from referrer
  const refName = `${row.ref_first || ''} ${row.ref_last || ''}`;
  const newName = `${row.new_first || ''} ${row.new_last || ''}`;
  if (!namesDiffer(refName, newName)) flags.nameMatchesReferrer = true;

  // Phone differs
  if (row.new_phone && row.ref_phone && row.new_phone === row.ref_phone) {
    flags.phoneMatchesReferrer = true;
  }

  // Device: compare mobile_devices tokens if both have any overlapping device fingerprint
  try {
    const devices = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM (
         SELECT device_token FROM mobile_devices WHERE user_id = $1
         INTERSECT
         SELECT device_token FROM mobile_devices WHERE user_id = $2
       ) t`,
      [opts.referredUserId, row.referrer_id]
    );
    if ((devices.rows[0]?.cnt || 0) > 0) flags.sharedDevice = true;
  } catch {
    /* mobile_devices may lack device_token column variants */
  }

  // Payout bank: Stripe external account fingerprint vs referrer connect account if available
  if (account?.external_accounts?.data?.length) {
    try {
      const refUser = await pool.query(
        `SELECT stripe_account_id FROM users WHERE id = $1`,
        [row.referrer_id]
      );
      const refAcctId = refUser.rows[0]?.stripe_account_id;
      if (refAcctId && process.env.STRIPE_SECRET_KEY) {
        // Soft check only — flag if same account id somehow
        if (account.id === refAcctId) flags.sharedStripeAccount = true;
      }
      const fps = account.external_accounts.data
        .map((ea: any) => ea.fingerprint)
        .filter(Boolean);
      if (fps.length) flags.payoutFingerprints = fps;
    } catch (e) {
      logger.warn('referral_check2_bank_compare_failed', { error: String(e) });
    }
  }

  const hardFailKeys = [
    'notNewToOnCuts',
    'nameMatchesReferrer',
    'phoneMatchesReferrer',
    'sharedDevice',
    'sharedStripeAccount',
    'stripeIdentityIncomplete',
  ];
  const failed = hardFailKeys.some((k) => flags[k]);

  let status: string;
  if (!failed && identityOk) {
    status = 'passed';
  } else if (failed) {
    status = 'admin_review';
  } else {
    status = 'pending';
  }

  await pool.query(
    `UPDATE referral_attributions
     SET check2_status = $2,
         check2_at = CASE WHEN $2 IN ('passed', 'failed', 'admin_review') THEN NOW() ELSE check2_at END,
         check2_flags = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [row.id, status, JSON.stringify(flags)]
  );

  if (status === 'passed') {
    await awardReferralMilestone1(row.id);
  }

  logger.info('referral_check2_result', {
    attributionId: row.id,
    referredUserId: opts.referredUserId,
    status,
    flags,
  });

  return { status, flags };
}

export async function adminResolveCheck2(
  attributionId: string,
  decision: 'approve' | 'reject',
  adminUserId?: string
): Promise<void> {
  const r = await pool.query(`SELECT * FROM referral_attributions WHERE id = $1`, [attributionId]);
  if (!r.rows[0]) throw new Error('Attribution not found');
  const row = r.rows[0];
  if (decision === 'approve') {
    await pool.query(
      `UPDATE referral_attributions
       SET check2_status = 'passed', check2_at = NOW(),
           check2_flags = check2_flags || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [attributionId, JSON.stringify({ adminApprovedBy: adminUserId || null })]
    );
    if (!row.m1_awarded_at) {
      await awardReferralMilestone1(attributionId);
    }
  } else {
    await pool.query(
      `UPDATE referral_attributions
       SET check2_status = 'failed', check2_at = NOW(),
           check2_flags = check2_flags || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [attributionId, JSON.stringify({ adminRejectedBy: adminUserId || null })]
    );
  }
}

export async function awardReferralMilestone1(attributionId: string): Promise<void> {
  const settings = await getReferralProgramSettings();
  const r = await pool.query(`SELECT * FROM referral_attributions WHERE id = $1`, [attributionId]);
  const row = r.rows[0];
  if (!row || row.m1_awarded_at) return;
  if (row.check2_status !== 'passed') return;

  const kind = row.referrer_kind as ReferrerKind;
  const pts = kind === 'operator' ? settings.operatorM1 : settings.clientM1;
  if (pts <= 0) return;

  try {
    const { ledgerId } = await applyPointsDelta({
      userId: row.referrer_id,
      kind,
      deltaPts: pts,
      reason: 'referral_m1',
      referralAttributionId: attributionId,
      meta: { milestone: 1 },
    });
    await pool.query(
      `UPDATE referral_attributions
       SET m1_awarded_at = NOW(), m1_ledger_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [attributionId, ledgerId]
    );
  } catch (err: any) {
    if (err?.code === '23505') return; // idempotent
    throw err;
  }
}

/**
 * Record a qualifying paid card booking toward M2 for the referred operator.
 */
export async function recordQualifyingReferralBooking(opts: {
  bookingId: string;
  barberId: string;
  consumerId: string;
  serviceCents: number;
  paymentMethod?: string | null;
}): Promise<void> {
  if (!(await tablesReady())) return;
  const settings = await getReferralProgramSettings();

  const attr = await pool.query(
    `SELECT * FROM referral_attributions
     WHERE referred_user_id = $1 AND check2_status = 'passed'
     LIMIT 1`,
    [opts.barberId]
  );
  if (!attr.rows[0]) return;
  const row = attr.rows[0];
  if (row.m2_awarded_at || row.m2_clawed_back_at) return;

  const method = String(opts.paymentMethod || '').toLowerCase();
  if (method && method !== 'card' && method !== 'stripe' && !method.includes('card')) {
    // Prefer card-only; if unknown, allow when paid via Stripe paths
    if (method === 'cash') return;
  }
  if (opts.serviceCents < settings.minBookingCents) return;

  const approvedAt = row.check2_at || row.check1_at;
  // 0 = unlimited qualify window.
  if (settings.qualifyWindowDays > 0) {
    const windowEnd = new Date(approvedAt);
    windowEnd.setDate(windowEnd.getDate() + settings.qualifyWindowDays);
    if (new Date() > windowEnd) return;
  }

  const ids: string[] = Array.isArray(row.qualifying_booking_ids)
    ? row.qualifying_booking_ids.map(String)
    : [];
  if (ids.includes(opts.bookingId)) return;
  if (ids.length >= 3) return;

  // Distinct clients
  if (ids.length > 0) {
    const prior = await pool.query(
      `SELECT "consumerId" AS consumer_id FROM bookings WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    const priorConsumers = new Set(prior.rows.map((x) => String(x.consumer_id)));
    if (priorConsumers.has(opts.consumerId)) return;
  }

  // Client referrer: at most one of the 3 can be with that client
  if (row.referrer_kind === 'client') {
    const selfCount =
      (opts.consumerId === row.referrer_id ? 1 : 0) +
      (
        await pool.query(
          `SELECT COUNT(*)::int AS c FROM bookings
           WHERE id = ANY($1::uuid[]) AND "consumerId" = $2`,
          [ids, row.referrer_id]
        )
      ).rows[0].c;
    if (selfCount > 1 || (selfCount === 1 && opts.consumerId === row.referrer_id && ids.length > 0)) {
      // already have one with referrer
      const alreadySelf = (
        await pool.query(
          `SELECT 1 FROM bookings WHERE id = ANY($1::uuid[]) AND "consumerId" = $2 LIMIT 1`,
          [ids, row.referrer_id]
        )
      ).rows.length;
      if (alreadySelf && opts.consumerId === row.referrer_id) return;
    }
  }

  const nextIds = [...ids, opts.bookingId];
  const holdUntil =
    nextIds.length >= 3
      ? new Date(Date.now() + settings.holdDays * 24 * 60 * 60 * 1000)
      : null;

  await pool.query(
    `UPDATE referral_attributions
     SET qualifying_booking_ids = $2::uuid[],
         qualifying_booking_count = $3,
         m2_hold_until = COALESCE($4, m2_hold_until),
         updated_at = NOW()
     WHERE id = $1`,
    [row.id, nextIds, nextIds.length, holdUntil]
  );

  if (nextIds.length >= 3 && holdUntil && settings.holdDays === 0) {
    await tryAwardReferralMilestone2(row.id);
  }
}

export async function tryAwardReferralMilestone2(attributionId: string): Promise<void> {
  const settings = await getReferralProgramSettings();
  const r = await pool.query(`SELECT * FROM referral_attributions WHERE id = $1`, [attributionId]);
  const row = r.rows[0];
  if (!row || row.m2_awarded_at || row.m2_clawed_back_at) return;
  if (row.qualifying_booking_count < 3) return;
  if (row.m2_hold_until && new Date(row.m2_hold_until) > new Date()) return;

  const kind = row.referrer_kind as ReferrerKind;
  const pts = kind === 'operator' ? settings.operatorM2 : settings.clientM2;
  if (pts <= 0) return;

  try {
    const { ledgerId } = await applyPointsDelta({
      userId: row.referrer_id,
      kind,
      deltaPts: pts,
      reason: 'referral_m2',
      referralAttributionId: attributionId,
      meta: { milestone: 2, bookingIds: row.qualifying_booking_ids },
    });
    await pool.query(
      `UPDATE referral_attributions
       SET m2_awarded_at = NOW(), m2_ledger_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [attributionId, ledgerId]
    );
  } catch (err: any) {
    if (err?.code === '23505') return;
    throw err;
  }
}

/** Cron/helper: release holds that have elapsed */
export async function processDueReferralM2Awards(): Promise<number> {
  if (!(await tablesReady())) return 0;
  const r = await pool.query(
    `SELECT id FROM referral_attributions
     WHERE m2_awarded_at IS NULL
       AND m2_clawed_back_at IS NULL
       AND qualifying_booking_count >= 3
       AND m2_hold_until IS NOT NULL
       AND m2_hold_until <= NOW()
     LIMIT 50`
  );
  let n = 0;
  for (const row of r.rows) {
    await tryAwardReferralMilestone2(row.id);
    n += 1;
  }
  return n;
}

/**
 * Claw back M2 (or pending hold) if a qualifying booking is refunded/disputed during hold.
 */
export async function clawbackReferralForBooking(bookingId: string): Promise<void> {
  if (!(await tablesReady())) return;
  const r = await pool.query(
    `SELECT * FROM referral_attributions
     WHERE $1::uuid = ANY(qualifying_booking_ids)
       AND m2_clawed_back_at IS NULL
     LIMIT 1`,
    [bookingId]
  );
  if (!r.rows[0]) return;
  const row = r.rows[0];

  // Still in hold window or recently awarded — claw back M2 if awarded
  const inHold =
    row.m2_hold_until &&
    (!row.m2_awarded_at || new Date(row.m2_hold_until) >= new Date(Date.now() - 7 * 86400000));

  if (!inHold && !row.m2_awarded_at) {
    // Remove booking from qualifying set
    const ids = (row.qualifying_booking_ids || []).map(String).filter((id: string) => id !== bookingId);
    await pool.query(
      `UPDATE referral_attributions
       SET qualifying_booking_ids = $2::uuid[],
           qualifying_booking_count = $3,
           m2_hold_until = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, ids, ids.length]
    );
    return;
  }

  if (row.m2_awarded_at) {
    const settings = await getReferralProgramSettings();
    const kind = row.referrer_kind as ReferrerKind;
    const pts = kind === 'operator' ? settings.operatorM2 : settings.clientM2;
    try {
      await applyPointsDelta({
        userId: row.referrer_id,
        kind,
        deltaPts: -pts,
        reason: 'referral_m2_clawback',
        referralAttributionId: row.id,
        bookingId,
        meta: { clawbackBookingId: bookingId },
      });
    } catch (err: any) {
      if (err?.statusCode === 400) {
        // Balance too low — still mark clawed
        logger.warn('referral_m2_clawback_insufficient_balance', { attributionId: row.id });
      } else if (err?.code !== '23505') {
        throw err;
      }
    }
  }

  await pool.query(
    `UPDATE referral_attributions
     SET m2_clawed_back_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [row.id]
  );
}

/**
 * New referred operator perk: platform kickback % on first 3 completed bookings.
 * Returns the kickback percent to apply, or 0.
 */
export async function getNewOperatorReferralKickbackPercent(barberUserId: string): Promise<number> {
  if (!(await tablesReady())) return 0;
  const settings = await getReferralProgramSettings();
  if (!settings.programEnabled || settings.newOpKickbackPercent <= 0) return 0;

  const attr = await pool.query(
    `SELECT id, new_op_kickback_bookings, check2_status
     FROM referral_attributions
     WHERE referred_user_id = $1
     LIMIT 1`,
    [barberUserId]
  );
  if (!attr.rows[0]) return 0;
  if (attr.rows[0].check2_status !== 'passed' && attr.rows[0].check2_status !== 'admin_review') {
    // Spec: failed check still allows platform use; perk only after check2 pass
    if (attr.rows[0].check2_status !== 'passed') return 0;
  }
  if (attr.rows[0].check2_status !== 'passed') return 0;
  if (Number(attr.rows[0].new_op_kickback_bookings) >= 3) return 0;
  return settings.newOpKickbackPercent;
}

export async function incrementNewOperatorKickbackBooking(barberUserId: string): Promise<void> {
  await pool.query(
    `UPDATE referral_attributions
     SET new_op_kickback_bookings = LEAST(new_op_kickback_bookings + 1, 3),
         updated_at = NOW()
     WHERE referred_user_id = $1 AND check2_status = 'passed'`,
    [barberUserId]
  );
}
