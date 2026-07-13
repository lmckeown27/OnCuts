/**
 * Admin campus scope: operators near a campus by public service pin,
 * not by users.campusId / barbers.campusId org tags.
 *
 * Default radius matches consumer browse (~8km / ~5 miles).
 */

export const ADMIN_CAMPUS_PROXIMITY_KM = 8;

/** Haversine distance (km) between campus centroid and barber service pin. */
export function servicePinDistanceToCampusSql(
  barberAlias = 'b',
  campusAlias = 'camp'
): string {
  return `(
    6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(${campusAlias}.latitude)) * cos(radians(${barberAlias}.service_latitude)) *
        cos(radians(${barberAlias}.service_longitude) - radians(${campusAlias}.longitude)) +
        sin(radians(${campusAlias}.latitude)) * sin(radians(${barberAlias}.service_latitude))
      ))
    )
  )`;
}

/**
 * True when barber Alias has a service pin within radiusKm of campus id param.
 * Example: WHERE ${barberNearCampusByPinSql('b', '$1')}
 */
export function barberNearCampusByPinSql(
  barberAlias = 'b',
  campusIdParam = '$1',
  radiusKm: number = ADMIN_CAMPUS_PROXIMITY_KM
): string {
  const dist = servicePinDistanceToCampusSql(barberAlias, 'camp');
  return `
    ${barberAlias}.service_latitude IS NOT NULL
    AND ${barberAlias}.service_longitude IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM campuses camp
      WHERE camp.id = ${campusIdParam}::uuid
        AND camp.latitude IS NOT NULL
        AND camp.longitude IS NOT NULL
        AND ${dist} <= ${radiusKm}
    )
  `;
}

/** Subquery: barber ids whose service pin is near the campus. */
export function barberIdsNearCampusSubquery(
  campusIdParam = '$1',
  radiusKm: number = ADMIN_CAMPUS_PROXIMITY_KM
): string {
  return `
    SELECT b.id FROM barbers b
    WHERE ${barberNearCampusByPinSql('b', campusIdParam, radiusKm)}
  `;
}
