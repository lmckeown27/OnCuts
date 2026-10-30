-- Operator can stage OnCuts Points on a booking while waiting for customer payment.
-- On payment settle, pending pts are spent and recorded as an applied kickback boost.
-- Idempotent.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS operator_points_pending_pts INTEGER NOT NULL DEFAULT 0
    CHECK (operator_points_pending_pts >= 0);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS operator_points_applied_pts INTEGER NOT NULL DEFAULT 0
    CHECK (operator_points_applied_pts >= 0);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS operator_points_boost_cents INTEGER NOT NULL DEFAULT 0
    CHECK (operator_points_boost_cents >= 0);

COMMENT ON COLUMN bookings.operator_points_pending_pts IS
  'Operator-selected points to spend for a payout kickback once the booking is paid.';
COMMENT ON COLUMN bookings.operator_points_applied_pts IS
  'Points actually spent for kickback after payment settled.';
COMMENT ON COLUMN bookings.operator_points_boost_cents IS
  'Payout boost in cents corresponding to applied operator points.';
