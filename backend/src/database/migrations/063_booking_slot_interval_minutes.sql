-- Per-operator bookable start-time interval for clients (minutes).
-- Default 15 matches the previous hard-coded BOOKING_SLOT_INCREMENT_MINUTES.
-- After migration 037, base table is service_providers; barbers is a compatibility view.
-- Idempotent.

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
    RAISE NOTICE '063_booking_slot_interval_minutes: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS booking_slot_interval_minutes INTEGER NOT NULL DEFAULT 15',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.booking_slot_interval_minutes IS %L',
    base_table,
    'Minutes between bookable start times shown to clients. Allowed: 15, 30, 45.'
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
