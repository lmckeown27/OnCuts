-- How far ahead consumers may book with an operator.
-- NULL is allowed and treated as the application default (30 days).
-- 0 is rejected; a positive integer is the window in days.
-- After migration 037, base table is service_providers; barbers is a compatibility view.
-- Idempotent.

DO $$
DECLARE
  base_table TEXT;
  constraint_name TEXT;
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
    RAISE NOTICE '070_max_advance_booking_days: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS max_advance_booking_days INTEGER DEFAULT 30',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.max_advance_booking_days IS %L',
    base_table,
    'Maximum days in the future a consumer may book. NULL falls back to 30 in application logic.'
  );

  constraint_name := base_table || '_max_advance_booking_days_check';
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = constraint_name
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (max_advance_booking_days IS NULL OR max_advance_booking_days > 0)',
      base_table,
      constraint_name
    );
  END IF;

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
