-- Count vs timeframe commission incentives for providers.
-- timeframe: unlimited commissionless bookings (+ kickback) until expires_at.
-- count: existing commission_free_bookings_remaining quota (kickback still only on free bookings).

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
    RAISE NOTICE '059_commission_incentive_window: no base provider table found; skipping';
    base_table := NULL;
  END IF;

  IF base_table IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS commission_incentive_mode VARCHAR(20) NOT NULL DEFAULT ''count'',
         ADD COLUMN IF NOT EXISTS commission_incentive_expires_at TIMESTAMPTZ',
      base_table
    );

    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      base_table,
      base_table || '_commission_incentive_mode_check'
    );

    EXECUTE format(
      'ALTER TABLE %I
         ADD CONSTRAINT %I
         CHECK (commission_incentive_mode IN (''count'', ''timeframe''))',
      base_table,
      base_table || '_commission_incentive_mode_check'
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.commission_incentive_mode IS %L',
      base_table,
      'count = use commission_free_bookings_remaining; timeframe = unlimited commissionless until commission_incentive_expires_at'
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.commission_incentive_expires_at IS %L',
      base_table,
      'When mode=timeframe, commissionless (+ kickback) ends at this timestamp. NULL when mode=count.'
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
