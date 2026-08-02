-- Tip request / decision timestamps for pay-on-accept + tip-on-complete flow.
-- Idempotent.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "tipRequestedAt" TIMESTAMPTZ NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "tipDecidedAt" TIMESTAMPTZ NULL;

COMMENT ON COLUMN bookings."tipRequestedAt" IS
  'When barber marked service complete and tip decision was requested from consumer';

COMMENT ON COLUMN bookings."tipDecidedAt" IS
  'When consumer submitted tip amount (including $0); tip flow finished';

CREATE INDEX IF NOT EXISTS idx_bookings_tip_decided_at
  ON bookings ("tipDecidedAt")
  WHERE "tipDecidedAt" IS NULL AND status = 'COMPLETED';
