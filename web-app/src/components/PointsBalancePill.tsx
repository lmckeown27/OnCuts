import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useFrontendConfig } from '../hooks/useFrontendConfig';
import {
  POINTS_BALANCE_CHANGED_EVENT,
  type PointsBalanceChangedDetail,
} from '../utils/pointsBalanceEvents';
import { notifyOpenRewards } from '../utils/referralsRewardsEvents';

export type PointsPillKind = 'operator' | 'client';

interface MyPointsBalance {
  kind: PointsPillKind;
  balancePts: number;
  lifetimeEarnedPts: number;
  lifetimeSpentPts: number;
  hasAccount: boolean;
}

interface PointsBalancePillProps {
  kind: PointsPillKind;
  className?: string;
}

function formatPts(n: number): string {
  return n.toLocaleString();
}

/**
 * Compact header counter for OnCuts Points (operator_points / client_points).
 * Opens the Rewards popup on click.
 */
export default function PointsBalancePill({ kind, className = '' }: PointsBalancePillProps) {
  const user = useAuthStore((s) => s.user);
  const { pointsVisible } = useFrontendConfig();
  const [balancePts, setBalancePts] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBalancePts(0);
      setLoaded(false);
      return;
    }
    try {
      const data = await api.get<MyPointsBalance>('/points/me', { kind });
      setBalancePts(typeof data?.balancePts === 'number' ? data.balancePts : 0);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load points balance', err);
      setBalancePts(0);
      setLoaded(true);
    }
  }, [user?.id, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<PointsBalanceChangedDetail>).detail;
      if (!detail?.userId || detail.userId !== user.id) return;
      if (detail.kind && detail.kind !== kind) return;
      if (typeof detail.balancePts === 'number' && Number.isFinite(detail.balancePts)) {
        setBalancePts(detail.balancePts);
        setLoaded(true);
        return;
      }
      void load();
    };
    window.addEventListener(POINTS_BALANCE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(POINTS_BALANCE_CHANGED_EVENT, onChanged);
  }, [user?.id, kind, load]);

  if (!user || !pointsVisible) return null;

  const label = loaded ? `${formatPts(balancePts)} pts` : '… pts';

  return (
    <button
      type="button"
      onClick={() => notifyOpenRewards()}
      className={`inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 shrink-0 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-1 ${className}`}
      title="OnCuts Points"
      aria-label={`${label} OnCuts Points`}
      aria-haspopup="dialog"
    >
      <span className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">{label}</span>
    </button>
  );
}
