-- Lookup table for marketplace provider kinds (browse buckets: barber | beauty).
-- Idempotent — safe if 036 already added barbers.provider_type / service_providers.provider_type.

CREATE TABLE IF NOT EXISTS provider_types (
  provider_type TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO provider_types (provider_type, label) VALUES
  ('barber', 'Barber'),
  ('beauty', 'Beauty')
ON CONFLICT (provider_type) DO UPDATE
  SET label = EXCLUDED.label;

COMMENT ON TABLE provider_types IS
  'Allowed marketplace provider kinds used for browse filters (barber, beauty).';

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
    RAISE NOTICE '040_provider_types: no base provider table found; skipping column/FK';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT ''barber''',
    base_table
  );

  EXECUTE format(
    'UPDATE %I SET provider_type = ''barber'' WHERE provider_type IS NULL',
    base_table
  );

  -- Normalize any legacy fine-grained values to browse buckets before FK.
  EXECUTE format(
    'UPDATE %I SET provider_type = ''beauty''
     WHERE LOWER(provider_type) IN (''beauty'', ''braids'', ''makeup'', ''nails'', ''lashes'', ''esthetics'')',
    base_table
  );
  EXECUTE format(
    'UPDATE %I SET provider_type = ''barber''
     WHERE provider_type IS DISTINCT FROM ''beauty''
       AND provider_type IS DISTINCT FROM ''barber''',
    base_table
  );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = base_table || '_provider_type_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I
         ADD CONSTRAINT %I
         FOREIGN KEY (provider_type) REFERENCES provider_types(provider_type)',
      base_table,
      base_table || '_provider_type_fkey'
    );
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (provider_type)',
    'idx_' || base_table || '_provider_type',
    base_table
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.provider_type IS %L',
    base_table,
    'Marketplace provider kind: barber or beauty (browse buckets). FK to provider_types.'
  );
END $$;
