/**
 * @deprecated Campus FK is no longer used to organize operators or seed service pins.
 * Public discovery uses service_latitude/longitude from device or manual PlaceSearch.
 * Helpers kept only for any legacy one-off scripts; new code should not call these.
 */

/** @deprecated Do not seed operator pins from campus. */
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

/** @deprecated Do not seed operator pins from campus. */
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
