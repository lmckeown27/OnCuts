/**
 * Centralized Service/Specialty Definitions
 * 
 * This file is the single source of truth for all service types
 * used across the CampusCuts platform.
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
}

/**
 * Master list of all service types
 * These are the standardized services across the platform
 */
export const SERVICE_TYPES: ServiceType[] = [
  { id: 'haircut', name: 'Haircut', description: 'Standard haircut' },
  { id: 'fade', name: 'Fade', description: 'Fade haircut' },
  { id: 'taper', name: 'Taper', description: 'Taper cut' },
  { id: 'lineup', name: 'Line Up', description: 'Edge up / line up' },
  { id: 'buzz-cut', name: 'Buzz Cut', description: 'Clipper cut all over' },
  { id: 'beard-trim', name: 'Beard Trim', description: 'Beard shaping and trim' },
  { id: 'hot-shave', name: 'Hot Shave', description: 'Traditional hot towel shave' },
  { id: 'haircut-fade', name: 'Haircut & Fade', description: 'Full haircut with fade' },
  { id: 'design', name: 'Design/Art', description: 'Hair designs and artwork' },
  { id: 'womens-cut', name: "Women's Cut", description: 'Haircuts for women' },
  { id: 'kids-cut', name: 'Kids Cut', description: 'Haircuts for children' },
  { id: 'color', name: 'Color Treatment', description: 'Hair coloring services' },
  { id: 'perm', name: 'Perm', description: 'Permanent wave treatment' },
  { id: 'afro', name: 'Afro Textures', description: 'Afro and textured hair styling' },
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

export default SERVICE_TYPES;

