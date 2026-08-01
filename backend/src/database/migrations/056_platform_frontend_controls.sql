-- Frontend controls on singleton platform_settings (Admin Controls tab).
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS cash_payment_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS consumer_home_mode TEXT NOT NULL DEFAULT 'providers';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_consumer_home_mode_check'
  ) THEN
    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_consumer_home_mode_check
      CHECK (consumer_home_mode IN ('providers', 'waitlist'));
  END IF;
END $$;

COMMENT ON COLUMN platform_settings.cash_payment_enabled IS
  'When true, consumers may pay with cash in web payment UIs.';

COMMENT ON COLUMN platform_settings.consumer_home_mode IS
  'Consumer home: providers (barber cards) or waitlist (show consumer count).';
