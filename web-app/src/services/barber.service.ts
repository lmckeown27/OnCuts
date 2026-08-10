import api from './api.service';
import type { Barber, PaginatedResponse, Review, PortfolioImage } from '../types';

interface BarberFilters {
  campus_id?: string;
  campusId?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  specialties?: string[];
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  constrainListByDistance?: boolean;
  includeHidden?: boolean;
  providerType?: string;
  category?: string;
}

export interface BarberListMeta {
  sorted_by?: string;
  user_location_provided?: boolean;
  max_distance_km?: number | null;
  max_distance_miles?: number | null;
  total_before_distance_filter?: number;
  showing_closest_fallback?: boolean;
  constrain_list_by_distance?: boolean;
}

export interface BarberListResponse extends PaginatedResponse<Barber> {
  meta?: BarberListMeta;
}

class BarberService {
  private normalizeBarberFilters(filters: BarberFilters = {}): Record<string, unknown> {
    const params: Record<string, unknown> = { ...filters };
    if (params.campus_id && !params.campusId) {
      params.campusId = params.campus_id;
      delete params.campus_id;
    }
    return params;
  }

  async getBarbers(filters: BarberFilters = {}): Promise<BarberListResponse> {
    return await api.get<BarberListResponse>('/barbers', this.normalizeBarberFilters(filters));
  }

  /**
   * Get barbers near a college-town reference point.
   * Pass constrainListByDistance to filter by each barber's public service pin.
   */
  async getBarbersByLocation(
    latitude: number,
    longitude: number,
    filters: Omit<BarberFilters, 'lat' | 'lng'> = {},
    maxDistanceKm: number = 8,
  ): Promise<BarberListResponse> {
    return await api.get<BarberListResponse>('/barbers', this.normalizeBarberFilters({
      ...filters,
      lat: latitude,
      lng: longitude,
      maxDistance: maxDistanceKm,
    }));
  }

  async getBarberById(id: string): Promise<Barber> {
    return await api.get<Barber>(`/barbers/${id}`);
  }

  async getBarberByUserId(
    userId: string,
    options?: { cacheBust?: boolean }
  ): Promise<Barber | null> {
    try {
      const params = options?.cacheBust ? { _t: Date.now() } : undefined;
      return await api.get<Barber>(`/barbers/user/${userId}`, params);
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

  async toggleVacationMode(barberId: string, isHidden: boolean): Promise<Barber> {
    return await api.put<Barber>(`/barbers/${barberId}`, { is_hidden: isHidden });
  }

  /**
   * Remove barber (demote to consumer) - Admin only
   */
  async removeBarber(barberId: string): Promise<{ success: boolean; message: string }> {
    return await api.post<{ success: boolean; message: string }>(`/barbers/${barberId}/remove`, {});
  }

  // =====================================================
  // TIME BLOCKS - One-time date-specific availability blocks
  // =====================================================

  /**
   * Get barber's time blocks
   */
  async getTimeBlocks(barberId: string, startDate?: string, endDate?: string): Promise<TimeBlock[]> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    // api.get already extracts response.data.data, so we get TimeBlock[] directly
    const blocks = await api.get<TimeBlock[]>(`/barbers/${barberId}/time-blocks`, params);
    return blocks || [];
  }

  /**
   * Create a new time block
   */
  async createTimeBlock(barberId: string, block: CreateTimeBlockData): Promise<TimeBlock> {
    // api.post already extracts response.data.data
    return await api.post<TimeBlock>(`/barbers/${barberId}/time-blocks`, block);
  }

  /**
   * Delete a time block
   */
  async deleteTimeBlock(barberId: string, blockId: string): Promise<void> {
    await api.delete(`/barbers/${barberId}/time-blocks/${blockId}`);
  }
}

// Time block types
export interface TimeBlock {
  id: string;
  blockDate: string;
  startTime: string;
  endTime: string;
  reason?: string;
  createdAt: string;
}

export interface CreateTimeBlockData {
  blockDate: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export default new BarberService();

