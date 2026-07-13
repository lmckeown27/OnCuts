/**
 * Centralized Service/Specialty Definitions
 * 
 * This file is the single source of truth for all service types
 * used across the OnCuts platform.
 * 
 * IMPORTANT: Any changes here will affect:
 * - Barber profile editor (what barbers can specialize in)
 * - Consumer filters (what consumers can search for)
 * - Booking flow (what services can be booked)
 * - Barber cards (displayed specialties)
 */

export interface ServiceType {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  basePrice?: number; // Base price in dollars for pricing algorithm
  defaultDurationMinutes?: number;
  /** Browse bucket — Barber vs Beauty catalog */
  providerType?: 'barber' | 'beauty';
}

export const MIN_SERVICE_DURATION_MINUTES = 15;
export const MAX_SERVICE_DURATION_MINUTES = 240;
export const DEFAULT_SERVICE_DURATION_MINUTES = 60;

/**
 * Master list of all service types
 * These are the standardized services across the platform
 * 
 * Price Tiers (aligned with OnCuts model):
 * - Budget ($23): Basic quick services
 * - Standard ($28): Standard haircuts
 * - Premium ($35-45): Specialized services
 */
export const SERVICE_TYPES: ServiceType[] = [
  { id: 'buzz-cut', name: 'Buzz Cut', description: 'Clipper cut all over', basePrice: 23, providerType: 'barber' },
  { id: 'lineup', name: 'Line Up', description: 'Edge up / line up', basePrice: 23, providerType: 'barber' },
  { id: 'beard-trim', name: 'Beard Trim', description: 'Beard shaping and trim', basePrice: 23, providerType: 'barber' },
  { id: 'haircut', name: 'Haircut', description: 'Standard haircut', basePrice: 28, providerType: 'barber' },
  { id: 'taper', name: 'Taper', description: 'Taper cut', basePrice: 28, providerType: 'barber' },
  { id: 'hot-shave', name: 'Hot Shave', description: 'Traditional hot towel shave', basePrice: 28, providerType: 'barber' },
  { id: 'kids-cut', name: 'Kids Cut', description: 'Haircuts for children', basePrice: 28, providerType: 'barber' },
  { id: 'fade', name: 'Fade', description: 'Fade haircut', basePrice: 35, providerType: 'barber' },
  // { id: 'haircut-fade', name: 'Haircut & Fade', description: 'Full haircut with fade', basePrice: 35, providerType: 'barber' },
  { id: 'mullet', name: 'Mullet', description: 'Business in the front, party in the back', basePrice: 35, providerType: 'barber' },
  { id: 'design', name: 'Design/Art', description: 'Hair designs and artwork', basePrice: 38, providerType: 'barber' },
  { id: 'afro', name: 'Afro Textures', description: 'Afro and textured hair styling', basePrice: 38, providerType: 'barber' },
  // { id: 'womens-cut', name: "Women's Cut", description: 'Haircuts for women', basePrice: 40, providerType: 'barber' },
  { id: 'color', name: 'Color Treatment', description: 'Hair coloring services', basePrice: 45, providerType: 'barber' },
  { id: 'perm', name: 'Perm', description: 'Permanent wave treatment', basePrice: 45, providerType: 'barber' },
  // Beauty provider services
  { id: 'braids', name: 'Braids', description: 'Braiding and protective styles', basePrice: 45, providerType: 'beauty' },
  { id: 'makeup', name: 'Makeup', description: 'Makeup application', basePrice: 40, providerType: 'beauty' },
  { id: 'nails', name: 'Nails', description: 'Manicure, pedicure, nail art', basePrice: 35, providerType: 'beauty' },
  { id: 'lashes', name: 'Lashes', description: 'Lash extensions and lifts', basePrice: 40, providerType: 'beauty' },
  { id: 'tanning', name: 'Tanning', description: 'Spray tan / tanning services', basePrice: 30, providerType: 'beauty' },
];

/**
 * Get just the service names for display
 */
export const SERVICE_NAMES = SERVICE_TYPES.map(s => s.name);

/**
 * For backwards compatibility with existing code that uses string arrays
 */
export const SPECIALTY_OPTIONS = SERVICE_NAMES;

/**
 * Find a service by ID or name
 */
export const findService = (idOrName: string): ServiceType | undefined => {
  const lower = idOrName.toLowerCase();
  return SERVICE_TYPES.find(
    s => s.id === lower || s.name.toLowerCase() === lower
  );
};

/**
 * Normalize specialty names for consistent storage
 * This helps when barbers have old data with different naming
 */
export const normalizeSpecialty = (specialty: string): string => {
  const found = findService(specialty);
  return found ? found.name : specialty;
};

export const getDefaultDurationMinutes = (_serviceName?: string): number =>
  DEFAULT_SERVICE_DURATION_MINUTES;

export const resolveServiceDurationMinutes = (
  serviceName: string,
  pricing?: { name: string; duration_minutes?: number }[]
): number => {
  const saved = pricing?.find(
    (entry) => entry.name?.toLowerCase() === serviceName.toLowerCase()
  );
  if (saved?.duration_minutes) {
    return saved.duration_minutes;
  }
  return getDefaultDurationMinutes(serviceName);
};

export const resolveBookingAppointmentDuration = (
  booking: { durationMinutes?: number; serviceName?: string; serviceType?: string },
  barberPricing?: { name: string; duration_minutes?: number }[]
): number => {
  if (booking.durationMinutes) {
    return booking.durationMinutes;
  }
  const serviceName = booking.serviceName || booking.serviceType || '';
  return resolveServiceDurationMinutes(serviceName, barberPricing);
};

export default SERVICE_TYPES;

