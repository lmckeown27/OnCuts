-- Clear any per-provider commission rate overrides.
-- Platform fee is hardcoded at 15%; admins only control commission-free booking quotas.

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
    RAISE NOTICE '050_clear_provider_fee_overrides: no base provider table found; skipping';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = base_table
      AND column_name = 'platform_fee_percent'
  ) THEN
    EXECUTE format(
      'UPDATE %I SET platform_fee_percent = NULL, "updatedAt" = NOW() WHERE platform_fee_percent IS NOT NULL',
      base_table
    );
    EXECUTE format(
      'COMMENT ON COLUMN %I.platform_fee_percent IS %L',
      base_table,
      'Unused. Platform commission rate is hardcoded at 15%; admins only set commission_free_bookings_remaining.'
    );
  END IF;
END $$;
