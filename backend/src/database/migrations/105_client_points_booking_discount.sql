-- Client can spend OnCuts Points at checkout for a service discount.
-- Stored on the booking so create-payment-intent / cash pay can reduce the charge.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS client_points_discount_pts INTEGER NOT NULL DEFAULT 0
    CHECK (client_points_discount_pts >= 0);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS client_points_discount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (client_points_discount_cents >= 0);

COMMENT ON COLUMN bookings.client_points_discount_pts IS
  'Client points spent for a checkout discount on this booking.';
COMMENT ON COLUMN bookings.client_points_discount_cents IS
  'Service discount in cents from client points (reduces amount charged).';
