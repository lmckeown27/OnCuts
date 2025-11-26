import api from './api.service';
import type { Barber, PaginatedResponse, Review, PortfolioImage } from '../types';

interface BarberFilters {
  campus_id?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  specialties?: string[];
  instant_book?: boolean;
  page?: number;
  limit?: number;
}

class BarberService {
  async getBarbers(filters: BarberFilters = {}): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>('/barbers', filters);
  }

  async getBarberById(id: string): Promise<Barber> {
    return await api.get<Barber>(`/barbers/${id}`);
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

  async toggleInstantBook(barberId: string, enabled: boolean): Promise<Barber> {
    return await api.put<Barber>(`/barbers/${barberId}`, { instant_book_enabled: enabled });
  }

  async toggleVacationMode(barberId: string, isActive: boolean): Promise<Barber> {
    return await api.put<Barber>(`/barbers/${barberId}`, { is_active: isActive });
  }
}

export default new BarberService();

