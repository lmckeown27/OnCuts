/**
 * Default service pin to the campus centroid when an admin-assigned campus has coords.
 * Campus is optional for providers; null campusId yields null lat/lng.
 * Requires campuses.latitude / campuses.longitude (see add_campus_coordinates.sql).
 *
 * When seeding from campus, also set service_location_source = 'campus_default'
 * (migration 042). Device GPS (source=device) is primary; web PlaceSearch is manual backup.
 */

/** Scalar subqueries for INSERT ... VALUES (..., lat, lng, source) — same param index for campus id. */
export function campusCoordsValueExprs(campusParamIndex: number): {
  lat: string;
  lng: string;
  source: string;
} {
  const p = `$${campusParamIndex}`;
  const campusLat = `(SELECT c.latitude FROM campuses c WHERE c.id = ${p} LIMIT 1)`;
  return {
    lat: campusLat,
    lng: `(SELECT c.longitude FROM campuses c WHERE c.id = ${p} LIMIT 1)`,
    source: `CASE WHEN ${campusLat} IS NOT NULL THEN 'campus_default' ELSE NULL END`,
  };
}

/** ON CONFLICT: keep an existing custom pin; otherwise copy from campus row. */
export const ON_CONFLICT_SERVICE_COORDS_FROM_CAMPUS = `
  service_latitude = COALESCE(barbers.service_latitude, (SELECT c.latitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1)),
  service_longitude = COALESCE(barbers.service_longitude, (SELECT c.longitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1)),
  service_location_source = CASE
    WHEN barbers.service_latitude IS NOT NULL THEN barbers.service_location_source
    WHEN (SELECT c.latitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1) IS NOT NULL
      THEN 'campus_default'
    ELSE barbers.service_location_source
  END,
  service_location_updated_at = CASE
    WHEN barbers.service_latitude IS NOT NULL THEN barbers.service_location_updated_at
    WHEN (SELECT c.latitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1) IS NOT NULL
      THEN NOW()
    ELSE barbers.service_location_updated_at
  END
`;
