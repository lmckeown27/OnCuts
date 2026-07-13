-- Tag catalog services as Barber or Beauty browse buckets, and ensure Beauty rows exist.
-- Depends on provider_types from 040_provider_types.sql.
-- Idempotent.

INSERT INTO provider_types (provider_type, label) VALUES
  ('barber', 'Barber'),
  ('beauty', 'Beauty')
ON CONFLICT (provider_type) DO UPDATE
  SET label = EXCLUDED.label;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'barber';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_provider_type_fkey'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_provider_type_fkey
      FOREIGN KEY (provider_type) REFERENCES provider_types(provider_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_services_provider_type ON services (provider_type);

COMMENT ON COLUMN services.provider_type IS
  'Browse bucket for this catalog service: barber or beauty (FK to provider_types).';

-- Backfill known beauty offerings (by slug or display name).
UPDATE services
SET provider_type = 'beauty',
    updated_at = NOW()
WHERE LOWER(regexp_replace(COALESCE(slug, ''), '[^a-z0-9]+', '', 'g')) IN (
        'braids', 'makeup', 'nails', 'lashes', 'tanning'
      )
   OR LOWER(regexp_replace(COALESCE(name, ''), '[^a-z0-9]+', '', 'g')) IN (
        'braids', 'makeup', 'nails', 'lashes', 'tanning'
      );

-- Ensure Beauty catalog rows exist (reactivate if previously soft-deleted).
DO $$
DECLARE
  has_duration BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'default_min_duration_minutes'
  ) INTO has_duration;

  IF has_duration THEN
    INSERT INTO services (
      slug,
      name,
      description,
      default_base_price_cents,
      default_min_price_cents,
      default_max_price_cents,
      default_min_duration_minutes,
      default_max_duration_minutes,
      is_active,
      provider_type
    )
    VALUES
      ('braids', 'Braids', 'Braiding and protective styles', 4500, 3600, 6750, 15, 240, true, 'beauty'),
      ('makeup', 'Makeup', 'Makeup application', 4000, 3200, 6000, 15, 240, true, 'beauty'),
      ('nails', 'Nails', 'Manicure, pedicure, nail art', 3500, 2800, 5250, 15, 240, true, 'beauty'),
      ('lashes', 'Lashes', 'Lash extensions and lifts', 4000, 3200, 6000, 15, 240, true, 'beauty'),
      ('tanning', 'Tanning', 'Spray tan / tanning services', 3000, 2400, 4500, 15, 240, true, 'beauty')
    ON CONFLICT (slug) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = COALESCE(services.description, EXCLUDED.description),
      provider_type = 'beauty',
      is_active = true,
      updated_at = NOW();
  ELSE
    INSERT INTO services (
      slug,
      name,
      description,
      default_base_price_cents,
      default_min_price_cents,
      default_max_price_cents,
      is_active,
      provider_type
    )
    VALUES
      ('braids', 'Braids', 'Braiding and protective styles', 4500, 3600, 6750, true, 'beauty'),
      ('makeup', 'Makeup', 'Makeup application', 4000, 3200, 6000, true, 'beauty'),
      ('nails', 'Nails', 'Manicure, pedicure, nail art', 3500, 2800, 5250, true, 'beauty'),
      ('lashes', 'Lashes', 'Lash extensions and lifts', 4000, 3200, 6000, true, 'beauty'),
      ('tanning', 'Tanning', 'Spray tan / tanning services', 3000, 2400, 4500, true, 'beauty')
    ON CONFLICT (slug) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = COALESCE(services.description, EXCLUDED.description),
      provider_type = 'beauty',
      is_active = true,
      updated_at = NOW();
  END IF;
END $$;
