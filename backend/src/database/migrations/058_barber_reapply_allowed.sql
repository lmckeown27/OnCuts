-- Allow demoted (inactive) providers to be cleared for a fresh application flow.
-- When reapply_allowed_at is set and isActive is false, the demotion modal is skipped
-- and the user may submit a new barber application.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS reapply_allowed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN barbers.reapply_allowed_at IS
  'When set while isActive=false, Admin has cleared demotion so the user may reapply.';
