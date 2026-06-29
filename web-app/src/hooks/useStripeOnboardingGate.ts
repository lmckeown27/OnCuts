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

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return null;
    }
    try {
      setIsLoading(true);
      setLoadError(false);
      const next = await fetchBarberConnectStatus();
      setStatus(next);
      return next;
    } catch {
      setLoadError(true);
      setStatus(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
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
