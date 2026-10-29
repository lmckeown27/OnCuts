-- Admin-controlled Connect bypass for select operators (test without Express bank onboarding).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_bypass BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.stripe_connect_bypass IS
  'When true, operator UI treats Stripe Connect as fully onboarded without a real Express bank account. Admin toggle only.';

CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_bypass
  ON users (id)
  WHERE stripe_connect_bypass = TRUE;
