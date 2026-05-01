-- Apple-only accounts can set a known password later (PUT .../me/set-initial-password).
-- Existing rows with apple_sub start as needing a password until they set one.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_platform_password BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.has_platform_password IS 'False until user sets a chosen password (e.g. Sign in with Apple random hash); enables email/password login after set-initial-password';

UPDATE users
SET has_platform_password = FALSE
WHERE apple_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_has_platform_password ON users (has_platform_password)
  WHERE has_platform_password = FALSE;
