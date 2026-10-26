/**
 * Admin referral ledger + program settings.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getReferralProgramSettings, tablesReady } from '../services/referral-code.service';
import { adminResolveCheck2 } from '../services/referral-lifecycle.service';

export const listReferralAttributions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!(await tablesReady())) throw new ApiError(404, 'Referral tables not migrated');
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const status = String(req.query.status || '').trim();

    const filterParams: unknown[] = [];
    let where = 'TRUE';
    if (status) {
      filterParams.push(status);
      where += ` AND a.check2_status = $${filterParams.length}`;
    }
    const listParams = [...filterParams, limit, offset];
    const limitIdx = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;

    const result = await pool.query(
      `SELECT
         a.id,
         a.referrer_id,
         a.referred_user_id,
         a.referrer_kind,
         a.code_snapshot,
         a.check1_at,
         a.check2_status,
         a.check2_at,
         a.check2_flags,
         a.qualifying_booking_count,
         a.m1_awarded_at,
         a.m2_hold_until,
         a.m2_awarded_at,
         a.m2_clawed_back_at,
         a.created_at,
         rf."firstName" AS referrer_first,
         rf."lastName" AS referrer_last,
         rf.email AS referrer_email,
         rd."firstName" AS referred_first,
         rd."lastName" AS referred_last,
         rd.email AS referred_email
       FROM referral_attributions a
       JOIN users rf ON rf.id = a.referrer_id
       JOIN users rd ON rd.id = a.referred_user_id
       WHERE ${where}
       ORDER BY
         CASE WHEN a.check2_status = 'admin_review' THEN 0 ELSE 1 END,
         a.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams
    );

    const count = await pool.query(
      `SELECT COUNT(*)::int AS c FROM referral_attributions a WHERE ${where}`,
      filterParams
    );

    res.json({
      success: true,
      data: {
        total: count.rows[0]?.c || 0,
        items: result.rows.map((row) => ({
          id: row.id,
          referrerId: row.referrer_id,
          referredUserId: row.referred_user_id,
          referrerKind: row.referrer_kind,
          codeSnapshot: row.code_snapshot,
          check1At: row.check1_at,
          check2Status: row.check2_status,
          check2At: row.check2_at,
          check2Flags: row.check2_flags,
          qualifyingBookingCount: row.qualifying_booking_count,
          m1AwardedAt: row.m1_awarded_at,
          m2HoldUntil: row.m2_hold_until,
          m2AwardedAt: row.m2_awarded_at,
          m2ClawedBackAt: row.m2_clawed_back_at,
          createdAt: row.created_at,
          referrerName: [row.referrer_first, row.referrer_last].filter(Boolean).join(' '),
          referrerEmail: row.referrer_email,
          referredName: [row.referred_first, row.referred_last].filter(Boolean).join(' '),
          referredEmail: row.referred_email,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveReferralAttribution = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);
    const decision = String(req.body?.decision || '').toLowerCase();
    if (decision !== 'approve' && decision !== 'reject') {
      throw new ApiError(400, 'decision must be approve or reject');
    }
    await adminResolveCheck2(id, decision, req.user?.userId);
    res.json({ success: true, data: { id, decision } });
  } catch (error) {
    next(error);
  }
};

export const getReferralSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await getReferralProgramSettings();
    const costPerOpPts =
      Math.max(settings.operatorM1, settings.clientM1) +
      Math.max(settings.operatorM2, settings.clientM2);
    res.json({
      success: true,
      data: {
        ...settings,
        estimatedCostPerNewOperatorPts: costPerOpPts,
        estimatedCostPerNewOperatorDollars: costPerOpPts / settings.pointsPerDollar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateReferralSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const b = req.body || {};
    const sets: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      programEnabled: 'referral_program_enabled',
      pointsPerDollar: 'points_per_dollar',
      operatorM1: 'referral_operator_m1_pts',
      operatorM2: 'referral_operator_m2_pts',
      clientM1: 'referral_client_m1_pts',
      clientM2: 'referral_client_m2_pts',
      holdDays: 'referral_hold_days',
      qualifyWindowDays: 'referral_qualify_window_days',
      minBookingCents: 'referral_min_booking_cents',
      newOpKickbackPercent: 'referral_new_op_kickback_percent',
      maxSpendPercent: 'referral_max_spend_percent',
      rotationsPerDay: 'referral_code_rotations_per_day',
      maxUsesPerMonth: 'referral_code_max_uses_per_month',
      validateMaxAttempts: 'referral_validate_max_attempts',
      validateLockoutHours: 'referral_validate_lockout_hours',
      promptCooldownDays: 'referral_prompt_cooldown_days',
      promptMaxDismissals: 'referral_prompt_max_dismissals',
      adminIndefinitePrompts: 'referral_admin_indefinite_prompts',
    };

    for (const [key, col] of Object.entries(map)) {
      if (b[key] === undefined) continue;
      vals.push(b[key]);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) throw new ApiError(400, 'No settings to update');
    vals.push(req.user?.userId || null);
    sets.push(`updated_at = NOW()`);
    sets.push(`updated_by = $${vals.length}`);

    await pool.query(`UPDATE platform_settings SET ${sets.join(', ')} WHERE id = 1`, vals);
    const settings = await getReferralProgramSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};
