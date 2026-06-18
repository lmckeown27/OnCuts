import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';

export interface BarberPayoutStatus {
  payout_ready: boolean;
  sui_address: string | null;
  invalid_stored_address: boolean;
  stored_address_preview: string | null;
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''}` };
}

export async function fetchBarberPayoutStatus(): Promise<BarberPayoutStatus> {
  const res = await axios.get<{ success: boolean; data: BarberPayoutStatus }>(
    `${API_BASE_URL}/barber/payout/status`,
    { headers: authHeader() }
  );
  return res.data.data;
}

export interface BarberPayoutSummary {
  has_barber_profile: boolean;
  ledger_total_dollars: number;
  ledger_pending_dollars: number;
  ledger_paid_out_dollars: number;
  booking_estimated_barber_cents: number;
  paid_bookings_count: number;
  recent_30d_barber_cents: number;
  display_total_dollars: number;
  gross_volume_cents: number;
  tips_cents: number;
  avg_take_home_cents: number;
  completed_bookings_count: number;
  cancelled_bookings_count: number;
  pending_requests_count: number;
  accepted_upcoming_count: number;
  unique_clients_count: number;
  repeat_client_pct: number;
  completion_rate_pct: number;
  avg_rating: number;
  total_reviews: number;
}

export async function fetchBarberPayoutSummary(): Promise<BarberPayoutSummary> {
  const res = await axios.get<{ success: boolean; data: BarberPayoutSummary }>(
    `${API_BASE_URL}/barber/payout/summary`,
    { headers: authHeader() }
  );
  return res.data.data;
}

export type BarberMetricsPeriod = '1w' | '4w' | '1y' | 'mtd' | 'qtd' | 'ytd' | 'all';

export interface BarberMetricsDataPoint {
  date: string;
  bookings: number;
  revenue: number;
  clients: number;
}

export interface BarberMetricsResponse {
  period: string;
  data: BarberMetricsDataPoint[];
  totalClients: number;
}

export interface BarberPerformance {
  has_barber_profile: boolean;
  totalRevenue: number;
  totalBarberEarnings: number;
  totalPlatformFees: number;
  totalTips: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingRequests: number;
  acceptedUpcoming: number;
  uniqueClients: number;
  repeatClientPct: number;
  completionRatePct: number;
  cardRevenue: number;
  cardCount: number;
  cardTips: number;
  cashRevenue: number;
  cashCount: number;
  cashTips: number;
  averageRating: number;
  totalReviews: number;
  averageBookingsPerDay: number;
  averageBookingsPerWeek: number;
  averageBookingsPerMonth: number;
  averageRevenuePerDay: number;
  averageRevenuePerWeek: number;
  averageRevenuePerMonth: number;
  averageCostPerAppointment: number;
  averageTakeHomePerAppointment: number;
}

export async function fetchBarberMetrics(period: BarberMetricsPeriod): Promise<BarberMetricsResponse> {
  const res = await axios.get<{ success: boolean; period: string; data: BarberMetricsDataPoint[]; totalClients: number }>(
    `${API_BASE_URL}/barber/payout/metrics`,
    { headers: authHeader(), params: { period } }
  );
  return {
    period: res.data.period,
    data: res.data.data,
    totalClients: res.data.totalClients,
  };
}

export async function fetchBarberPerformance(): Promise<BarberPerformance> {
  const res = await axios.get<{ success: boolean; data: BarberPerformance }>(
    `${API_BASE_URL}/barber/payout/performance`,
    { headers: authHeader() }
  );
  return res.data.data;
}

export interface BarberClientSummary {
  consumer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  total_booking_count: number;
  paid_booking_count: number;
  total_paid_cents: number;
  last_booking_at: string | null;
  avg_review_rating: number;
  review_count: number;
  is_repeat: boolean;
}

export interface BarberClientBooking {
  id: string;
  service_type: string;
  price_cents: number;
  tip_cents: number;
  total_paid_cents: number | null;
  status: string;
  payment_method: string | null;
  scheduled_time: string;
  created_at: string;
  paid_at: string | null;
  review_rating: number | null;
  review_text: string | null;
}

export async function fetchBarberClients(): Promise<BarberClientSummary[]> {
  const res = await axios.get<{ success: boolean; data: { clients: BarberClientSummary[] } }>(
    `${API_BASE_URL}/barber/payout/clients`,
    { headers: authHeader() }
  );
  return res.data.data.clients || [];
}

export async function fetchBarberClientBookings(consumerId: string): Promise<BarberClientBooking[]> {
  const res = await axios.get<{ success: boolean; data: { bookings: BarberClientBooking[] } }>(
    `${API_BASE_URL}/barber/payout/clients/${consumerId}/bookings`,
    { headers: authHeader() }
  );
  return res.data.data.bookings || [];
}
