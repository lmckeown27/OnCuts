-- Default every service provider to 5 commission-free card bookings.
-- Existing providers (legacy default 0) are granted 5 as well.
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
    RAISE NOTICE '049_default_commission_free_bookings: no base provider table found; skipping';
    RETURN;
  END IF;

  -- Ensure column exists (safe if 046 not yet applied)
  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS commission_free_bookings_remaining INTEGER NOT NULL DEFAULT 5',
    base_table
  );

  EXECUTE format(
    'ALTER TABLE %I
       ALTER COLUMN commission_free_bookings_remaining SET DEFAULT 5',
    base_table
  );

  -- Grant 5 to providers who still have the legacy 0 default (pre-feature signups).
  -- Leave non-zero values alone (admin overrides or already partially used quotas).
  EXECUTE format(
    'UPDATE %I
     SET commission_free_bookings_remaining = 5,
         "updatedAt" = NOW()
     WHERE commission_free_bookings_remaining = 0',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.commission_free_bookings_remaining IS %L',
    base_table,
    'Remaining card bookings with $0 platform commission. New providers default to 5; admin can adjust.'
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
