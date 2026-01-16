import api from './api.service';
import type { Barber, PaginatedResponse, Review, PortfolioImage } from '../types';

interface BarberFilters {
  campus_id?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  specialties?: string[];
  page?: number;
  limit?: number;
  // Location-based filtering
  lat?: number;
  lng?: number;
  maxDistance?: number; // Maximum distance in km (default: 8km / ~5 miles)
}

class BarberService {
  async getBarbers(filters: BarberFilters = {}): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>('/barbers', filters);
  }

  /**
   * Get barbers sorted by distance from user's location
   * Default max distance: 8km (~5 miles) - reasonable for university students
   * This prevents accidentally booking barbers too far away
   */
  async getBarbersByLocation(
    latitude: number, 
    longitude: number, 
    filters: Omit<BarberFilters, 'lat' | 'lng'> = {},
    maxDistanceKm: number = 8 // Default: 8km (~5 miles)
  ): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>('/barbers', {
      ...filters,
      lat: latitude,
      lng: longitude,
      maxDistance: maxDistanceKm,
    });
  }

  async getBarberById(id: string): Promise<Barber> {
    return await api.get<Barber>(`/barbers/${id}`);
  }

  async getBarberByUserId(userId: string): Promise<Barber | null> {
    try {
      return await api.get<Barber>(`/barbers/user/${userId}`);
    } catch {
      return null;
    }
  }

  async getMyBarberProfile(): Promise<Barber | null> {
    try {
      return await api.get<Barber>('/barbers/me');
    } catch {
      return null;
    }
  }

  async createBarberProfile(data: Partial<Barber>): Promise<Barber> {
    return await api.post<Barber>('/barbers', data);
  }

  async updateBarberProfile(id: string, data: Partial<Barber>): Promise<Barber> {
    return await api.put<Barber>(`/barbers/${id}`, data);
  }

  async getBarberReviews(barberId: string, page = 1, limit = 20): Promise<PaginatedResponse<Review>> {
    return await api.get<PaginatedResponse<Review>>(`/barbers/${barberId}/reviews`, { page, limit });
  }

  async getBarberAvailability(barberId: string, date?: string): Promise<any> {
    return await api.get(`/barbers/${barberId}/availability`, { date });
  }

  async uploadPortfolioImages(barberId: string, files: File[]): Promise<PortfolioImage[]> {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    return await api.upload<PortfolioImage[]>(`/upload/portfolio`, formData);
  }

  async deletePortfolioImage(imageId: string): Promise<void> {
    await api.delete(`/barbers/portfolio/${imageId}`);
  }

  async toggleVacationMode(barberId: string, isActive: boolean): Promise<Barber> {
    return await api.put<Barber>(`/barbers/${barberId}`, { is_active: isActive });
  }

  /**
   * Remove barber (demote to consumer) - Campus Manager only
   */
  async removeBarber(barberId: string): Promise<{ success: boolean; message: string }> {
    return await api.post<{ success: boolean; message: string }>(`/barbers/${barberId}/remove`, {});
  }
}

export default new BarberService();

