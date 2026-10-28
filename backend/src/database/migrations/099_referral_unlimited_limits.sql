-- Allow 0 on referral timeframe / rate-limit knobs (0 = unlimited in app logic).
-- Prior CHECKs required > 0 and blocked saving Unlimited from admin Settings.

ALTER TABLE platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_referral_qualify_window_days_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_code_rotations_per_day_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_code_max_uses_per_month_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_validate_max_attempts_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_validate_lockout_hours_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_prompt_cooldown_days_check,
  DROP CONSTRAINT IF EXISTS platform_settings_referral_prompt_max_dismissals_check;

ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_referral_qualify_window_days_check
    CHECK (referral_qualify_window_days >= 0),
  ADD CONSTRAINT platform_settings_referral_code_rotations_per_day_check
    CHECK (referral_code_rotations_per_day >= 0),
  ADD CONSTRAINT platform_settings_referral_code_max_uses_per_month_check
    CHECK (referral_code_max_uses_per_month >= 0),
  ADD CONSTRAINT platform_settings_referral_validate_max_attempts_check
    CHECK (referral_validate_max_attempts >= 0),
  ADD CONSTRAINT platform_settings_referral_validate_lockout_hours_check
    CHECK (referral_validate_lockout_hours >= 0),
  ADD CONSTRAINT platform_settings_referral_prompt_cooldown_days_check
    CHECK (referral_prompt_cooldown_days >= 0),
  ADD CONSTRAINT platform_settings_referral_prompt_max_dismissals_check
    CHECK (referral_prompt_max_dismissals >= 0);

COMMENT ON COLUMN platform_settings.referral_qualify_window_days IS
  'Days after Check 2 that bookings count toward M2; 0 = unlimited.';
COMMENT ON COLUMN platform_settings.referral_code_rotations_per_day IS
  'Max code rotations per calendar day; 0 = unlimited.';
COMMENT ON COLUMN platform_settings.referral_code_max_uses_per_month IS
  'Max successful attributions per code per calendar month; 0 = unlimited.';
COMMENT ON COLUMN platform_settings.referral_validate_max_attempts IS
  'Failed validate attempts before lockout; 0 = unlimited.';
COMMENT ON COLUMN platform_settings.referral_validate_lockout_hours IS
  'Hours locked after max failed validates; 0 = no lockout.';
COMMENT ON COLUMN platform_settings.referral_prompt_cooldown_days IS
  'Days between referral prompts; 0 = no cooldown.';
COMMENT ON COLUMN platform_settings.referral_prompt_max_dismissals IS
  'Dismissals before prompts stop; 0 = unlimited.';
