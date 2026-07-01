import api from './api.service';

export interface BarberConnectStatus {
  has_account: boolean;
  account_id?: string;
  needs_reconnect?: boolean;
  stale_account_cleared?: boolean;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

export async function resetBarberConnect(): Promise<{
  account_id: string;
  onboarding_url: string;
  previous_account_id?: string;
}> {
  return api.post('/barber/connect/reset', {});
}

export async function fetchBarberConnectStatus(): Promise<BarberConnectStatus> {
  return api.get<BarberConnectStatus>('/barber/connect/status');
}

export async function createBarberConnectOnboarding(): Promise<{ account_id: string; onboarding_url: string }> {
  return api.post('/barber/connect/create', {});
}

export async function refreshBarberConnectOnboarding(): Promise<{ onboarding_url: string }> {
  return api.post('/barber/connect/refresh', {});
}

export async function fetchBarberStripeDashboardUrl(): Promise<string> {
  const data = await api.get<{ dashboard_url: string }>('/barber/connect/dashboard');
  return data.dashboard_url;
}
