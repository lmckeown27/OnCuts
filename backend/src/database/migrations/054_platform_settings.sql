-- Global platform commission settings (singleton).
-- Admin-editable rate; default 15% matches prior hardcoded behavior.
-- Idempotent.

CREATE TABLE IF NOT EXISTS platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 15
    CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE platform_settings IS
  'Singleton platform config. platform_fee_percent is the global Stripe Connect commission on service amount.';

COMMENT ON COLUMN platform_settings.platform_fee_percent IS
  'Global platform commission percent (0–100) on service amount only; tips never commissioned.';

INSERT INTO platform_settings (id, platform_fee_percent)
VALUES (1, 15)
ON CONFLICT (id) DO NOTHING;
