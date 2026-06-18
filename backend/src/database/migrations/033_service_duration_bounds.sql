-- Service duration bounds for campus manager / admin configuration
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS default_min_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS default_max_duration_minutes INT;

UPDATE services
SET
  default_min_duration_minutes = COALESCE(default_min_duration_minutes, 15),
  default_max_duration_minutes = COALESCE(default_max_duration_minutes, 240)
WHERE default_min_duration_minutes IS NULL OR default_max_duration_minutes IS NULL;

ALTER TABLE services
  ALTER COLUMN default_min_duration_minutes SET DEFAULT 15,
  ALTER COLUMN default_max_duration_minutes SET DEFAULT 240,
  ALTER COLUMN default_min_duration_minutes SET NOT NULL,
  ALTER COLUMN default_max_duration_minutes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_duration_bounds_valid'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT service_duration_bounds_valid CHECK (
        default_min_duration_minutes <= default_max_duration_minutes
      );
  END IF;
END $$;
