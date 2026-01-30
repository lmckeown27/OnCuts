import api from './api.service';
import type { Campus, PaginatedResponse, Barber } from '../types';

/**
 * Derive a short name from the campus slug
 * e.g., "ucla" -> "UCLA", "cal-poly" -> "Cal Poly", "mit" -> "MIT"
 */
function deriveShortName(slug: string | undefined, fullName: string): string | undefined {
  if (!slug) return undefined;
  
  // Format slug: replace hyphens with spaces, capitalize appropriately
  const formatted = slug
    .split('-')
    .map(word => {
      // Common acronyms that should be all caps
      const acronyms = ['uc', 'csu', 'mit', 'nyu', 'usc', 'ucla', 'ucsd', 'ucsb', 'ucsc', 'uci', 'ucr', 
                        'asu', 'osu', 'lsu', 'fsu', 'fiu', 'fau', 'utep', 'utsa', 'unlv', 'uncc', 'unt',
                        'jmu', 'jhu', 'gmu', 'vcu', 'wvu', 'byu', 'smu', 'tcu', 'ecu', 'odu', 'uab',
                        'csuf', 'csun', 'csulb', 'sjsu', 'sdsu', 'usf', 'lmu', 'slu', 'bu', 'bc', 'gw'];
      if (acronyms.includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  // Only use as shortName if it's reasonably short and different from fullName
  if (formatted.length <= 15 && formatted.length < fullName.length * 0.6) {
    return formatted;
  }
  
  return undefined;
}

/**
 * Transform campus data to include derived shortName
 */
function transformCampus(campus: Campus): Campus {
  return {
    ...campus,
    shortName: deriveShortName(campus.slug, campus.name),
  };
}

class CampusService {
  async getCampuses(search?: string): Promise<Campus[]> {
    // api.get extracts response.data.data when no pagination is present
    // so the response is already the campuses array
    // No limit - fetch all universities in the system
    const campuses = await api.get<Campus[]>('/campus', { search });
    return (campuses || []).map(transformCampus);
  }

  async getCampusById(id: string): Promise<Campus> {
    const campus = await api.get<Campus>(`/campus/${id}`);
    return transformCampus(campus);
  }

  async getCampusBarbers(campusId: string, filters?: any): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>(`/campus/${campusId}/barbers`, filters);
  }
}

export default new CampusService();

