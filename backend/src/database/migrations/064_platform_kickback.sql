-- Global provider kickback % (Admin Controls → Price).
-- Applied after commissionless card payments; 0 = disabled.
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS kickback_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (kickback_percent >= 0 AND kickback_percent <= 100);

COMMENT ON COLUMN platform_settings.kickback_percent IS
  'Global platform-funded kickback percent of service amount (0–100). Used when a provider has no per-operator override. Only paid on commissionless card bookings.';
