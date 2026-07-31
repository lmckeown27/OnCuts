-- Backfill missing camelCase "paidAt" from snake_case paid_at (or settlement proxies).
-- iOS Paid lists prefer paidAt and fall back to scheduled time when null.
-- Idempotent.

-- Prefer paid_at when present; otherwise use completedAt / updatedAt for settled rows.
UPDATE bookings
SET "paidAt" = COALESCE("paidAt", paid_at, "completedAt", "updatedAt"),
    "updatedAt" = NOW()
WHERE "paidAt" IS NULL
  AND (
    paid_at IS NOT NULL
    OR COALESCE("totalPaidCents", 0) > 0
    OR status = 'PAID'
  );

-- Keep snake_case in sync for any writers that only stamped "paidAt".
UPDATE bookings
SET paid_at = COALESCE(paid_at, "paidAt"),
    "updatedAt" = NOW()
WHERE paid_at IS NULL
  AND "paidAt" IS NOT NULL;
