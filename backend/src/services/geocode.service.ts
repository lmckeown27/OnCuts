/**
 * OpenStreetMap Nominatim geocoding (server-side proxy).
 * https://operations.osmfoundation.org/policies/nominatim/
 */

import { logger } from '../utils/logger';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CampusCuts/1.0 (https://campuscut.com; barber service location)';

export interface GeocodePlace {
  label: string;
  latitude: number;
  longitude: number;
  placeType?: string;
}

function formatShortLabel(item: Record<string, unknown>): string {
  const address = item.address as Record<string, string> | undefined;
  if (address) {
    const parts: string[] = [];
    const name =
      address.university ||
      address.college ||
      address.building ||
      address.amenity ||
      address.road ||
      address.neighbourhood ||
      address.suburb;
    if (name) parts.push(name);
    const city = address.city || address.town || address.village || address.county;
    if (city && !parts.includes(city)) parts.push(city);
    const state = address.state;
    if (state) parts.push(state);
    if (parts.length > 0) return parts.join(', ');
  }
  const display = String(item.display_name || '');
  const segments = display.split(',').map((s) => s.trim()).filter(Boolean);
  return segments.slice(0, 3).join(', ') || display;
}

async function nominatimFetch(path: string): Promise<unknown> {
  const url = `${NOMINATIM_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    logger.warn('Nominatim request failed', { path, status: response.status });
    throw new Error('Geocoding service unavailable');
  }

  return response.json();
}

export async function searchPlaces(query: string, limit = 8): Promise<GeocodePlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: String(Math.min(limit, 10)),
    addressdetails: '1',
    countrycodes: 'us',
  });

  const data = (await nominatimFetch(`/search?${params.toString()}`)) as Record<string, unknown>[];
  if (!Array.isArray(data)) return [];

  return data
    .map((item): GeocodePlace | null => {
      const lat = parseFloat(String(item.lat));
      const lng = parseFloat(String(item.lon));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        label: formatShortLabel(item),
        latitude: lat,
        longitude: lng,
        placeType: item.type ? String(item.type) : undefined,
      };
    })
    .filter((item): item is GeocodePlace => item !== null);
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodePlace | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
  });

  const item = (await nominatimFetch(`/reverse?${params.toString()}`)) as Record<string, unknown>;
  if (!item || item.error) return null;

  const lat = parseFloat(String(item.lat ?? latitude));
  const lng = parseFloat(String(item.lon ?? longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    label: formatShortLabel(item),
    latitude: lat,
    longitude: lng,
    placeType: item.type ? String(item.type) : undefined,
  };
}
