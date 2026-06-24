import api from './api.service';
import barberService, { type BarberListMeta, type BarberListResponse } from './barber.service';
import type { Barber } from '../types';
import type { ServiceProvider } from '../types/service-provider';
import { mapServiceProviderToBarber } from '../utils/serviceProviderMapper';

interface ProviderFilters {
  campus_id?: string;
  campusId?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  minRating?: number;
  maxPrice?: number;
  specialties?: string[];
  specialty?: string;
  providerType?: string;
  category?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  constrainListByDistance?: boolean;
  includeHidden?: boolean;
}

type ProviderListPayload = {
  data: ServiceProvider[];
  pagination?: BarberListResponse['pagination'];
  meta?: BarberListMeta;
};

class ProviderService {
  private normalizeFilters(filters: ProviderFilters = {}): Record<string, unknown> {
    const params: Record<string, unknown> = { ...filters };

    if (params.campus_id && !params.campusId) {
      params.campusId = params.campus_id;
      delete params.campus_id;
    }
    if (params.min_rating != null && params.minRating == null) {
      params.minRating = params.min_rating;
      delete params.min_rating;
    }
    if (params.max_price != null && params.maxPrice == null) {
      params.maxPrice = params.max_price;
      delete params.max_price;
    }
    if (Array.isArray(params.specialties) && params.specialties.length === 1 && !params.specialty) {
      params.specialty = params.specialties[0];
    }
    delete params.specialties;

    return params;
  }

  private toListResponse(data: Barber[], raw?: ProviderListPayload): BarberListResponse {
    return {
      data,
      pagination: raw?.pagination ?? {
        page: 1,
        limit: data.length,
        total: data.length,
        total_pages: 1,
      },
      meta: raw?.meta,
    };
  }

  private async withBarberListFallback(
    providerCall: () => Promise<BarberListResponse>,
    barberCall: () => Promise<BarberListResponse>,
  ): Promise<BarberListResponse> {
    try {
      return await providerCall();
    } catch (error) {
      console.warn('[ProviderService] /providers failed; falling back to /barbers', error);
      return await barberCall();
    }
  }

  async getProviders(filters: ProviderFilters = {}): Promise<BarberListResponse> {
    return this.withBarberListFallback(
      async () => {
        const raw = await api.get<ProviderListPayload | ServiceProvider[]>(
          '/providers',
          this.normalizeFilters(filters),
        );
        if (Array.isArray(raw)) {
          return this.toListResponse(raw.map(mapServiceProviderToBarber));
        }
        if (Array.isArray(raw?.data)) {
          return this.toListResponse(raw.data.map(mapServiceProviderToBarber), raw);
        }
        return this.toListResponse([]);
      },
      () => barberService.getBarbers(filters),
    );
  }

  async getProvidersByLocation(
    latitude: number,
    longitude: number,
    filters: Omit<ProviderFilters, 'lat' | 'lng'> = {},
    maxDistanceKm: number = 8,
  ): Promise<BarberListResponse> {
    return this.withBarberListFallback(
      async () => {
        const raw = await api.get<ProviderListPayload | ServiceProvider[]>(
          '/providers',
          this.normalizeFilters({
            ...filters,
            lat: latitude,
            lng: longitude,
            maxDistance: maxDistanceKm,
          }),
        );
        if (Array.isArray(raw)) {
          return this.toListResponse(raw.map(mapServiceProviderToBarber));
        }
        if (Array.isArray(raw?.data)) {
          return this.toListResponse(raw.data.map(mapServiceProviderToBarber), raw);
        }
        return this.toListResponse([]);
      },
      () => barberService.getBarbersByLocation(latitude, longitude, filters, maxDistanceKm),
    );
  }

  async getProviderById(id: string): Promise<Barber> {
    try {
      const provider = await api.get<ServiceProvider>(`/providers/${id}`);
      return mapServiceProviderToBarber(provider);
    } catch (error) {
      console.warn('[ProviderService] /providers/:id failed; falling back to /barbers/:id', error);
      return barberService.getBarberById(id);
    }
  }
}

export default new ProviderService();
