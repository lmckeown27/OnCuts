-- Allow demoted (inactive) providers to be cleared for a fresh application flow.
-- When reapply_allowed_at is set and isActive is false, the demotion modal is skipped
-- and the user may submit a new barber application.
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
    RAISE NOTICE '058_barber_reapply_allowed: no base provider table found; skipping';
    base_table := NULL;
  END IF;

  IF base_table IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS reapply_allowed_at TIMESTAMPTZ NULL',
      base_table
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.reapply_allowed_at IS %L',
      base_table,
      'When set while isActive=false, Admin has cleared demotion so the user may reapply.'
    );

    IF base_table = 'service_providers'
       AND EXISTS (
         SELECT 1 FROM pg_views
         WHERE schemaname = 'public' AND viewname = 'barbers'
       ) THEN
      EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
    END IF;
  END IF;
END $$;
