-- Clear deprecated campus org tags on operators.
-- Admin organization is by public service pin proximity to campuses, not campusId.
-- Idempotent — safe to re-run.
--
-- After migration 037, base table is service_providers; barbers is a compatibility view.

DO $$
DECLARE
  base_table TEXT;
BEGIN
  IF to_regclass('public.service_providers') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'service_providers'
         AND table_type = 'BASE TABLE'
     ) THEN
    base_table := 'service_providers';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'barbers'
      AND table_type = 'BASE TABLE'
  ) THEN
    base_table := 'barbers';
  ELSE
    RAISE NOTICE '045_clear_operator_campus_org: no base provider table found; skipping';
    RETURN;
  END IF;

  -- Null provider campusId (org tag deprecated)
  EXECUTE format(
    'UPDATE %I SET "campusId" = NULL WHERE "campusId" IS NOT NULL',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I."campusId" IS %L',
    base_table,
    'Deprecated for operator organization. Public location is service_latitude/longitude; admin campus scope uses pin proximity.'
  );

  -- Null users.campusId for accounts that have a provider profile (operators)
  EXECUTE format(
    'UPDATE users u
     SET "campusId" = NULL
     FROM %I sp
     WHERE sp."userId" = u.id
       AND u."campusId" IS NOT NULL',
    base_table
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
