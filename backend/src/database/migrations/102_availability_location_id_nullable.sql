-- Booking flow inserts availability rows without a locations catalog id
-- (see bookings-simple INSERT … "locationId" NULL after 087_drop_locations).
-- Re-apply nullable so prod DBs that missed 087’s ALTER still accept bookings.
-- Idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'availability'
      AND column_name = 'locationId'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE availability ALTER COLUMN "locationId" DROP NOT NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'availability'
      AND column_name = 'location_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE availability ALTER COLUMN location_id DROP NOT NULL;
  END IF;
END $$;
