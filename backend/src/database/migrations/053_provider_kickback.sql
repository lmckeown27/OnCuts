-- Platform-funded provider kickback (percent of service amount).
-- After a successful card payment, Stripe Transfer from platform balance → Connect account.
-- Stacks with commission-free: e.g. $25 service + 10% kickback = $27.50 to provider.

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
    RAISE NOTICE '053_provider_kickback: no base provider table found; skipping provider columns';
    base_table := NULL;
  END IF;

  IF base_table IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE %I
         ADD COLUMN IF NOT EXISTS kickback_percent NUMERIC(5,2) NOT NULL DEFAULT 0',
      base_table
    );

    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      base_table,
      base_table || '_kickback_percent_check'
    );

    EXECUTE format(
      'ALTER TABLE %I
         ADD CONSTRAINT %I
         CHECK (kickback_percent >= 0 AND kickback_percent <= 100)',
      base_table,
      base_table || '_kickback_percent_check'
    );

    EXECUTE format(
      'COMMENT ON COLUMN %I.kickback_percent IS %L',
      base_table,
      'Platform-funded kickback percent of service amount, transferred from platform Stripe balance to the provider after successful card payment. 0 = disabled.'
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
  ADD COLUMN IF NOT EXISTS kickback_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS kickback_cents INTEGER,
  ADD COLUMN IF NOT EXISTS kickback_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS kickback_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kickback_transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kickback_error TEXT;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_kickback_status_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_kickback_status_check
  CHECK (kickback_status IN ('none', 'pending', 'transferred', 'failed'));

COMMENT ON COLUMN bookings.kickback_percent IS
  'Kickback percent stamped at payment success (snapshot of provider setting).';
COMMENT ON COLUMN bookings.kickback_cents IS
  'Platform-funded kickback amount in cents (service amount × percent).';
COMMENT ON COLUMN bookings.kickback_transfer_id IS
  'Stripe Transfer id for the platform → provider kickback.';
COMMENT ON COLUMN bookings.kickback_status IS
  'none | pending | transferred | failed';
