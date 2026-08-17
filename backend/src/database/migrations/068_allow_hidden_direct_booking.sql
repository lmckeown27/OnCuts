-- When is_hidden=true, optionally still allow direct booking links.
-- Default false preserves current behavior (hidden = no public profile/book).
-- Idempotent. Handles service_providers base table + barbers view.

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
    RAISE NOTICE '068_allow_hidden_direct_booking: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS allow_hidden_direct_booking BOOLEAN NOT NULL DEFAULT false',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.allow_hidden_direct_booking IS %L',
    base_table,
    'When true and is_hidden=true, consumers with the operator booking link can still view/book. Discovery remains hidden. Default false = link also blocked while hidden.'
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
