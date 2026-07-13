-- Per-provider commission controls for admins:
--   platform_fee_percent              — override (NULL = platform default 15%)
--   commission_free_bookings_remaining — card bookings with $0 platform fee
-- bookings.commission_free_applied     — reserved free slot for this booking
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
    RAISE NOTICE '046_provider_commission_controls: no base provider table found; skipping provider columns';
    base_table := NULL;
  END IF;

  IF base_table IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2),
         ADD COLUMN IF NOT EXISTS commission_free_bookings_remaining INTEGER NOT NULL DEFAULT 5',
      base_table
    );

    EXECUTE format(
      'ALTER TABLE %I
         DROP CONSTRAINT IF EXISTS %I',
      base_table,
      base_table || '_platform_fee_percent_check'
    );

    EXECUTE format(
      'ALTER TABLE %I
         ADD CONSTRAINT %I
         CHECK (platform_fee_percent IS NULL OR (platform_fee_percent >= 0 AND platform_fee_percent <= 100))',
      base_table,
      base_table || '_platform_fee_percent_check'
    );

    EXECUTE format(
      'ALTER TABLE %I
         DROP CONSTRAINT IF EXISTS %I',
      base_table,
      base_table || '_commission_free_bookings_remaining_check'
    );

    EXECUTE format(
      'ALTER TABLE %I
         ADD CONSTRAINT %I
         CHECK (commission_free_bookings_remaining >= 0)',
      base_table,
      base_table || '_commission_free_bookings_remaining_check'
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.platform_fee_percent IS %L',
      base_table,
      'Admin override for platform commission percent on service amount. NULL = default 15%%.'
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.commission_free_bookings_remaining IS %L',
      base_table,
      'Number of remaining card bookings with $0 platform commission. Defaults to 5 for every provider; admin can adjust.'
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

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_free_applied BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN bookings.commission_free_applied IS
  'True when a commission-free quota slot was reserved for this booking at payment-intent creation.';
