import api from './api.service';
import type { Campus, PaginatedResponse, Barber } from '../types';

class CampusService {
  async getCampuses(search?: string): Promise<Campus[]> {
    // api.get extracts response.data.data when no pagination is present
    // so the response is already the campuses array
    // No limit - fetch all universities in the system
    const campuses = await api.get<Campus[]>('/campus', { search });
    return campuses || [];
  }

  async getCampusById(id: string): Promise<Campus> {
    return await api.get<Campus>(`/campus/${id}`);
  }

  async getCampusBarbers(campusId: string, filters?: any): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>(`/campus/${campusId}/barbers`, filters);
  }
}

export default new CampusService();

