-- Migration: Track Stripe Instant Payout attempts on payments
-- Soft-fail Instant after Connect charges; supportability for ops.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS instant_payout_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instant_payout_status VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_payments_instant_payout_id
  ON payments(instant_payout_id)
  WHERE instant_payout_id IS NOT NULL;

COMMENT ON COLUMN payments.instant_payout_id IS 'Stripe Instant Payout id (po_xxx) when method=instant succeeded';
COMMENT ON COLUMN payments.instant_payout_status IS 'instant | skipped | failed — outcome of auto Instant attempt';
