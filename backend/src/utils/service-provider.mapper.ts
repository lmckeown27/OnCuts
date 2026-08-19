import type {
  ServiceProvider,
  ServiceProviderCategory,
  ServiceProviderReview,
  ServiceProviderService,
} from '../types/service-provider.types';

type BarberLikeRecord = Record<string, unknown>;

/** Canonical provider_type slugs stored in Postgres. */
export type ProviderTypeSlug = 'barber' | 'beauty';

export const SERVICE_PROVIDER_CATEGORIES: ServiceProviderCategory[] = ['Barber', 'Beauty'];

export const PROVIDER_TYPE_SLUGS: ProviderTypeSlug[] = ['barber', 'beauty'];

const SLUG_TO_CATEGORY: Record<ProviderTypeSlug, ServiceProviderCategory> = {
  barber: 'Barber',
  beauty: 'Beauty',
};

const CATEGORY_TO_SLUG: Record<string, ProviderTypeSlug> = {
  Barber: 'barber',
  Beauty: 'beauty',
  // Legacy browse / API alias
  Haircuts: 'barber',
  haircuts: 'barber',
  barber: 'barber',
  beauty: 'beauty',
};

const PROVIDER_TYPE_LABEL: Record<ProviderTypeSlug, string> = {
  barber: 'Barber',
  beauty: 'Beauty',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Normalize DB / query value to `barber` | `beauty` (default barber). */
export function normalizeProviderType(raw: unknown): ProviderTypeSlug {
  const value = asString(raw)?.toLowerCase();
  if (value === 'beauty') return 'beauty';
  // Legacy fine-grained beauty slugs (if any remain in DB)
  if (
    value === 'braids' ||
    value === 'makeup' ||
    value === 'nails' ||
    value === 'lashes' ||
    value === 'tanning'
  ) {
    return 'beauty';
  }
  return 'barber';
}

export function isServiceProviderCategory(value: string): value is ServiceProviderCategory {
  return SERVICE_PROVIDER_CATEGORIES.includes(value as ServiceProviderCategory);
}

/** Resolve category / legacy Haircuts / slug to a provider_type slug for filtering. */
export function providerTypeSlugFromCategoryOrType(
  categoryOrType: string | undefined | null
): ProviderTypeSlug | null {
  if (!categoryOrType?.trim()) return null;
  const key = categoryOrType.trim();
  const fromMap = CATEGORY_TO_SLUG[key] ?? CATEGORY_TO_SLUG[key.toLowerCase()];
  if (fromMap) return fromMap;
  if (isServiceProviderCategory(key)) return CATEGORY_TO_SLUG[key] ?? null;
  return null;
}

export function categoryForProviderType(providerType: string): ServiceProviderCategory {
  const slug = normalizeProviderType(providerType);
  return SLUG_TO_CATEGORY[slug];
}

/** @deprecated Prefer filtering by providerType slug; returns single slug for a category label. */
export function providerTypesForCategory(category: ServiceProviderCategory | string): string[] {
  const slug = providerTypeSlugFromCategoryOrType(category);
  return slug ? [slug] : [];
}

export function specialtyForProviderType(providerType: string): string {
  const slug = normalizeProviderType(providerType);
  return PROVIDER_TYPE_LABEL[slug];
}

function firstSpecialtyFromRecord(record: BarberLikeRecord): string | null {
  const specialties = record.specialties;
  if (Array.isArray(specialties) && specialties.length > 0) {
    const first = asString(specialties[0]);
    if (first) return first;
  }
  return null;
}

function mapServices(pricing: unknown): ServiceProviderService[] | null {
  if (!Array.isArray(pricing) || pricing.length === 0) return null;

  const services: ServiceProviderService[] = [];
  for (const entry of pricing) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = asString(record.name);
    const price = asNumber(record.price);
    if (!name || price == null) continue;
    const durationMinutes = asNumber(record.duration_minutes ?? record.durationMinutes);
    services.push({
      name,
      price,
      ...(durationMinutes != null ? { durationMinutes } : {}),
    });
  }

  return services.length > 0 ? services : null;
}

function mapPriceRange(services: ServiceProviderService[] | null): ServiceProvider['priceRange'] {
  if (!services?.length) return null;
  const prices = services.map((service) => service.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function mapLocations(record: BarberLikeRecord): string[] | null {
  const serviceLocations = record.service_locations;
  if (!Array.isArray(serviceLocations) || serviceLocations.length === 0) return null;

  const names = serviceLocations
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      return asString((location as Record<string, unknown>).name);
    })
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names : null;
}

function mapReviews(reviews: unknown): ServiceProviderReview[] | null {
  if (!Array.isArray(reviews) || reviews.length === 0) return null;

  const mapped: ServiceProviderReview[] = [];
  for (const review of reviews) {
    if (!review || typeof review !== 'object') continue;
    const record = review as Record<string, unknown>;
    const rating = asNumber(record.rating);
    if (rating == null) continue;
    const id = asString(record.id);
    mapped.push({
      ...(id ? { id } : {}),
      rating,
      comment: asString(record.review_text ?? record.comment),
      createdAt: asString(record.created_at ?? record.createdAt),
      reviewerFirstName: asString(record.first_name),
      reviewerLastName: asString(record.last_name),
      reviewerAvatarUrl: asString(record.profile_picture_url),
      serviceName: asString(record.service_name),
    });
  }

  return mapped.length > 0 ? mapped : null;
}

/** Map a barber list/detail API record into the OnCuts ServiceProvider shape. */
export function mapBarberToServiceProvider(record: BarberLikeRecord): ServiceProvider {
  const providerType = normalizeProviderType(record.provider_type ?? record.providerType);
  const services = mapServices(record.pricing);
  const firstName = asString(record.first_name);
  const lastName = asString(record.last_name);
  const displayName =
    asString(record.name) ??
    asString(record.display_name) ??
    ([firstName, lastName].filter(Boolean).join(' ').trim() || 'Provider');

  const id = asString(record.id) ?? '';
  const userId = asString(record.user_id ?? record.userId) ?? '';

  const specialty =
    firstSpecialtyFromRecord(record) ??
    services?.[0]?.name ??
    specialtyForProviderType(providerType);

  return {
    id,
    userId,
    businessName: displayName,
    bio: asString(record.bio),
    instagramHandle: asString(record.instagram_handle ?? record.instagramHandle),
    profileImageUrl: asString(record.profile_picture_url ?? record.profileImageUrl),
    rating: asNumber(record.average_rating ?? record.avgRating),
    reviewCount: asNumber(record.review_count ?? record.totalReviews),
    completedBookings: asNumber(record.total_bookings ?? record.totalBookings),
    isAvailableNow: typeof record.is_active === 'boolean' ? record.is_active : null,
    priceRange: mapPriceRange(services),
    category: categoryForProviderType(providerType),
    specialty,
    providerType,
    services,
    availability: record.weekly_schedule ?? record.weeklySchedule ?? null,
    locations: mapLocations(record),
    distanceMilesFromUser: asNumber(record.distance_miles ?? record.distanceMiles),
    customerReviews: mapReviews(record.reviews),
    barberId: id,
    weeklySchedule: record.weekly_schedule ?? record.weeklySchedule,
    serviceLatitude: asNumber(record.service_latitude ?? record.serviceLatitude),
    serviceLongitude: asNumber(record.service_longitude ?? record.serviceLongitude),
    campusId: asString(record.campus_id ?? record.campusId),
  };
}

export function mapBarbersToServiceProviders(records: BarberLikeRecord[]): ServiceProvider[] {
  return records.map(mapBarberToServiceProvider);
}
