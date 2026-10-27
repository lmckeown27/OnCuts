-- One-time complimentary admin welcome points claim (100 pts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_ledger_admin_welcome_claim
  ON points_ledger (user_id)
  WHERE reason = 'admin_welcome_claim';

COMMENT ON INDEX idx_points_ledger_admin_welcome_claim IS
  'Ensures each user can claim the admin welcome 100 pts at most once.';
