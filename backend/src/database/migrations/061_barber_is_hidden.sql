-- Marketplace visibility separate from operator account status.
-- is_hidden: hide from consumer discovery (operators remain active).
-- isActive: demotion / account liveness (auth, payouts, messages).
-- After migration 037, the base table is service_providers and barbers is a compatibility view.
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
    RAISE NOTICE '061_barber_is_hidden: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.is_hidden IS %L',
    base_table,
    'When true, profile is hidden from consumer discovery/search. Does not demote the operator or clear isActive.'
  );

  -- Self-hidden operators previously flipped isActive=false while keeping BARBER role.
  -- Restore operator status and mark them hidden instead.
  EXECUTE format(
    'UPDATE %I b
     SET is_hidden = true,
         "isActive" = true,
         "updatedAt" = CURRENT_TIMESTAMP
     FROM users u
     WHERE b."userId" = u.id
       AND b."isActive" = false
       AND u.role IN (''BARBER'', ''CAMPUS_MANAGER'', ''ADMIN'')',
    base_table
  );

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
