const SERVICE_DEFAULT_DURATIONS: Record<string, number> = {
  'Buzz Cut': 20,
  'Line Up': 15,
  'Beard Trim': 20,
  'Haircut': 30,
  'Taper': 30,
  'Hot Shave': 30,
  'Kids Cut': 25,
  'Fade': 45,
  'Haircut & Fade': 45,
  'Mullet': 40,
  'Design/Art': 60,
  'Afro Textures': 45,
  "Women's Cut": 45,
  'Color Treatment': 90,
  'Perm': 120,
};

export const MIN_SERVICE_DURATION_MINUTES = 15;
export const MAX_SERVICE_DURATION_MINUTES = 240;
export const DEFAULT_SERVICE_DURATION_MINUTES = 30;
export const FALLBACK_BOOKING_DURATION_MINUTES = 60;

export interface BarberPricingEntry {
  name: string;
  price: number;
  duration_minutes?: number;
}

export function getDefaultDurationMinutes(serviceName: string): number {
  return SERVICE_DEFAULT_DURATIONS[serviceName] ?? DEFAULT_SERVICE_DURATION_MINUTES;
}

export function resolveServiceDurationMinutes(
  serviceName: string,
  pricing?: BarberPricingEntry[] | null
): number {
  const saved = pricing?.find(
    (entry) => entry.name?.toLowerCase() === serviceName.toLowerCase()
  );
  if (saved?.duration_minutes) {
    return saved.duration_minutes;
  }
  return getDefaultDurationMinutes(serviceName);
}

export function enrichPricingWithDurations(pricing: BarberPricingEntry[]): BarberPricingEntry[] {
  return pricing.map((entry) => ({
    ...entry,
    duration_minutes: entry.duration_minutes ?? getDefaultDurationMinutes(entry.name),
  }));
}

export function normalizePricingEntries(pricing: unknown): BarberPricingEntry[] {
  if (!Array.isArray(pricing)) {
    throw new Error('pricing must be an array');
  }

  return pricing.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each pricing entry must be an object');
    }

    const { name, price, duration_minutes } = entry as BarberPricingEntry;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Each pricing entry requires a name');
    }
    if (typeof price !== 'number' || Number.isNaN(price)) {
      throw new Error(`Invalid price for ${name}`);
    }

    const duration = duration_minutes ?? getDefaultDurationMinutes(name);
    if (
      !Number.isInteger(duration) ||
      duration < MIN_SERVICE_DURATION_MINUTES ||
      duration > MAX_SERVICE_DURATION_MINUTES
    ) {
      throw new Error(
        `Duration for ${name} must be between ${MIN_SERVICE_DURATION_MINUTES} and ${MAX_SERVICE_DURATION_MINUTES} minutes`
      );
    }

    return {
      name: name.trim(),
      price,
      duration_minutes: duration,
    };
  });
}
