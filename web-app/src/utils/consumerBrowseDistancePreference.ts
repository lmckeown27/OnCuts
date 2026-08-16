const MAX_DISTANCE_MILES_KEY = 'consumer.browse.maxDistanceMiles';
const CONSTRAIN_BY_DISTANCE_KEY = 'consumer.browse.constrainListByDistance';
const DEVICE_TRACKING_KEY = 'consumer.browse.deviceTracking';

export const BROWSE_MIN_DISTANCE_MILES = 1;
export const BROWSE_MAX_DISTANCE_MILES = 100;
export const BROWSE_DEFAULT_DISTANCE_MILES = 25;

export const BROWSE_DISTANCE_CHANGED_EVENT = 'oncuts-browse-max-distance-changed';

function clampMiles(miles: number): number {
  return Math.min(BROWSE_MAX_DISTANCE_MILES, Math.max(BROWSE_MIN_DISTANCE_MILES, miles));
}

export function getBrowseMaxDistanceMiles(): number {
  try {
    const raw = localStorage.getItem(MAX_DISTANCE_MILES_KEY);
    if (raw == null) return BROWSE_DEFAULT_DISTANCE_MILES;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampMiles(parsed) : BROWSE_DEFAULT_DISTANCE_MILES;
  } catch {
    return BROWSE_DEFAULT_DISTANCE_MILES;
  }
}

export function setBrowseMaxDistanceMiles(miles: number): void {
  const clamped = clampMiles(Math.round(miles));
  localStorage.setItem(MAX_DISTANCE_MILES_KEY, String(clamped));
  window.dispatchEvent(new CustomEvent(BROWSE_DISTANCE_CHANGED_EVENT, { detail: clamped }));
}

export function getBrowseConstrainByDistance(): boolean {
  try {
    const raw = localStorage.getItem(CONSTRAIN_BY_DISTANCE_KEY);
    if (raw == null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setBrowseConstrainByDistance(enabled: boolean): void {
  localStorage.setItem(CONSTRAIN_BY_DISTANCE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(BROWSE_DISTANCE_CHANGED_EVENT));
}

/** When true, browse center uses device GPS; when false, manual place/town. */
export function getBrowseDeviceTracking(): boolean {
  try {
    const raw = localStorage.getItem(DEVICE_TRACKING_KEY);
    if (raw == null) {
      // Web browse defaults off (no GPS prompt). iOS /app keeps the on default.
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/web')) {
        return false;
      }
      return true;
    }
    return raw !== 'false';
  } catch {
    return typeof window !== 'undefined' && !window.location.pathname.startsWith('/web');
  }
}

export function setBrowseDeviceTracking(enabled: boolean): void {
  localStorage.setItem(DEVICE_TRACKING_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(BROWSE_DISTANCE_CHANGED_EVENT));
}

/** Consumer-home QR uses `?tracking=off` so GPS is not requested on entry. */
export function isTrackingOffQuery(search: string): boolean {
  const raw = new URLSearchParams(search).get('tracking');
  return raw === 'off' || raw === '0' || raw === 'false';
}

export function milesToKmForBrowse(miles: number): number {
  return miles * 1.60934;
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

type BarberDistanceSource = {
  distance_miles?: number | null;
  distance_km?: number | null;
  service_latitude?: number | null;
  service_longitude?: number | null;
};

/** Distance from college-town search center to barber's public service pin (miles). */
export function getBarberDistanceMilesFromTown(
  barber: BarberDistanceSource,
  townLatitude: number | null | undefined,
  townLongitude: number | null | undefined,
): number | null {
  if (barber.distance_miles != null && Number.isFinite(barber.distance_miles)) {
    return barber.distance_miles;
  }
  if (barber.distance_km != null && Number.isFinite(barber.distance_km)) {
    return kmToMiles(barber.distance_km);
  }
  if (
    townLatitude == null ||
    townLongitude == null ||
    barber.service_latitude == null ||
    barber.service_longitude == null
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = ((barber.service_latitude - townLatitude) * Math.PI) / 180;
  const dLng = ((barber.service_longitude - townLongitude) * Math.PI) / 180;
  const lat1 = (townLatitude * Math.PI) / 180;
  const lat2 = (barber.service_latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return kmToMiles(earthRadiusKm * c);
}

export function formatBarberDistanceFromUser(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles) || miles < 0) return null;
  if (miles < 0.5) return 'Very close';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}
