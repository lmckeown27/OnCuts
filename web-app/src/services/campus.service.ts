import api from './api.service';
import type { Campus, PaginatedResponse, Barber } from '../types';

class CampusService {
  async getCampuses(search?: string): Promise<Campus[]> {
    const response = await api.get<PaginatedResponse<Campus>>('/campus', { search, limit: 100 });
    return response.data;
  }

  async getCampusById(id: string): Promise<Campus> {
    return await api.get<Campus>(`/campus/${id}`);
  }

  async getCampusBarbers(campusId: string, filters?: any): Promise<PaginatedResponse<Barber>> {
    return await api.get<PaginatedResponse<Barber>>(`/campus/${campusId}/barbers`, filters);
  }
}

export default new CampusService();

