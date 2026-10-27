/**
 * Referral program — codes, validate/claim, me dashboard, code requests, prompts, spend helpers.
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import {
  claimReferralAtCheck1,
  clientHasCompletedBooking,
  createCodeRequest,
  ensureActiveReferralCode,
  getReferralProgramSettings,
  listCodeHistory,
  listCodeRequests,
  listMyAttributions,
  maskReferralCode,
  normalizeReferralCode,
  rotateReferralCode,
  tablesReady,
  validateReferralCode,
} from '../services/referral-code.service';
import {
  applyPointsDelta,
  getPendingPoints,
  getPointsHistory,
} from '../services/points-ledger.service';

function pointsKindFromRole(role?: string): 'operator' | 'client' {
  const r = String(role || '').toUpperCase();
  if (r === 'BARBER' || r === 'ADMIN' || r === 'OPERATOR') return 'operator';
  return 'client';
}

export const getReferralMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    if (!(await tablesReady())) {
      throw new ApiError(503, 'Referral program is not available yet');
    }

    const settings = await getReferralProgramSettings();
    const kind = pointsKindFromRole(req.user?.role);
    const canRefer =
      kind === 'operator' ? true : await clientHasCompletedBooking(userId);

    const codeRow = canRefer ? await ensureActiveReferralCode(userId) : null;
    const [history, attributions, requests] = await Promise.all([
      canRefer ? listCodeHistory(userId) : Promise.resolve([]),
      canRefer ? listMyAttributions(userId) : Promise.resolve([]),
      kind === 'operator' ? listCodeRequests(userId) : Promise.resolve([]),
    ]);

    res.json({
      success: true,
      data: {
        programEnabled: settings.programEnabled,
        canRefer,
        referrerKind: kind,
        pointsPerDollar: settings.pointsPerDollar,
        code: codeRow
          ? {
              id: codeRow.id,
              masked: maskReferralCode(codeRow.code),
              createdAt: codeRow.createdAt,
              useCount: codeRow.useCount,
              lastUsedAt: codeRow.lastUsedAt,
              usesThisMonth: codeRow.usesThisMonth,
              maxUsesPerMonth: settings.maxUsesPerMonth,
            }
          : null,
        history,
        attributions,
        codeRequests: requests,
        rewardsHint: {
          m1: kind === 'operator' ? settings.operatorM1 : settings.clientM1,
          m2: kind === 'operator' ? settings.operatorM2 : settings.clientM2,
          total:
            kind === 'operator'
              ? settings.operatorM1 + settings.operatorM2
              : settings.clientM1 + settings.clientM2,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const revealReferralCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const kind = pointsKindFromRole(req.user?.role);
    if (kind === 'client' && !(await clientHasCompletedBooking(userId))) {
      throw new ApiError(403, 'Complete your first booking before referring');
    }
    const codeRow = await ensureActiveReferralCode(userId);
    res.json({
      success: true,
      data: {
        code: codeRow.code,
        createdAt: codeRow.createdAt,
        useCount: codeRow.useCount,
        lastUsedAt: codeRow.lastUsedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rotateMyReferralCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const kind = pointsKindFromRole(req.user?.role);
    if (kind === 'client' && !(await clientHasCompletedBooking(userId))) {
      throw new ApiError(403, 'Complete your first booking before referring');
    }
    const rotated = await rotateReferralCode(userId);
    res.json({
      success: true,
      data: {
        code: rotated.code,
        masked: maskReferralCode(rotated.code),
        createdAt: rotated.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const validateCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = normalizeReferralCode(String(req.body?.code || ''));
    const phone = typeof req.body?.phoneE164 === 'string' ? req.body.phoneE164 : null;
    const result = await validateReferralCode({
      code,
      claimantUserId: req.user?.userId || null,
      claimantPhoneE164: phone,
    });
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error, code: result.code });
      return;
    }
    res.json({
      success: true,
      data: {
        valid: true,
        referrerKind: result.referrerKind,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Public validate (no auth) — still rate-limited by phone key when provided */
export const validateCodePublic = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = normalizeReferralCode(String(req.body?.code || ''));
    const phone = typeof req.body?.phoneE164 === 'string' ? req.body.phoneE164 : null;
    const result = await validateReferralCode({
      code,
      claimantUserId: null,
      claimantPhoneE164: phone,
    });
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error, code: result.code });
      return;
    }
    res.json({ success: true, data: { valid: true, referrerKind: result.referrerKind } });
  } catch (error) {
    next(error);
  }
};

export const claimReferral = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const code = String(req.body?.code || '');
    const phone =
      typeof req.body?.phoneE164 === 'string'
        ? req.body.phoneE164
        : (req.user as any)?.phoneE164 || null;

    // Load phone from users if needed
    let phoneE164 = phone;
    if (!phoneE164) {
      const u = await pool.query(`SELECT phone_e164 FROM users WHERE id = $1`, [userId]);
      phoneE164 = u.rows[0]?.phone_e164 || null;
    }

    const claimed = await claimReferralAtCheck1({
      code,
      referredUserId: userId,
      referredPhoneE164: phoneE164,
    });
    res.status(201).json({
      success: true,
      data: {
        attributionId: claimed.attributionId,
        referrerId: claimed.referrerId,
        referrerKind: claimed.referrerKind,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const postCodeRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const operatorUserId = String(req.params.operatorUserId || req.body?.operatorUserId || '');
    if (!operatorUserId) throw new ApiError(400, 'operatorUserId is required');
    const created = await createCodeRequest({
      operatorUserId,
      requesterName: req.body?.name,
      requesterEmail: req.body?.email,
      requesterPhone: req.body?.phone,
      message: req.body?.message,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateCodeRequestStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const id = String(req.params.id);
    const status = String(req.body?.status || '');
    if (!['fulfilled', 'dismissed', 'open'].includes(status)) {
      throw new ApiError(400, 'status must be open, fulfilled, or dismissed');
    }
    const r = await pool.query(
      `UPDATE referral_code_requests
       SET status = $3, updated_at = NOW()
       WHERE id = $1 AND operator_user_id = $2
       RETURNING id, status`,
      [id, userId, status]
    );
    if (!r.rows[0]) throw new ApiError(404, 'Request not found');
    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const getRewardsMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const kindParam = String(req.query.kind || '').toLowerCase();
    const kind =
      kindParam === 'operator' || kindParam === 'client'
        ? kindParam
        : pointsKindFromRole(req.user?.role);
    const settings = await getReferralProgramSettings();
    const table = kind === 'operator' ? 'operator_points' : 'client_points';

    let balance = { balancePts: 0, lifetimeEarnedPts: 0, lifetimeSpentPts: 0, hasAccount: false };
    try {
      const r = await pool.query(
        `SELECT balance_pts, lifetime_earned_pts, lifetime_spent_pts FROM ${table} WHERE user_id = $1`,
        [userId]
      );
      if (r.rows[0]) {
        balance = {
          balancePts: Number(r.rows[0].balance_pts) || 0,
          lifetimeEarnedPts: Number(r.rows[0].lifetime_earned_pts) || 0,
          lifetimeSpentPts: Number(r.rows[0].lifetime_spent_pts) || 0,
          hasAccount: true,
        };
      }
    } catch {
      /* table missing */
    }

    const [pendingPts, history] = await Promise.all([
      getPendingPoints(userId, kind).catch(() => 0),
      getPointsHistory(userId, kind, 50).catch(() => []),
    ]);

    const dollars = (pts: number) =>
      Math.round((pts / settings.pointsPerDollar) * 100) / 100;

    res.json({
      success: true,
      data: {
        kind,
        pointsPerDollar: settings.pointsPerDollar,
        balancePts: balance.balancePts,
        balanceDollars: dollars(balance.balancePts),
        lifetimeEarnedPts: balance.lifetimeEarnedPts,
        lifetimeEarnedDollars: dollars(balance.lifetimeEarnedPts),
        lifetimeSpentPts: balance.lifetimeSpentPts,
        pendingPts,
        pendingDollars: dollars(pendingPts),
        history,
        empty: balance.balancePts === 0 && history.length === 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReferPrompt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const settings = await getReferralProgramSettings();
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
    const indefiniteAdmin = isAdmin && settings.adminIndefinitePrompts;
    // Admin indefinite prompts are controlled separately from the main program toggle.
    if (!settings.programEnabled && !indefiniteAdmin) {
      res.json({ success: true, data: { show: false } });
      return;
    }

    const kind = pointsKindFromRole(req.user?.role);
    if (!indefiniteAdmin && kind === 'client' && !(await clientHasCompletedBooking(userId))) {
      res.json({ success: true, data: { show: false } });
      return;
    }

    if (!indefiniteAdmin) {
      const state = await pool.query(
        `SELECT dismiss_count, last_prompt_at, last_dismiss_at
         FROM referral_prompt_state WHERE user_id = $1`,
        [userId]
      );
      const row = state.rows[0];
      if (row && Number(row.dismiss_count) >= settings.promptMaxDismissals) {
        res.json({ success: true, data: { show: false, reason: 'max_dismissals' } });
        return;
      }
      if (row?.last_prompt_at) {
        const nextOk = new Date(row.last_prompt_at);
        nextOk.setDate(nextOk.getDate() + settings.promptCooldownDays);
        if (nextOk > new Date()) {
          res.json({ success: true, data: { show: false, reason: 'cooldown' } });
          return;
        }
      }
    }

    const rewardPts =
      kind === 'operator'
        ? settings.operatorM1 + settings.operatorM2
        : settings.clientM1 + settings.clientM2;
    const message = indefiniteAdmin
      ? `Know operators who should be on OnCuts? Share your referral code and earn up to ${rewardPts} pts (about $${rewardPts / settings.pointsPerDollar}) when they join and get going. Beauty pros count too — braids, nails, lashes, makeup, tanning.`
      : `Know a great operator? Refer them and earn up to ${rewardPts} pts (about $${rewardPts / settings.pointsPerDollar}). Beauty pros count too — braids, nails, lashes, makeup, tanning.`;
    res.json({
      success: true,
      data: {
        show: true,
        indefiniteAdminPrompt: indefiniteAdmin,
        rewardPts,
        rewardDollars: rewardPts / settings.pointsPerDollar,
        message,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const dismissReferPrompt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const action = String(req.body?.action || 'dismiss'); // dismiss | shown
    if (action === 'shown') {
      await pool.query(
        `INSERT INTO referral_prompt_state (user_id, last_prompt_at, updated_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET last_prompt_at = NOW(), updated_at = NOW()`,
        [userId]
      );
    } else {
      await pool.query(
        `INSERT INTO referral_prompt_state (user_id, dismiss_count, last_prompt_at, last_dismiss_at, updated_at)
         VALUES ($1, 1, NOW(), NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           dismiss_count = referral_prompt_state.dismiss_count + 1,
           last_prompt_at = NOW(),
           last_dismiss_at = NOW(),
           updated_at = NOW()`,
        [userId]
      );
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/** Operator applies points to a completed paid booking (increases payout). */
export const applyOperatorPointsToBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const bookingId = String(req.params.bookingId || req.body?.bookingId || '');
    const pointsToApply = Math.floor(Number(req.body?.pointsPts));
    if (!bookingId) throw new ApiError(400, 'bookingId required');
    if (!Number.isFinite(pointsToApply) || pointsToApply < 0) {
      throw new ApiError(400, 'pointsPts must be a non-negative integer');
    }

    const settings = await getReferralProgramSettings();
    const booking = await pool.query(
      `SELECT id, "barberId" AS barber_id, "consumerId" AS consumer_id,
              COALESCE(price, 0) AS price,
              COALESCE("paidAt", paid_at) AS paid_at,
              meta
       FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (!booking.rows[0]) throw new ApiError(404, 'Booking not found');
    const b = booking.rows[0];
    if (String(b.barber_id) !== userId) throw new ApiError(403, 'Not your booking');
    if (!b.paid_at) throw new ApiError(400, 'Booking must be paid before applying points');

    const serviceCents = Math.round(Number(b.price) * 100);
    const maxPts = Math.floor(
      (serviceCents / 100) * settings.pointsPerDollar * (settings.maxSpendPercent / 100)
    );
    const applyPts = Math.min(pointsToApply, maxPts);
    if (applyPts <= 0) {
      res.json({ success: true, data: { appliedPts: 0, payoutBoostDollars: 0 } });
      return;
    }

    const dollars = applyPts / settings.pointsPerDollar;
    await applyPointsDelta({
      userId,
      kind: 'operator',
      deltaPts: -applyPts,
      reason: 'operator_booking_kickback',
      bookingId,
      meta: { payoutBoostDollars: dollars },
    });

    // Stash on booking meta if column exists
    try {
      await pool.query(
        `UPDATE bookings
         SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
         WHERE id = $1`,
        [
          bookingId,
          JSON.stringify({
            operatorPointsAppliedPts: applyPts,
            operatorPointsPayoutBoostDollars: dollars,
          }),
        ]
      );
    } catch {
      /* meta column may not exist */
    }

    res.json({
      success: true,
      data: {
        appliedPts: applyPts,
        payoutBoostDollars: dollars,
        maxPts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** Client applies points at checkout as service discount (not tip). */
export const quoteClientPointsDiscount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const serviceDollars = Number(req.body?.serviceDollars ?? req.query.serviceDollars);
    const pointsPts = Math.floor(Number(req.body?.pointsPts ?? req.query.pointsPts));
    if (!Number.isFinite(serviceDollars) || serviceDollars < 0) {
      throw new ApiError(400, 'serviceDollars required');
    }
    const settings = await getReferralProgramSettings();
    const bal = await pool.query(
      `SELECT balance_pts FROM client_points WHERE user_id = $1`,
      [userId]
    );
    const balancePts = Number(bal.rows[0]?.balance_pts) || 0;
    const maxPts = Math.min(
      balancePts,
      Math.floor(serviceDollars * settings.pointsPerDollar * (settings.maxSpendPercent / 100))
    );
    const applyPts = Math.max(0, Math.min(Number.isFinite(pointsPts) ? pointsPts : maxPts, maxPts));
    const discountDollars = applyPts / settings.pointsPerDollar;
    res.json({
      success: true,
      data: {
        balancePts,
        maxPts,
        applyPts,
        discountDollars,
        pointsPerDollar: settings.pointsPerDollar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const commitClientPointsDiscount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');
    const bookingId = String(req.body?.bookingId || '');
    const pointsPts = Math.floor(Number(req.body?.pointsPts));
    if (!bookingId) throw new ApiError(400, 'bookingId required');
    if (!Number.isFinite(pointsPts) || pointsPts <= 0) {
      throw new ApiError(400, 'pointsPts must be positive');
    }

    const settings = await getReferralProgramSettings();
    const booking = await pool.query(
      `SELECT id, "consumerId" AS consumer_id, COALESCE(price, 0) AS price
       FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (!booking.rows[0]) throw new ApiError(404, 'Booking not found');
    if (String(booking.rows[0].consumer_id) !== userId) {
      throw new ApiError(403, 'Not your booking');
    }
    const serviceDollars = Number(booking.rows[0].price) || 0;
    const maxPts = Math.floor(
      serviceDollars * settings.pointsPerDollar * (settings.maxSpendPercent / 100)
    );
    const applyPts = Math.min(pointsPts, maxPts);
    const discountDollars = applyPts / settings.pointsPerDollar;

    await applyPointsDelta({
      userId,
      kind: 'client',
      deltaPts: -applyPts,
      reason: 'client_checkout_discount',
      bookingId,
      meta: { discountDollars },
    });

    try {
      await pool.query(
        `UPDATE bookings
         SET meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb
         WHERE id = $1`,
        [
          bookingId,
          JSON.stringify({
            clientPointsDiscountPts: applyPts,
            clientPointsDiscountDollars: discountDollars,
          }),
        ]
      );
    } catch {
      /* ignore */
    }

    res.json({
      success: true,
      data: { appliedPts: applyPts, discountDollars },
    });
  } catch (error) {
    next(error);
  }
};
