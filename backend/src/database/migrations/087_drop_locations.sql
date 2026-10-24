-- Remove unused Prisma locations catalog.
-- Live campus places use campus_locations.
-- availability."locationId" becomes nullable (booking flow no longer needs a stub location).
-- Idempotent.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname AS cname, rel.relname AS tname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND ref.relname = 'locations'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tname, r.cname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'availability' AND column_name = 'locationId'
  ) THEN
    ALTER TABLE availability ALTER COLUMN "locationId" DROP NOT NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'availability' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE availability ALTER COLUMN location_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.locations') IS NOT NULL THEN
    DROP TABLE public.locations CASCADE;
  END IF;
END $$;

DROP TYPE IF EXISTS "LocationType" CASCADE;
DROP TYPE IF EXISTS "LocationCohort" CASCADE;
