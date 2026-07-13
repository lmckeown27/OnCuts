/**
 * OpenStreetMap Nominatim geocoding proxy.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * - Server-side only (User-Agent + rate discipline)
 * - In-memory cache for repeated queries
 * - Max ~1 upstream request per second
 */

import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'OnCuts-Marketplace-App (support@oncuts.com)';

const SEARCH_CACHE_TTL_SEC = 60 * 60 * 24; // 24h — dorm/library names repeat often
const REVERSE_CACHE_TTL_SEC = 60 * 60 * 6;

const searchCache = new NodeCache({ stdTTL: SEARCH_CACHE_TTL_SEC, checkperiod: 600 });
const reverseCache = new NodeCache({ stdTTL: REVERSE_CACHE_TTL_SEC, checkperiod: 600 });

let lastUpstreamRequestAt = 0;

export interface GeocodePlace {
  label: string;
  latitude: number;
  longitude: number;
  placeType?: string;
}

export class GeocodeUpstreamError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'GeocodeUpstreamError';
    this.statusCode = statusCode;
  }
}

/** Strip control chars and cap length before hitting Nominatim. */
export function sanitizeGeocodeQuery(raw: string): string {
  return raw
    .replace(/[\0-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 200);
}

/**
 * City/town only for public labels (no street / house number).
 * e.g. "San Luis Obispo" — not "1144 Chorro St, San Luis Obispo".
 */
export function formatCoarsePublicLabel(item: Record<string, unknown>): string {
  const address = item.address as Record<string, string> | undefined;
  if (address) {
    const campus = address.university || address.college;
    if (campus) return campus;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county;
    if (city) return city;
  }
  return coarsenPublicLocationLabel(String(item.display_name || ''));
}

/**
 * Strip street-level detail from a stored or display_name label.
 * Preserves campus/city names; turns "1144 Chorro St, San Luis Obispo, CA" → "San Luis Obispo".
 */
export function coarsenPublicLocationLabel(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return trimmed;

  const segments = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return trimmed;

  const streetLike =
    /^\d/.test(segments[0]) ||
    /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|court|hwy|highway|pkwy|parkway)\.?$/i.test(
      segments[0]
    );

  if (streetLike && segments.length >= 2) {
    // Next segment is usually the city/town
    return segments[1];
  }

  // Already a place/city (optionally with state) — use the primary place name only
  return segments[0];
}

/** @deprecated Prefer formatCoarsePublicLabel for public-facing place names. */
function formatShortLabel(item: Record<string, unknown>): string {
  return formatCoarsePublicLabel(item);
}

async function waitForNominatimSlot(): Promise<void> {
  const elapsed = Date.now() - lastUpstreamRequestAt;
  const waitMs = Math.max(0, 1000 - elapsed);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastUpstreamRequestAt = Date.now();
}

async function nominatimGet<T>(path: string): Promise<T> {
  await waitForNominatimSlot();

  try {
    const response = await axios.get<T>(`${NOMINATIM_BASE}${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      timeout: 12000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 429) {
      logger.warn('Nominatim rate limit (429)', { path });
      throw new GeocodeUpstreamError('Geocoding service is busy. Please try again in a moment.', 503);
    }

    if (response.status >= 400) {
      logger.warn('Nominatim client error', { path, status: response.status });
      throw new GeocodeUpstreamError('Geocoding service unavailable', 502);
    }

    return response.data;
  } catch (error) {
    if (error instanceof GeocodeUpstreamError) throw error;

    const axiosError = error as AxiosError;
    if (axiosError.code === 'ECONNABORTED') {
      throw new GeocodeUpstreamError('Geocoding request timed out', 504);
    }

    logger.error('Nominatim upstream failure', {
      path,
      message: axiosError.message,
    });
    throw new GeocodeUpstreamError('Geocoding service unavailable', 503);
  }
}

function mapSearchResults(data: unknown): GeocodePlace[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item): GeocodePlace | null => {
      const row = item as Record<string, unknown>;
      const lat = parseFloat(String(row.lat));
      const lng = parseFloat(String(row.lon));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        label: formatShortLabel(row),
        latitude: lat,
        longitude: lng,
        placeType: row.type ? String(row.type) : undefined,
      };
    })
    .filter((item): item is GeocodePlace => item !== null);
}

export async function searchPlaces(query: string, limit = 8): Promise<GeocodePlace[]> {
  const trimmed = sanitizeGeocodeQuery(query);
  if (trimmed.length < 2) return [];

  const cacheKey = `search:v2:${trimmed.toLowerCase()}:${limit}`;
  const cached = searchCache.get<GeocodePlace[]>(cacheKey);
  if (cached) {
    logger.debug('Geocode search cache hit', { query: trimmed });
    return cached;
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: String(Math.min(limit, 10)),
    addressdetails: '1',
    countrycodes: 'us',
  });

  const data = await nominatimGet<unknown[]>(`/search?${params.toString()}`);
  const results = mapSearchResults(data);
  searchCache.set(cacheKey, results);
  return results;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodePlace | null> {
  const latKey = latitude.toFixed(5);
  const lngKey = longitude.toFixed(5);
  const cacheKey = `reverse:v2:${latKey},${lngKey}`;

  const cached = reverseCache.get<GeocodePlace>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: latKey,
    lon: lngKey,
    format: 'json',
    addressdetails: '1',
  });

  const item = await nominatimGet<Record<string, unknown>>(`/reverse?${params.toString()}`);
  if (!item || item.error) return null;

  const lat = parseFloat(String(item.lat ?? latitude));
  const lng = parseFloat(String(item.lon ?? longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const place: GeocodePlace = {
    label: formatCoarsePublicLabel(item),
    latitude: lat,
    longitude: lng,
    placeType: item.type ? String(item.type) : undefined,
  };

  reverseCache.set(cacheKey, place);
  return place;
}

/** Reverse geocode to a coarse city/region label for public device pins. */
export async function reverseGeocodeCoarse(
  latitude: number,
  longitude: number
): Promise<GeocodePlace | null> {
  const latKey = latitude.toFixed(5);
  const lngKey = longitude.toFixed(5);
  const cacheKey = `reverse-coarse:${latKey},${lngKey}`;

  const cached = reverseCache.get<GeocodePlace>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: latKey,
    lon: lngKey,
    format: 'json',
    addressdetails: '1',
  });

  const item = await nominatimGet<Record<string, unknown>>(`/reverse?${params.toString()}`);
  if (!item || item.error) return null;

  const lat = parseFloat(String(item.lat ?? latitude));
  const lng = parseFloat(String(item.lon ?? longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const place: GeocodePlace = {
    label: formatCoarsePublicLabel(item),
    latitude: lat,
    longitude: lng,
    placeType: item.type ? String(item.type) : undefined,
  };

  reverseCache.set(cacheKey, place);
  return place;
}
