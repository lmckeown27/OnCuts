import api from './api.service';

export interface GeocodePlace {
  label: string;
  latitude: number;
  longitude: number;
  placeType?: string;
}

class GeocodeService {
  async searchPlaces(query: string): Promise<GeocodePlace[]> {
    const response = await api.get<{ success: boolean; data: GeocodePlace[] }>('/geocode/search', {
      q: query,
    });
    return response.data ?? [];
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
