import type {
  ServiceProvider,
  ServiceProviderCategory,
  ServiceProviderReview,
  ServiceProviderService,
} from '../types/service-provider.types';

type BarberLikeRecord = Record<string, unknown>;

const PROVIDER_TYPE_CATEGORY: Record<string, ServiceProviderCategory> = {
  barber: 'Haircuts',
  braids: 'Beauty',
  makeup: 'Beauty',
  nails: 'Beauty',
  lashes: 'Beauty',
  tanning: 'Beauty',
};

export const SERVICE_PROVIDER_CATEGORIES: ServiceProviderCategory[] = [
  'Haircuts',
  'Beauty',
];

const CATEGORY_PROVIDER_TYPES: Record<ServiceProviderCategory, string[]> = {
  Haircuts: [],
  Beauty: [],
};

for (const [providerType, category] of Object.entries(PROVIDER_TYPE_CATEGORY)) {
  CATEGORY_PROVIDER_TYPES[category].push(providerType);
}

export function isServiceProviderCategory(value: string): value is ServiceProviderCategory {
  return SERVICE_PROVIDER_CATEGORIES.includes(value as ServiceProviderCategory);
}

export function providerTypesForCategory(category: ServiceProviderCategory): string[] {
  return CATEGORY_PROVIDER_TYPES[category];
}

const PROVIDER_TYPE_SPECIALTY: Record<string, string> = {
  barber: 'Barber',
  braids: 'Braids',
  makeup: 'Makeup',
  nails: 'Nails',
  lashes: 'Lashes',
  tanning: 'Tanning',
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

export function normalizeProviderType(raw: unknown): string {
  const value = asString(raw)?.toLowerCase();
  return value || 'barber';
}

export function categoryForProviderType(providerType: string): ServiceProviderCategory {
  return PROVIDER_TYPE_CATEGORY[providerType] ?? 'Haircuts';
}

export function specialtyForProviderType(providerType: string): string {
  if (PROVIDER_TYPE_SPECIALTY[providerType]) {
    return PROVIDER_TYPE_SPECIALTY[providerType];
  }
  return providerType
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

/** Map a barber list/detail API record into the Intera ServiceProvider shape. */
export function mapBarberToServiceProvider(record: BarberLikeRecord): ServiceProvider {
  const providerType = normalizeProviderType(record.provider_type ?? record.providerType);
  const services = mapServices(record.pricing);
  const firstName = asString(record.first_name);
  const lastName = asString(record.last_name);
  const displayName =
    asString(record.name) ??
    asString(record.display_name) ??
    (([firstName, lastName].filter(Boolean).join(' ').trim()) || 'Provider');

  const id = asString(record.id) ?? '';
  const userId = asString(record.user_id ?? record.userId) ?? '';

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
    specialty: specialtyForProviderType(providerType),
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
