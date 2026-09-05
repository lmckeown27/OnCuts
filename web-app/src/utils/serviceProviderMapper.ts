import type { ServiceProvider, ServiceProviderReview } from '../types/service-provider';
import type { Barber, Review, Service, ServiceLocation } from '../types';

function mapReviews(
  customerReviews: ServiceProviderReview[] | null,
  barberId: string,
): Review[] | undefined {
  if (!customerReviews?.length) return undefined;

  return customerReviews.map((review) => ({
    id: review.id ?? '',
    booking_id: '',
    barber_id: barberId,
    student_id: '',
    rating: review.rating,
    review_text: review.comment ?? undefined,
    created_at: review.createdAt ?? '',
    first_name: review.reviewerFirstName ?? undefined,
    last_name: review.reviewerLastName ?? undefined,
    profile_picture_url: review.reviewerAvatarUrl ?? undefined,
    service_name: review.serviceName ?? undefined,
  }));
}

function mapPricing(services: ServiceProvider['services']): Service[] {
  if (!services?.length) return [];

  return services.map((service) => ({
    name: service.name,
    price: service.price,
    duration_minutes: service.durationMinutes ?? undefined,
  }));
}

function mapServiceLocations(locations: string[] | null): ServiceLocation[] | undefined {
  if (!locations?.length) return undefined;

  return locations.map((name, index) => ({
    id: `location-${index}`,
    name,
    is_primary: index === 0,
  }));
}

function splitBusinessName(businessName: string): Pick<Barber, 'first_name' | 'last_name' | 'display_name'> {
  const trimmed = businessName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length <= 1) {
    return { display_name: trimmed, first_name: trimmed };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
    display_name: trimmed,
  };
}

/** Map OnCuts ServiceProvider DTO into legacy Barber UI types. */
export function mapServiceProviderToBarber(provider: ServiceProvider): Barber {
  const names = splitBusinessName(provider.businessName);
  const specialties = provider.specialty ? [provider.specialty] : [];

  return {
    id: provider.id,
    user_id: provider.userId,
    name: provider.businessName,
    ...names,
    bio: provider.bio ?? '',
    instagram_handle: provider.instagramHandle ?? undefined,
    profile_picture_url: provider.profileImageUrl ?? undefined,
    specialties,
    years_experience: 0,
    pricing: mapPricing(provider.services),
    total_bookings: provider.completedBookings ?? 0,
    total_reviews: provider.reviewCount ?? undefined,
    review_count: provider.reviewCount ?? undefined,
    average_rating: provider.rating ?? undefined,
    is_active: provider.isAvailableNow ?? true,
    weekly_schedule: provider.weeklySchedule as Barber['weekly_schedule'],
    service_latitude: provider.serviceLatitude ?? undefined,
    service_longitude: provider.serviceLongitude ?? undefined,
    service_location_label: provider.serviceLocationLabel ?? undefined,
    distance_miles: provider.distanceMilesFromUser ?? undefined,
    campus_id: provider.campusId ?? undefined,
    service_locations: mapServiceLocations(provider.locations),
    reviews: mapReviews(provider.customerReviews, provider.id),
    provider_type: provider.providerType,
  };
}
