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
