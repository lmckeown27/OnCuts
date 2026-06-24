import api from './api.service';

export interface GeocodePlace {
  label: string;
  latitude: number;
  longitude: number;
  placeType?: string;
}

class GeocodeService {
  async searchPlaces(query: string): Promise<GeocodePlace[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const results = await api.get<GeocodePlace[]>('/geocode/search', {
      q: trimmed,
    });
    return Array.isArray(results) ? results : [];
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodePlace> {
    return await api.get<GeocodePlace>('/geocode/reverse', {
      lat: latitude,
      lng: longitude,
    });
  }
}

export const geocodeService = new GeocodeService();
export default geocodeService;
