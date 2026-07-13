-- Backfill paymentMethod = 'card' for settled bookings that never stamped a method
-- (typical of Stripe webhook paths that left paymentMethod NULL).
-- Explicit cash rows are left alone.
-- Idempotent.

UPDATE bookings
SET "paymentMethod" = 'card',
    "updatedAt" = NOW()
WHERE "paymentMethod" IS NULL
  AND (
    "paidAt" IS NOT NULL
    OR paid_at IS NOT NULL
    OR COALESCE("totalPaidCents", 0) > 0
  );
