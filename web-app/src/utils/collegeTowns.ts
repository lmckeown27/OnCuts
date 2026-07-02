import type { Campus, CollegeTown } from '../types';
import campusService from '../services/campus.service';
import { parseCoordinate } from './coordinates';

export const COLLEGE_TOWN_STORAGE_KEY = 'campuscut_selected_college_town';
export const LEGACY_UNIVERSITY_STORAGE_KEY = 'campuscut_selected_university';

function slugifyCityState(city: string, state: string): string {
  return `${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function averageCoordinate(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildCollegeTownsFromCampuses(campuses: Campus[]): CollegeTown[] {
  const byTown = new Map<string, Campus[]>();

  for (const campus of campuses) {
    const city = campus.city?.trim();
    const state = campus.state?.trim().toUpperCase();
    if (!city || !state) continue;

    const key = `${city.toLowerCase()}|${state}`;
    const existing = byTown.get(key) ?? [];
    existing.push(campus);
    byTown.set(key, existing);
  }

  const towns: CollegeTown[] = [];

  for (const townCampuses of byTown.values()) {
    const sorted = [...townCampuses].sort((a, b) => a.name.localeCompare(b.name));
    const city = sorted[0].city.trim();
    const state = sorted[0].state.trim().toUpperCase();
    const latitudes = sorted
      .map((campus) => parseCoordinate(campus.latitude))
      .filter((value): value is number => value != null);
    const longitudes = sorted
      .map((campus) => parseCoordinate(campus.longitude))
      .filter((value): value is number => value != null);

    towns.push({
      id: slugifyCityState(city, state),
      name: `${city}, ${state}`,
      shortName: city,
      city,
      state,
      latitude: averageCoordinate(latitudes),
      longitude: averageCoordinate(longitudes),
      campusCount: sorted.length,
      campusIds: sorted.map((campus) => campus.id),
      primaryCampusId: sorted[0].id,
    });
  }

  return towns.sort((a, b) => a.name.localeCompare(b.name));
}

export function collegeTownFromCampus(campus: Campus): CollegeTown {
  return {
    id: slugifyCityState(campus.city, campus.state),
    name: `${campus.city}, ${campus.state}`,
    shortName: campus.city,
    city: campus.city,
    state: campus.state,
    latitude: parseCoordinate(campus.latitude),
    longitude: parseCoordinate(campus.longitude),
    campusCount: 1,
    campusIds: [campus.id],
    primaryCampusId: campus.id,
  };
}

function parseStoredRecord(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeStoredCollegeTown(value: unknown): CollegeTown | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const city = typeof record.city === 'string' ? record.city.trim() : '';
  const state = typeof record.state === 'string' ? record.state.trim().toUpperCase() : '';
  if (!city || !state) return null;

  const campusIds = Array.isArray(record.campusIds)
    ? record.campusIds.filter((id): id is string => typeof id === 'string')
    : typeof record.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id)
      ? [record.id]
      : [];

  const primaryCampusId =
    typeof record.primaryCampusId === 'string'
      ? record.primaryCampusId
      : campusIds[0] ?? '';

  if (!primaryCampusId && campusIds.length === 0) return null;

  const shortName =
    typeof record.shortName === 'string' && record.shortName.trim()
      ? record.shortName.trim()
      : city;

  const name =
    typeof record.name === 'string' && record.name.includes(',')
      ? record.name
      : `${city}, ${state}`;

  return {
    id: typeof record.id === 'string' ? record.id : slugifyCityState(city, state),
    name,
    shortName,
    city,
    state,
    latitude: parseCoordinate(record.latitude),
    longitude: parseCoordinate(record.longitude),
    campusCount:
      typeof record.campusCount === 'number' && record.campusCount > 0
        ? record.campusCount
        : Math.max(campusIds.length, 1),
    campusIds: campusIds.length > 0 ? campusIds : [primaryCampusId],
    primaryCampusId,
  };
}

export function readStoredCollegeTown(): CollegeTown | null {
  const savedTown = localStorage.getItem(COLLEGE_TOWN_STORAGE_KEY);
  if (savedTown) {
    return normalizeStoredCollegeTown(parseStoredRecord(savedTown));
  }

  const legacy = localStorage.getItem(LEGACY_UNIVERSITY_STORAGE_KEY);
  if (!legacy) return null;

  const parsed = parseStoredRecord(legacy);
  const migrated = normalizeStoredCollegeTown(parsed);
  if (migrated) {
    writeStoredCollegeTown(migrated);
    localStorage.removeItem(LEGACY_UNIVERSITY_STORAGE_KEY);
  }
  return migrated;
}

/** Fill missing town coordinates from the latest campus list (city/state match). */
export function enrichCollegeTownWithCampuses(
  town: CollegeTown,
  campuses: Campus[],
): CollegeTown {
  if (town.latitude != null && town.longitude != null) {
    return town;
  }

  const fresh = buildCollegeTownsFromCampuses(campuses).find(
    (candidate) =>
      candidate.city.toLowerCase() === town.city.toLowerCase() &&
      candidate.state.toUpperCase() === town.state.toUpperCase(),
  );

  if (!fresh || fresh.latitude == null || fresh.longitude == null) {
    return town;
  }

  const enriched: CollegeTown = {
    ...town,
    latitude: fresh.latitude,
    longitude: fresh.longitude,
    campusCount: fresh.campusCount,
    campusIds: fresh.campusIds,
    primaryCampusId: town.primaryCampusId || fresh.primaryCampusId,
  };

  return enriched;
}

/** Read stored town and backfill coordinates from the campuses API when needed. */
export async function loadHydratedCollegeTown(): Promise<CollegeTown | null> {
  const stored = readStoredCollegeTown();
  if (!stored) return null;

  if (stored.latitude != null && stored.longitude != null) {
    return stored;
  }

  try {
    const campuses = await campusService.getCampuses();
    const hydrated = enrichCollegeTownWithCampuses(stored, campuses);
    if (
      hydrated.latitude !== stored.latitude ||
      hydrated.longitude !== stored.longitude
    ) {
      writeStoredCollegeTown(hydrated);
    }
    return hydrated;
  } catch {
    return stored;
  }
}

/** Stored town, or derive one from the signed-in user's campus when available. */
export async function resolveInitialCollegeTown(options?: {
  campusId?: string | null;
}): Promise<CollegeTown | null> {
  const stored = await loadHydratedCollegeTown();
  if (stored) return stored;

  const campusId = options?.campusId?.trim();
  if (!campusId) return null;

  try {
    const campus = await campusService.getCampusById(campusId);
    const town = collegeTownFromCampus(campus);
    const campuses = await campusService.getCampuses();
    const hydrated = enrichCollegeTownWithCampuses(town, campuses);
    writeStoredCollegeTown(hydrated);
    return hydrated;
  } catch {
    return null;
  }
}

export function writeStoredCollegeTown(town: CollegeTown | null): void {
  if (town) {
    localStorage.setItem(COLLEGE_TOWN_STORAGE_KEY, JSON.stringify(town));
  } else {
    localStorage.removeItem(COLLEGE_TOWN_STORAGE_KEY);
  }
}

export function searchCollegeTowns(towns: CollegeTown[], query: string, limit = 8): CollegeTown[] {
  if (!query || query.length < 1) return [];

  const lowerQuery = query.toLowerCase();
  const startsWithMatches: CollegeTown[] = [];
  const containsMatches: CollegeTown[] = [];

  for (const town of towns) {
    const cityLower = town.city.toLowerCase();
    const stateLower = town.state.toLowerCase();
    const nameLower = town.name.toLowerCase();

    if (
      cityLower.startsWith(lowerQuery) ||
      stateLower.startsWith(lowerQuery) ||
      nameLower.startsWith(lowerQuery)
    ) {
      startsWithMatches.push(town);
    } else if (
      cityLower.includes(lowerQuery) ||
      stateLower.includes(lowerQuery) ||
      nameLower.includes(lowerQuery)
    ) {
      containsMatches.push(town);
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, limit);
}
