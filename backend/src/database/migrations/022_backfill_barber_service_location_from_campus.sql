-- Backfill service_latitude / service_longitude from campus centroid for barbers
-- who have no custom pin yet. Requires campuses.latitude and campuses.longitude.
-- Safe to run multiple times (only fills NULL barber coords).

UPDATE barbers b
SET
  service_latitude = c.latitude,
  service_longitude = c.longitude,
  "updatedAt" = NOW()
FROM campuses c
WHERE c.id = b."campusId"
  AND c.latitude IS NOT NULL
  AND c.longitude IS NOT NULL
  AND b.service_latitude IS NULL
  AND b.service_longitude IS NULL;
