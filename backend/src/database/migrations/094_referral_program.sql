-- Referral program: codes, attributions, requests, points ledger, platform knobs.
-- Idempotent. Supersedes unused legacy `referrals` dump stub (not created here).

-- ---------------------------------------------------------------------------
-- Platform settings (referral / points program)
-- ---------------------------------------------------------------------------
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS points_per_dollar INTEGER NOT NULL DEFAULT 10
    CHECK (points_per_dollar > 0),
  ADD COLUMN IF NOT EXISTS referral_operator_m1_pts INTEGER NOT NULL DEFAULT 250
    CHECK (referral_operator_m1_pts >= 0),
  ADD COLUMN IF NOT EXISTS referral_operator_m2_pts INTEGER NOT NULL DEFAULT 500
    CHECK (referral_operator_m2_pts >= 0),
  ADD COLUMN IF NOT EXISTS referral_client_m1_pts INTEGER NOT NULL DEFAULT 350
    CHECK (referral_client_m1_pts >= 0),
  ADD COLUMN IF NOT EXISTS referral_client_m2_pts INTEGER NOT NULL DEFAULT 700
    CHECK (referral_client_m2_pts >= 0),
  ADD COLUMN IF NOT EXISTS referral_hold_days INTEGER NOT NULL DEFAULT 7
    CHECK (referral_hold_days >= 0),
  ADD COLUMN IF NOT EXISTS referral_qualify_window_days INTEGER NOT NULL DEFAULT 60
    CHECK (referral_qualify_window_days > 0),
  ADD COLUMN IF NOT EXISTS referral_min_booking_cents INTEGER NOT NULL DEFAULT 2000
    CHECK (referral_min_booking_cents >= 0),
  ADD COLUMN IF NOT EXISTS referral_new_op_kickback_percent NUMERIC(5,2) NOT NULL DEFAULT 10
    CHECK (referral_new_op_kickback_percent >= 0 AND referral_new_op_kickback_percent <= 100),
  ADD COLUMN IF NOT EXISTS referral_max_spend_percent INTEGER NOT NULL DEFAULT 100
    CHECK (referral_max_spend_percent >= 0 AND referral_max_spend_percent <= 100),
  ADD COLUMN IF NOT EXISTS referral_code_rotations_per_day INTEGER NOT NULL DEFAULT 3
    CHECK (referral_code_rotations_per_day > 0),
  ADD COLUMN IF NOT EXISTS referral_code_max_uses_per_month INTEGER NOT NULL DEFAULT 10
    CHECK (referral_code_max_uses_per_month > 0),
  ADD COLUMN IF NOT EXISTS referral_validate_max_attempts INTEGER NOT NULL DEFAULT 5
    CHECK (referral_validate_max_attempts > 0),
  ADD COLUMN IF NOT EXISTS referral_validate_lockout_hours INTEGER NOT NULL DEFAULT 24
    CHECK (referral_validate_lockout_hours > 0),
  ADD COLUMN IF NOT EXISTS referral_prompt_cooldown_days INTEGER NOT NULL DEFAULT 30
    CHECK (referral_prompt_cooldown_days > 0),
  ADD COLUMN IF NOT EXISTS referral_prompt_max_dismissals INTEGER NOT NULL DEFAULT 3
    CHECK (referral_prompt_max_dismissals > 0),
  ADD COLUMN IF NOT EXISTS referral_program_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS points_never_expire BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN platform_settings.points_per_dollar IS 'OnCuts Points per $1 (display and spend conversion).';
COMMENT ON COLUMN platform_settings.referral_operator_m1_pts IS 'Pts to operator referrer when Check 2 passes.';
COMMENT ON COLUMN platform_settings.referral_operator_m2_pts IS 'Pts to operator referrer after 3 qualifying bookings + hold.';
COMMENT ON COLUMN platform_settings.referral_client_m1_pts IS 'Pts to client referrer when Check 2 passes.';
COMMENT ON COLUMN platform_settings.referral_client_m2_pts IS 'Pts to client referrer after 3 qualifying bookings + hold.';
COMMENT ON COLUMN platform_settings.referral_new_op_kickback_percent IS 'Platform kickback % on referred operator first 3 completed bookings.';

-- ---------------------------------------------------------------------------
-- Referral codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(9) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  last_used_at TIMESTAMPTZ,
  uses_this_month INTEGER NOT NULL DEFAULT 0 CHECK (uses_this_month >= 0),
  month_bucket CHAR(7) NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM'),
  rotations_today INTEGER NOT NULL DEFAULT 0 CHECK (rotations_today >= 0),
  rotation_day DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT referral_codes_code_format CHECK (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code_unique ON referral_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_one_active_per_user
  ON referral_codes (user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes (user_id);

COMMENT ON TABLE referral_codes IS 'Personal referral codes (XXXX-XXXX). Active row is the live API-key-style code.';

CREATE TABLE IF NOT EXISTS referral_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(9) NOT NULL,
  code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reissue_blocked_until TIMESTAMPTZ NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_code_history_code ON referral_code_history (code);
CREATE INDEX IF NOT EXISTS idx_referral_code_history_user ON referral_code_history (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_history_reissue
  ON referral_code_history (code, reissue_blocked_until);

COMMENT ON TABLE referral_code_history IS 'Retired referral codes; blocked from reissue for 365 days.';

CREATE TABLE IF NOT EXISTS referral_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key VARCHAR(128) NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_code_attempts_key_unique UNIQUE (attempt_key)
);

COMMENT ON TABLE referral_code_attempts IS 'Wrong referral-code tries keyed by phone or user id; lockout after N fails.';

-- ---------------------------------------------------------------------------
-- Attributions (Check 1 / Check 2 / milestones)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  code_snapshot VARCHAR(9) NOT NULL,
  referrer_kind VARCHAR(16) NOT NULL CHECK (referrer_kind IN ('operator', 'client')),
  referred_phone_e164 VARCHAR(32),
  check1_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check2_status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (check2_status IN ('pending', 'passed', 'failed', 'admin_review')),
  check2_at TIMESTAMPTZ,
  check2_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualifying_booking_ids UUID[] NOT NULL DEFAULT '{}',
  qualifying_booking_count INTEGER NOT NULL DEFAULT 0 CHECK (qualifying_booking_count >= 0),
  m1_awarded_at TIMESTAMPTZ,
  m1_ledger_id UUID,
  m2_hold_until TIMESTAMPTZ,
  m2_awarded_at TIMESTAMPTZ,
  m2_ledger_id UUID,
  m2_clawed_back_at TIMESTAMPTZ,
  new_op_kickback_bookings INTEGER NOT NULL DEFAULT 0 CHECK (new_op_kickback_bookings >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON referral_attributions (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_check2 ON referral_attributions (check2_status);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_phone ON referral_attributions (referred_phone_e164)
  WHERE referred_phone_e164 IS NOT NULL;

COMMENT ON TABLE referral_attributions IS 'Locked referral from Check 1 through Check 2 and booking milestones.';

-- ---------------------------------------------------------------------------
-- Public code requests (prospect asks operator for a code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_code_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_name VARCHAR(120),
  requester_email VARCHAR(255),
  requester_phone VARCHAR(32),
  message TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fulfilled', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_code_requests_operator
  ON referral_code_requests (operator_user_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Points ledger (all earn/spend/clawback)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('operator', 'client')),
  delta_pts INTEGER NOT NULL,
  balance_after_pts INTEGER NOT NULL CHECK (balance_after_pts >= 0),
  reason VARCHAR(64) NOT NULL,
  referral_attribution_id UUID REFERENCES referral_attributions(id) ON DELETE SET NULL,
  booking_id UUID,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_referral ON points_ledger (referral_attribution_id)
  WHERE referral_attribution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_points_ledger_booking ON points_ledger (booking_id)
  WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_ledger_idempotent
  ON points_ledger (user_id, reason, referral_attribution_id)
  WHERE referral_attribution_id IS NOT NULL
    AND reason IN ('referral_m1', 'referral_m2', 'referral_m2_clawback');

COMMENT ON TABLE points_ledger IS 'Immutable-ish points mutations; balance tables updated in same transaction.';

-- ---------------------------------------------------------------------------
-- Refer prompt dismissals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_prompt_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dismiss_count INTEGER NOT NULL DEFAULT 0 CHECK (dismiss_count >= 0),
  last_prompt_at TIMESTAMPTZ,
  last_dismiss_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional referral code captured on operator applications (Check 1 at apply / approve)
ALTER TABLE barber_applications
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(9);

ALTER TABLE guest_barber_applications
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(9);

-- ---------------------------------------------------------------------------
-- Active codes are created on demand via ensureActiveReferralCode() in app code.
-- ---------------------------------------------------------------------------
