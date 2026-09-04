/**
 * Client helpers for My Barbers / Discover (no backend changes).
 * Deferred later: true next bookable slot, user-set MAIN, dedicated /my-barbers API.
 */

import type { Barber, DaySchedule, WeeklySchedule } from '../types';

const DAY_KEYS: (keyof WeeklySchedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const DAY_LABELS: Record<keyof WeeklySchedule, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

export type MyBarberBookingSeed = {
  barberId?: string | null;
  scheduledTime?: string | null;
  status?: string | null;
};

export type MyBarberEntry = {
  barber: Barber;
  bookingCount: number;
  lastBookedAt: number;
  isMain: boolean;
};

function formatTime12(time24: string | undefined | null): string {
  if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return '';
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  return minute === 0 ? `${hour}${ampm}` : `${hour}:${minuteStr}${ampm}`;
}

function dayIntervals(day: DaySchedule | undefined): { start: string; end: string }[] {
  if (!day?.enabled) return [];
  if (Array.isArray(day.intervals) && day.intervals.length > 0) {
    return day.intervals
      .filter((i) => i?.start && i?.end)
      .map((i) => ({ start: i.start, end: i.end }));
  }
  if (day.start && day.end) {
    return [{ start: day.start, end: day.end }];
  }
  return [];
}

function timeToMinutes(time24: string): number {
  const [h, m] = time24.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Location group key from operator public service area (general pin label). */
export function locationGroupKey(barber: Barber): string {
  const label = (barber.service_location_label || '').trim();
  if (label) {
    const first = label.split(',')[0]?.trim();
    if (first) return first;
  }

  // Fallback: primary assigned campus / service spot name
  const spots = barber.service_locations;
  if (Array.isArray(spots) && spots.length > 0) {
    const primary = spots.find((s) => s.is_primary) ?? spots[0];
    const name = (primary?.name || '').trim();
    if (name) {
      const first = name.split(',')[0]?.trim();
      if (first) return first;
    }
  }

  return 'Other';
}

export function groupBarbersByLocationLabel(
  entries: Array<{ barber: Barber } | Barber>
): { location: string; items: Barber[] }[] {
  const map = new Map<string, Barber[]>();
  for (const entry of entries) {
    const barber = 'barber' in entry ? entry.barber : entry;
    const key = locationGroupKey(barber);
    const list = map.get(key) ?? [];
    list.push(barber);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([location, items]) => ({ location, items }))
    .sort((a, b) => {
      if (a.location === 'Other') return 1;
      if (b.location === 'Other') return -1;
      return a.location.localeCompare(b.location);
    });
}

/**
 * Approximate next open window from weekly_schedule (not true booked-slot availability).
 * Returns display string like "Mon 9am" or null.
 */
export function nextOpenFromWeeklySchedule(
  schedule: WeeklySchedule | undefined | null,
  now: Date = new Date()
): string | null {
  if (!schedule) return null;

  const nowDay = now.getDay(); // 0 = Sunday
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (nowDay + offset) % 7;
    const dayKey = DAY_KEYS[dayIndex];
    const intervals = dayIntervals(schedule[dayKey]);
    if (intervals.length === 0) continue;

    for (const interval of intervals) {
      const startMin = timeToMinutes(interval.start);
      if (offset === 0 && startMin <= nowMinutes) {
        // Still open today?
        const endMin = timeToMinutes(interval.end);
        if (endMin > nowMinutes) {
          return `Open now · until ${formatTime12(interval.end)}`;
        }
        continue;
      }
      if (offset === 0 && startMin > nowMinutes) {
        return `Today ${formatTime12(interval.start)}`;
      }
      if (offset > 0) {
        return `${DAY_LABELS[dayKey]} ${formatTime12(interval.start)}`;
      }
    }
  }
  return null;
}

/** Milliseconds until next open start (Infinity if none) — for Discover sort. */
export function nextOpenSortKey(
  schedule: WeeklySchedule | undefined | null,
  now: Date = new Date()
): number {
  if (!schedule) return Number.POSITIVE_INFINITY;

  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (nowDay + offset) % 7;
    const dayKey = DAY_KEYS[dayIndex];
    const intervals = dayIntervals(schedule[dayKey]);
    for (const interval of intervals) {
      const startMin = timeToMinutes(interval.start);
      const endMin = timeToMinutes(interval.end);
      if (offset === 0) {
        if (startMin <= nowMinutes && endMin > nowMinutes) return 0;
        if (startMin > nowMinutes) return (startMin - nowMinutes) * 60_000;
        continue;
      }
      const ms =
        offset * 24 * 60 * 60_000 +
        (startMin - nowMinutes) * 60_000;
      return Math.max(ms, 1);
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function minBarberPrice(barber: Barber): number | undefined {
  const prices = (barber.pricing || [])
    .map((p) => p.price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (prices.length === 0) return undefined;
  return Math.min(...prices);
}

export function barberDisplayName(barber: Barber): string {
  return (
    barber.name ||
    barber.display_name ||
    `${barber.first_name || ''} ${barber.last_name || ''}`.trim() ||
    'Barber'
  );
}

export function barberPhotoUrl(barber: Barber): string | undefined {
  return (
    barber.profile_picture_url ||
    barber.profile_photo_url ||
    barber.user?.profile_picture_url ||
    undefined
  );
}

/**
 * Distinct past/current operators from bookings; MAIN = most booked (tie → most recent).
 */
export function buildMyBarbersFromBookings(
  bookings: MyBarberBookingSeed[],
  providersById: Map<string, Barber>
): MyBarberEntry[] {
  const counts = new Map<string, { count: number; lastBookedAt: number }>();

  for (const booking of bookings) {
    const id = booking.barberId?.trim();
    if (!id) continue;
    const status = (booking.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'REJECTED') continue;

    const ts = booking.scheduledTime ? Date.parse(booking.scheduledTime) : 0;
    const prev = counts.get(id);
    if (!prev) {
      counts.set(id, { count: 1, lastBookedAt: Number.isFinite(ts) ? ts : 0 });
    } else {
      prev.count += 1;
      if (Number.isFinite(ts) && ts > prev.lastBookedAt) prev.lastBookedAt = ts;
    }
  }

  const entries: Omit<MyBarberEntry, 'isMain'>[] = [];
  for (const [id, meta] of counts) {
    const barber = providersById.get(id);
    if (!barber) continue;
    entries.push({
      barber,
      bookingCount: meta.count,
      lastBookedAt: meta.lastBookedAt,
    });
  }

  entries.sort((a, b) => {
    if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
    return b.lastBookedAt - a.lastBookedAt;
  });

  const mainId = entries[0]?.barber.id ?? null;

  return entries.map((e) => ({
    ...e,
    isMain: e.barber.id === mainId,
  }));
}

/** Proximity first, then sooner next open window. */
export function sortDiscoverBarbers(barbers: Barber[], now: Date = new Date()): Barber[] {
  return [...barbers].sort((a, b) => {
    const da =
      typeof a.distance_miles === 'number' && Number.isFinite(a.distance_miles)
        ? a.distance_miles
        : Number.POSITIVE_INFINITY;
    const db =
      typeof b.distance_miles === 'number' && Number.isFinite(b.distance_miles)
        ? b.distance_miles
        : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (
      nextOpenSortKey(a.weekly_schedule, now) - nextOpenSortKey(b.weekly_schedule, now)
    );
  });
}

export type DiscoverArea = {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  barberIds: string[];
};

/** Cluster listed operators by location label for map selection. */
export function buildDiscoverAreas(barbers: Barber[]): DiscoverArea[] {
  const groups = new Map<
    string,
    {
      label: string;
      lats: number[];
      lngs: number[];
      radii: number[];
      barberIds: string[];
    }
  >();

  for (const barber of barbers) {
    const lat = Number(barber.service_latitude);
    const lng = Number(barber.service_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const label = locationGroupKey(barber);
    const key = label.toLowerCase();
    const g = groups.get(key) ?? {
      label,
      lats: [],
      lngs: [],
      radii: [],
      barberIds: [],
    };
    g.lats.push(lat);
    g.lngs.push(lng);
    const r = Number(barber.service_radius_km);
    g.radii.push(Number.isFinite(r) && r > 0 ? r : 5);
    g.barberIds.push(barber.id);
    groups.set(key, g);
  }

  return Array.from(groups.entries()).map(([key, g]) => {
    const avg = (nums: number[]) => nums.reduce((s, n) => s + n, 0) / nums.length;
    return {
      key,
      label: g.label,
      latitude: avg(g.lats),
      longitude: avg(g.lngs),
      radiusKm: Math.max(...g.radii),
      barberIds: g.barberIds,
    };
  });
}
