/** Coarse browse buckets aligned with Intera ServiceCategory. */
export type ServiceProviderCategory = 'Haircuts' | 'Beauty' | 'Wellness' | 'Fitness';

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

/** Intera ServiceProvider shape returned by GET /providers. */
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
  category: ServiceProviderCategory;
  specialty: string;
  providerType: string;
  services: ServiceProviderService[] | null;
  availability: unknown | null;
  locations: string[] | null;
  distanceMilesFromUser: number | null;
  customerReviews: ServiceProviderReview[] | null;
  barberId: string;
  weeklySchedule?: unknown;
  serviceLatitude?: number | null;
  serviceLongitude?: number | null;
  campusId?: string | null;
};
