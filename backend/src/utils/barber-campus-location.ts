/**
 * Default barber service pin to the campus centroid when they join vian OnCuts.
 * Requires campuses.latitude / campuses.longitude (see add_campus_coordinates.sql).
 */

/** Scalar subqueries for INSERT ... VALUES (..., lat, lng) — same param index for campus id. */
export function campusCoordsValueExprs(campusParamIndex: number): { lat: string; lng: string } {
  const p = `$${campusParamIndex}`;
  return {
    lat: `(SELECT c.latitude FROM campuses c WHERE c.id = ${p} LIMIT 1)`,
    lng: `(SELECT c.longitude FROM campuses c WHERE c.id = ${p} LIMIT 1)`,
  };
}

/** ON CONFLICT: keep an existing custom pin; otherwise copy from campus row. */
export const ON_CONFLICT_SERVICE_COORDS_FROM_CAMPUS = `
  service_latitude = COALESCE(barbers.service_latitude, (SELECT c.latitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1)),
  service_longitude = COALESCE(barbers.service_longitude, (SELECT c.longitude FROM campuses c WHERE c.id = EXCLUDED."campusId" LIMIT 1))
`;
