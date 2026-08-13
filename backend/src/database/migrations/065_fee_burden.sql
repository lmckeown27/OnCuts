-- Who pays the platform take: operator (deducted from listed price) or client
-- (Service Fee added on top; operator keeps 100% of listed service).
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS fee_burden TEXT NOT NULL DEFAULT 'operator';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_settings_fee_burden_check'
  ) THEN
    ALTER TABLE platform_settings
      ADD CONSTRAINT platform_settings_fee_burden_check
      CHECK (fee_burden IN ('operator', 'client'));
  END IF;
END $$;

COMMENT ON COLUMN platform_settings.fee_burden IS
  'operator: platform commission deducted from listed service. client: Service Fee of platform_fee_percent added to client checkout; operator receives listed service in full.';
