/**
 * Great-circle distance helpers for location sanity checks.
 */

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Max allowed jump for source=device public pin updates.
 * Blocks intercontinental teleports (e.g. California → Beijing ~10,000 km)
 * while allowing long US travel (e.g. CA ↔ HI ~4,000 km).
 */
export const MAX_DEVICE_SERVICE_LOCATION_JUMP_KM = 5000;
