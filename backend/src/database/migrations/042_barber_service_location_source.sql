-- Track whether the public discovery pin came from iOS/device GPS, web manual place search,
-- or campus centroid seed. Device is primary; web PlaceSearch is backup.
--
-- After migration 037, the base table is service_providers and barbers is a compatibility view.
-- Alter the base table so the view picks up the new columns via SELECT *.

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
    RAISE NOTICE '042_barber_service_location_source: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS service_location_source VARCHAR(32),
       ADD COLUMN IF NOT EXISTS service_location_updated_at TIMESTAMPTZ',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.service_location_source IS %L',
    base_table,
    'Origin of service_latitude/longitude: device | manual | campus_default'
  );
  EXECUTE format(
    'COMMENT ON COLUMN %I.service_location_updated_at IS %L',
    base_table,
    'When the public service pin was last set or refreshed'
  );

  -- Existing pins were set via web PlaceSearch (or older APIs without a source).
  EXECUTE format(
    'UPDATE %I
     SET
       service_location_source = ''manual'',
       service_location_updated_at = COALESCE(service_location_updated_at, "updatedAt", NOW())
     WHERE service_latitude IS NOT NULL
       AND service_longitude IS NOT NULL
       AND service_location_source IS NULL',
    base_table
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (service_location_source)
     WHERE service_location_source IS NOT NULL',
    'idx_' || base_table || '_service_location_source',
    base_table
  );

  -- Refresh compatibility view so new columns are visible via barbers.*
  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
