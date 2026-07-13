-- Opt-out of Operator iOS device location as the public pin source.
-- When true, web PlaceSearch is primary and device GPS updates are ignored.
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
    RAISE NOTICE '043_service_location_web_only: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS service_location_web_only BOOLEAN NOT NULL DEFAULT false',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.service_location_web_only IS %L',
    base_table,
    'When true, operator opted out of iOS device location; web manual pin is primary and device updates are ignored.'
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
