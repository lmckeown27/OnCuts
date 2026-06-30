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

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!enabled) {
      setIsLoading(false);
      return null;
    }
    try {
      if (!silent) setIsLoading(true);
      setLoadError(false);
      const next = await fetchBarberConnectStatus();
      setStatus(next);
      return next;
    } catch {
      setLoadError(true);
      setStatus(null);
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
  /** Block dashboard until Connect is complete (includes initial status fetch). */
  const isBlocking = enabled && !isFullyConnected;

  return {
    status,
    isLoading,
    loadError,
    isFullyConnected,
    isBlocking,
    refresh,
  };
}
