-- Per-operator client cancel full-refund window (hours before appointment).
-- Default 1 matches the previous hard-coded policy.
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
    RAISE NOTICE '062_client_cancel_refund_hours: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS client_cancel_refund_hours INTEGER NOT NULL DEFAULT 1',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.client_cancel_refund_hours IS %L',
    base_table,
    'Hours before appointment: client cancel at or beyond this window gets a full refund; within the window is non-refundable. Allowed: 1,2,4,6,12,24.'
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
