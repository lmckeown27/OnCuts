-- Consumer-proposed schedule changes require provider approval before applying.

CREATE TABLE IF NOT EXISTS booking_reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_time TIMESTAMPTZ NOT NULL,
  location VARCHAR(255),
  location_details TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_reschedule_requests_one_pending
  ON booking_reschedule_requests (booking_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_booking_reschedule_requests_booking_id
  ON booking_reschedule_requests (booking_id);

COMMENT ON TABLE booking_reschedule_requests IS
  'Pending schedule change requests from consumers; applied only after provider approval';
