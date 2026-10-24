-- Remove unused Prisma location_aliases table.
-- Live aliases use campus_location_aliases.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.location_aliases') IS NOT NULL THEN
    DROP TABLE public.location_aliases CASCADE;
  END IF;
END $$;
