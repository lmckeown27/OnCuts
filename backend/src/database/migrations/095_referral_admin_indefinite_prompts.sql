-- Admin Controls: indefinite referral prompts for admins on platform entry.
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS referral_admin_indefinite_prompts BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN platform_settings.referral_admin_indefinite_prompts IS
  'When true, admins see referral prompts on platform entry without cooldown or max-dismissal limits.';
