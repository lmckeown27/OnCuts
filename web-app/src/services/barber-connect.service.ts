import api from './api.service';

export interface StripePayoutSchedule {
  interval: string;
  delayDays: number | null;
  weeklyAnchor: string | null;
  monthlyAnchor: number | null;
}

export interface BarberConnectStatus {
  has_account: boolean;
  account_id?: string;
  needs_reconnect?: boolean;
  stale_account_cleared?: boolean;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  payoutSchedule?: StripePayoutSchedule;
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Mondays',
  tuesday: 'Tuesdays',
  wednesday: 'Wednesdays',
  thursday: 'Thursdays',
  friday: 'Fridays',
  saturday: 'Saturdays',
  sunday: 'Sundays',
};

function ordinalDay(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Plain-language explanation of why Stripe Connect funds are not instant.
 */
export function formatPayoutScheduleClarity(
  schedule?: StripePayoutSchedule | null
): string {
  const fallback =
    'Payouts are not instant. Card payments settle in Stripe first, then go to your bank on Stripe’s schedule. Open Stripe Express for exact timing.';

  if (!schedule?.interval) {
    return fallback;
  }

  const interval = schedule.interval.toLowerCase();
  const delay =
    typeof schedule.delayDays === 'number' && schedule.delayDays >= 0
      ? schedule.delayDays
      : null;

  if (interval === 'manual') {
    return 'Payouts are manual — open Stripe Express to send funds to your bank. Card payments are not deposited automatically.';
  }

  if (interval === 'daily') {
    if (delay != null && delay > 0) {
      return `Stripe usually makes payouts available to your bank on a daily schedule (about ${delay} business day${delay === 1 ? '' : 's'} after funds clear). Card payments are not instant.`;
    }
    return 'Stripe usually pays available funds to your bank on a daily schedule after card payments clear. Card payments are not instant.';
  }

  if (interval === 'weekly') {
    const dayKey = (schedule.weeklyAnchor || '').toLowerCase();
    const dayLabel = WEEKDAY_LABELS[dayKey];
    if (dayLabel) {
      return `Stripe pays out to your bank weekly (${dayLabel}), after card payments clear. This is not instant.`;
    }
    return 'Stripe pays out to your bank weekly, after card payments clear. This is not instant.';
  }

  if (interval === 'monthly') {
    const anchor = schedule.monthlyAnchor;
    if (typeof anchor === 'number' && anchor >= 1 && anchor <= 31) {
      return `Stripe pays out to your bank monthly (on the ${ordinalDay(anchor)}), after card payments clear. This is not instant.`;
    }
    return 'Stripe pays out to your bank monthly, after card payments clear. This is not instant.';
  }

  return fallback;
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
