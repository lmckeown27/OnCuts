-- Admin Controls: show or hide OnCuts Points in the client/operator UI.
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS points_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN platform_settings.points_visible IS
  'When false, hide points balance, rewards surfaces, and checkout/payout points spend UI.';
