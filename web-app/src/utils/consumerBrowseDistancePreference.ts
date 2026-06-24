const MAX_DISTANCE_MILES_KEY = 'consumer.browse.maxDistanceMiles';
const CONSTRAIN_BY_DISTANCE_KEY = 'consumer.browse.constrainListByDistance';

export const BROWSE_MIN_DISTANCE_MILES = 1;
export const BROWSE_MAX_DISTANCE_MILES = 100;
export const BROWSE_DEFAULT_DISTANCE_MILES = 25;

export const BROWSE_DISTANCE_CHANGED_EVENT = 'campuscuts-browse-max-distance-changed';

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

export function milesToKmForBrowse(miles: number): number {
  return miles * 1.60934;
}

export function formatBarberDistanceFromUser(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles) || miles < 0) return null;
  if (miles < 0.5) return 'On campus';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}
