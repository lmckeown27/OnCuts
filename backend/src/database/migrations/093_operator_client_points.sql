-- OnCuts Points balance accounts (one row per user).
-- Malleable foundation for referral earn/spend; no seed rows.
-- Idempotent.

CREATE TABLE IF NOT EXISTS operator_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_pts INTEGER NOT NULL DEFAULT 0 CHECK (balance_pts >= 0),
  lifetime_earned_pts INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned_pts >= 0),
  lifetime_spent_pts INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spent_pts >= 0),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_points_user_id ON operator_points (user_id);
CREATE INDEX IF NOT EXISTS idx_operator_points_balance ON operator_points (balance_pts DESC);
CREATE INDEX IF NOT EXISTS idx_operator_points_updated ON operator_points (updated_at DESC);

COMMENT ON TABLE operator_points IS 'Operator OnCuts Points balance account (referral rewards / kickback apply).';
COMMENT ON COLUMN operator_points.meta IS 'Loose JSON for holds, flags, program version, etc.';

CREATE TABLE IF NOT EXISTS client_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_pts INTEGER NOT NULL DEFAULT 0 CHECK (balance_pts >= 0),
  lifetime_earned_pts INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned_pts >= 0),
  lifetime_spent_pts INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spent_pts >= 0),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_points_user_id ON client_points (user_id);
CREATE INDEX IF NOT EXISTS idx_client_points_balance ON client_points (balance_pts DESC);
CREATE INDEX IF NOT EXISTS idx_client_points_updated ON client_points (updated_at DESC);

COMMENT ON TABLE client_points IS 'Client OnCuts Points balance account (referral rewards / checkout discounts).';
COMMENT ON COLUMN client_points.meta IS 'Loose JSON for holds, flags, program version, etc.';
