import type { BarberConnectStatus } from '../services/barber-connect.service';

/** All checklist rows must be complete before the provider dashboard is usable. */
export function isBarberStripeFullyConnected(
  status: BarberConnectStatus | null | undefined
): boolean {
  if (!status) return false;
  return Boolean(
    status.has_account &&
      status.detailsSubmitted &&
      status.chargesEnabled &&
      status.payoutsEnabled &&
      !status.needs_reconnect
  );
}
