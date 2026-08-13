/**
 * Cached public platform frontend config (cash payments, consumer home mode).
 * Defaults to cash off / providers mode if the fetch fails.
 */

import { useEffect, useState } from 'react';
import api from '../services/api.service';

export type ConsumerHomeMode = 'providers' | 'waitlist';

export type FeeBurden = 'operator' | 'client';

export interface FrontendConfig {
  cashPaymentEnabled: boolean;
  consumerHomeMode: ConsumerHomeMode;
  consumerUserCount: number;
  platformFeePercent: number;
  platformCommissionEnabled: boolean;
  feeBurden: FeeBurden;
}

const DEFAULT_CONFIG: FrontendConfig = {
  cashPaymentEnabled: false,
  consumerHomeMode: 'providers',
  consumerUserCount: 0,
  platformFeePercent: 15,
  platformCommissionEnabled: true,
  feeBurden: 'operator',
};

let cachedConfig: FrontendConfig | null = null;
let inflight: Promise<FrontendConfig> | null = null;

async function fetchFrontendConfig(): Promise<FrontendConfig> {
  if (cachedConfig) return cachedConfig;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const data = await api.get<{
        cashPaymentEnabled?: boolean;
        consumerHomeMode?: string;
        consumerUserCount?: number;
        platformFeePercent?: number;
        platformCommissionEnabled?: boolean;
        feeBurden?: string;
      }>('/platform/frontend-config');
      const percent = Number(data?.platformFeePercent);
      const next: FrontendConfig = {
        cashPaymentEnabled: data?.cashPaymentEnabled === true,
        consumerHomeMode: data?.consumerHomeMode === 'waitlist' ? 'waitlist' : 'providers',
        consumerUserCount: Math.max(0, Number(data?.consumerUserCount) || 0),
        platformFeePercent: Number.isFinite(percent) ? percent : 15,
        platformCommissionEnabled: data?.platformCommissionEnabled !== false,
        feeBurden: data?.feeBurden === 'client' ? 'client' : 'operator',
      };
      cachedConfig = next;
      return next;
    } catch {
      // Do not cache failures — allow a later remount/retry to pick up a live count.
      return { ...DEFAULT_CONFIG };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Clear cache after Admin saves Controls (optional). */
export function invalidateFrontendConfigCache(): void {
  cachedConfig = null;
}

export function useFrontendConfig(): FrontendConfig & { isLoading: boolean } {
  const [config, setConfig] = useState<FrontendConfig>(cachedConfig ?? DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(!cachedConfig);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(!cachedConfig);
    void fetchFrontendConfig().then((next) => {
      if (!cancelled) {
        setConfig(next);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...config, isLoading };
}
