-- Track whether the public discovery pin came from iOS/device GPS, web manual place search,
-- or campus centroid seed. Device is primary; web PlaceSearch is backup.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS service_location_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS service_location_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN barbers.service_location_source IS
  'Origin of service_latitude/longitude: device | manual | campus_default';
COMMENT ON COLUMN barbers.service_location_updated_at IS
  'When the public service pin was last set or refreshed';

-- Existing pins were set via web PlaceSearch (or older APIs without a source).
UPDATE barbers
SET
  service_location_source = 'manual',
  service_location_updated_at = COALESCE(service_location_updated_at, "updatedAt", NOW())
WHERE service_latitude IS NOT NULL
  AND service_longitude IS NOT NULL
  AND service_location_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_barbers_service_location_source
  ON barbers(service_location_source)
  WHERE service_location_source IS NOT NULL;
