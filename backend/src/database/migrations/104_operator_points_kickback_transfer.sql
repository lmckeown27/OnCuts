-- Track Stripe Transfer for operator points kickback boost
-- (same platform → Connect path as provider % kickback).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS operator_points_kickback_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS operator_points_kickback_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS operator_points_kickback_transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_points_kickback_error TEXT;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_operator_points_kickback_status_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_operator_points_kickback_status_check
  CHECK (operator_points_kickback_status IN ('none', 'pending', 'transferred', 'failed'));

COMMENT ON COLUMN bookings.operator_points_kickback_transfer_id IS
  'Stripe Transfer id for operator points kickback boost (platform → Connect).';
COMMENT ON COLUMN bookings.operator_points_kickback_status IS
  'none | pending | transferred | failed — Stripe transfer state for points kickback.';
COMMENT ON COLUMN bookings.operator_points_kickback_transferred_at IS
  'When the operator points kickback Transfer succeeded.';
COMMENT ON COLUMN bookings.operator_points_kickback_error IS
  'Last error if operator points kickback Transfer failed.';
