import { useCallback, useEffect, useState } from 'react';
import {
  fetchBarberConnectStatus,
  type BarberConnectStatus,
} from '../services/barber-connect.service';
import { isBarberStripeFullyConnected } from '../utils/stripe-connect-status';

type UseStripeOnboardingGateOptions = {
  /** When false, skip fetch and never block (e.g. auth still loading). */
  enabled?: boolean;
};

export function useStripeOnboardingGate(options: UseStripeOnboardingGateOptions = {}) {
  const { enabled = true } = options;
  const [status, setStatus] = useState<BarberConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState(false);
  /** True after at least one successful status fetch while enabled. */
  const [hasResolvedStatus, setHasResolvedStatus] = useState(false);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!enabled) {
      setIsLoading(false);
      setHasResolvedStatus(false);
      setStatus(null);
      return null;
    }
    try {
      if (!silent) setIsLoading(true);
      setLoadError(false);
      const next = await fetchBarberConnectStatus();
      setStatus(next);
      setHasResolvedStatus(true);
      return next;
    } catch {
      setLoadError(true);
      // Keep prior status on silent refresh failure so a connected user isn't
      // briefly treated as unresolved / a blocked user isn't flicked off.
      if (!silent) {
        setStatus(null);
        setHasResolvedStatus(false);
      }
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ silent: true });
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const isFullyConnected = isBarberStripeFullyConnected(status);
  /**
   * Only surface the onboarding guide after Connect status is known and incomplete.
   * While the check runs in the background (or fails), do not block or show the modal.
   */
  const isBlocking = enabled && hasResolvedStatus && !isFullyConnected;

  return {
    status,
    isLoading,
    loadError,
    hasResolvedStatus,
    isFullyConnected,
    isBlocking,
    refresh,
  };
}
