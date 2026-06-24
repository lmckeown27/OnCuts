-- Phase 5: canonical persistence table is service_providers; barbers remains a compatibility view.
-- Idempotent — safe to run on databases that already applied earlier provider migrations.

DO $$
BEGIN
  IF to_regclass('public.service_providers') IS NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'barbers'
         AND table_type = 'BASE TABLE'
     ) THEN
    ALTER TABLE barbers RENAME TO service_providers;
  END IF;

  IF to_regclass('public.barbers') IS NULL
     AND to_regclass('public.service_providers') IS NOT NULL THEN
    EXECUTE 'CREATE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;

COMMENT ON TABLE service_providers IS
  'Marketplace service provider profiles (haircuts, beauty, wellness, fitness). Formerly barbers.';

DO $$
BEGIN
  IF to_regclass('public.barbers') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE $comment$COMMENT ON VIEW barbers IS
      'Backward-compatibility view over service_providers. Prefer service_providers in new SQL.'$comment$;
  END IF;
END $$;
