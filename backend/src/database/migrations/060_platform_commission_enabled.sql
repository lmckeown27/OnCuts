-- Global on/off for charging platform commission on card service payments.
-- When false, configured platform_fee_percent is preserved but effective fee is 0%.
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS platform_commission_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN platform_settings.platform_commission_enabled IS
  'When false, all card bookings take $0 platform fee (configured percent kept for when re-enabled). Does not consume per-operator free slots or set commission_free_applied.';
