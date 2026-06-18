import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';

export type CampusMetricsPeriod = 'daily' | 'weekly' | 'monthly';

export interface CampusMetricsDataPoint {
  date: string;
  bookings: number;
  revenue: number;
  users: number;
}

export interface CampusMetricsResponse {
  period: string;
  data: CampusMetricsDataPoint[];
  totalUsers: number;
}

export interface CampusManagerPerformance {
  totalBarbers: number;
  activeBarbers: number;
  totalConsumers: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  totalTips: number;
  cardRevenue: number;
  cardCount: number;
  cashRevenue: number;
  cashCount: number;
  averageRating: number;
  totalReviews: number;
  completionRatePct: number;
  averageBookingsPerDay: number;
  averageBookingsPerWeek: number;
  averageBookingsPerMonth: number;
  averageRevenuePerDay: number;
  averageRevenuePerWeek: number;
  averageRevenuePerMonth: number;
  averageCostPerAppointment: number;
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''}` };
}

export async function fetchCampusManagerPerformance(campusId: string): Promise<CampusManagerPerformance> {
  const res = await axios.get<{ success: boolean; data: CampusManagerPerformance }>(
    `${API_BASE_URL}/campus-manager/campus/${campusId}/performance`,
    { headers: authHeader() }
  );
  return res.data.data;
}

export async function fetchCampusManagerMetrics(
  campusId: string,
  period: CampusMetricsPeriod
): Promise<CampusMetricsResponse> {
  const res = await axios.get<{
    success: boolean;
    period: string;
    data: CampusMetricsDataPoint[];
    totalUsers: number;
  }>(`${API_BASE_URL}/campus-manager/campus/${campusId}/metrics`, {
    headers: authHeader(),
    params: { period },
  });
  return {
    period: res.data.period,
    data: res.data.data,
    totalUsers: res.data.totalUsers,
  };
}
