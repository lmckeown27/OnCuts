-- Campus is admin-organization only for service providers.
-- Providers are not required to have a campus to practice; admins may assign later.
-- Idempotent — safe if columns are already nullable.

ALTER TABLE barbers
  ALTER COLUMN "campusId" DROP NOT NULL;

COMMENT ON COLUMN barbers."campusId" IS
  'Optional admin organization tag when provider is near a campus. Not set by the provider.';

ALTER TABLE users
  ALTER COLUMN "campusId" DROP NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.guest_barber_applications') IS NOT NULL THEN
    ALTER TABLE guest_barber_applications
      ALTER COLUMN campus_id DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN users."campusId" IS
  'Optional campus affiliation. Consumers may be unset; providers are organized by admins, not by self-selection.';
