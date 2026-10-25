import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';

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

/**
 * Compact header counter for OnCuts Points (operator_points / client_points).
 * Shows 0 until earn/spend creates an account row.
 */
export default function PointsBalancePill({ kind, className = '' }: PointsBalancePillProps) {
  const user = useAuthStore((s) => s.user);
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

  if (!user) return null;

  const label = loaded ? `${balancePts.toLocaleString()} pts` : '… pts';

  return (
    <div
      className={`inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 shrink-0 ${className}`}
      title="OnCuts Points"
      aria-label={`${label} OnCuts Points`}
    >
      <span className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">{label}</span>
    </div>
  );
}
