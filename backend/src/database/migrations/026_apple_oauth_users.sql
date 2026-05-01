-- Sign in with Apple: stable subject + provider for OAuth-only accounts.
-- Run on production Postgres before enabling POST /api/v1/auth/apple.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS apple_sub VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32);

COMMENT ON COLUMN users.apple_sub IS 'Apple Sign In subject (sub); unique when set';
COMMENT ON COLUMN users.auth_provider IS 'Primary credential source: apple, google, email, phone, etc.';

CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub_unique
  ON users (apple_sub)
  WHERE apple_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users (auth_provider);
