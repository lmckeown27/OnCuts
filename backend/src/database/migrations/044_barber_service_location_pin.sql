-- Consolidated public service-location pin columns (idempotent).
-- Spec named this 032_barber_service_location_pin.sql; 032 is already used in this repo
-- (032_deactivate_haircut_fade_womens_cut.sql). Columns also exist via 035/042/043 —
-- this migration ensures all pin fields are present on the base table.
--
-- Adds / ensures:
--   service_location_label
--   service_location_source (device | manual | campus_default)
--   service_location_updated_at
--   service_location_web_only (default false)
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
    RAISE NOTICE '044_barber_service_location_pin: no base provider table found; skipping';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I
       ADD COLUMN IF NOT EXISTS service_location_label TEXT,
       ADD COLUMN IF NOT EXISTS service_location_source VARCHAR(32),
       ADD COLUMN IF NOT EXISTS service_location_updated_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS service_location_web_only BOOLEAN NOT NULL DEFAULT false',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.service_location_label IS %L',
    base_table,
    'Display label for public service area (city/region; prefer coarse for safety)'
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
  EXECUTE format(
    'COMMENT ON COLUMN %I.service_location_web_only IS %L',
    base_table,
    'When true, public pin is locked to manual/web; device GPS updates are ignored.'
  );

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

  IF base_table = 'service_providers'
     AND EXISTS (
       SELECT 1 FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'barbers'
     ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW barbers AS SELECT * FROM service_providers';
  END IF;
END $$;
