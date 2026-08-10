-- Marketplace visibility separate from operator account status.
-- is_hidden: hide from consumer discovery (operators remain active).
-- isActive: demotion / account liveness (auth, payouts, messages).
-- Idempotent.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN barbers.is_hidden IS
  'When true, profile is hidden from consumer discovery/search. Does not demote the operator or clear isActive.';

-- Self-hidden operators previously flipped isActive=false while keeping BARBER role.
-- Restore operator status and mark them hidden instead.
UPDATE barbers b
SET is_hidden = true,
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP
FROM users u
WHERE b."userId" = u.id
  AND b."isActive" = false
  AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN');
