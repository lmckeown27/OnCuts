-- Payment timing mode on singleton platform_settings (Admin Controls tab).
-- on_accept = pay service after accept, tip after complete (current default).
-- after_complete = pay service (+ optional tip) after operator marks complete (legacy).
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS payment_timing_mode TEXT NOT NULL DEFAULT 'on_accept';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_payment_timing_mode_check'
  ) THEN
    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_payment_timing_mode_check
      CHECK (payment_timing_mode IN ('on_accept', 'after_complete'));
  END IF;
END $$;

COMMENT ON COLUMN platform_settings.payment_timing_mode IS
  'on_accept: charge service when booking is accepted; after_complete: charge after operator marks complete.';
