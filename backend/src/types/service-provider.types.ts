/** Coarse browse buckets — same as provider_type (barber | beauty). */
export type ServiceProviderCategory = 'Barber' | 'Beauty';

/** Displayed when an operator has not chosen Barber vs Beauty. */
export const UNCLEAR_OPERATOR_TYPE = 'Unclear operator type';

export type ServiceProviderCategoryOrUnclear =
  | ServiceProviderCategory
  | typeof UNCLEAR_OPERATOR_TYPE;

export type ServiceProviderService = {
  name: string;
  price: number;
  durationMinutes?: number | null;
};

export type ServiceProviderPriceRange = {
  min: number;
  max: number;
};

export type ServiceProviderReview = {
  id?: string;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
  reviewerFirstName?: string | null;
  reviewerLastName?: string | null;
  reviewerAvatarUrl?: string | null;
  serviceName?: string | null;
};

/**
 * Platform-agnostic provider shape for consumer clients (OnCuts ServiceProvider parity).
 * Legacy barber field names are omitted; use barberId when a barber-specific alias is needed.
 */
export type ServiceProvider = {
  id: string;
  userId: string;
  businessName: string;
  bio: string | null;
  instagramHandle: string | null;
  profileImageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  completedBookings: number | null;
  isAvailableNow: boolean | null;
  priceRange: ServiceProviderPriceRange | null;
  category: ServiceProviderCategoryOrUnclear;
  specialty: string;
  /** `barber` | `beauty` | `Unclear operator type` when unset. */
  providerType: string;
  services: ServiceProviderService[] | null;
  availability: unknown | null;
  locations: string[] | null;
  distanceMilesFromUser: number | null;
  customerReviews: ServiceProviderReview[] | null;
  /** Alias for booking APIs that still expect barberId. */
  barberId: string;
  /** Raw weekly schedule for clients that hydrate availability locally. */
  weeklySchedule?: unknown;
  serviceLatitude?: number | null;
  serviceLongitude?: number | null;
  /** Coarse public place (campus/city) for discover map grouping. */
  serviceLocationLabel?: string | null;
  campusId?: string | null;
};
