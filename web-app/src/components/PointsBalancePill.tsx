import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBodyScrollLock } from '../hooks';

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

const PTS_PER_DOLLAR = 10;

function formatPts(n: number): string {
  return n.toLocaleString();
}

/**
 * Compact header counter for OnCuts Points (operator_points / client_points).
 * Opens an info popup with balance details and program basics.
 */
export default function PointsBalancePill({ kind, className = '' }: PointsBalancePillProps) {
  const user = useAuthStore((s) => s.user);
  const [balancePts, setBalancePts] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useBodyScrollLock(open);

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
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return;
    }
    setIsVisible(false);
    const timer = setTimeout(() => setShouldRender(false), 150);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  const label = loaded ? `${formatPts(balancePts)} pts` : '… pts';
  const isOperator = kind === 'operator';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 shrink-0 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-1 ${className}`}
        title="OnCuts Points"
        aria-label={`${label} OnCuts Points`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">{label}</span>
      </button>

      {shouldRender && (
        <div
          className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-[1100] p-2 sm:p-4 transition-all duration-150 ease-out ${
            isVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="oncuts-points-title"
            className={`bg-stone-50 rounded-2xl shadow-2xl max-w-lg w-full max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-all duration-150 ease-out ${
              isVisible
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-brand-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between z-30 shrink-0 gap-2">
              <div className="min-w-0">
                <h2 id="oncuts-points-title" className="text-2xl font-bold">
                  OnCuts Points
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shrink-0"
              >
                Close
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4">
              <div className="flex justify-center">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-3 text-center inline-block">
                  <p className="text-2xl font-semibold tabular-nums text-emerald-950">
                    {formatPts(balancePts)}{' '}
                    <span className="text-base font-medium text-emerald-800">pts</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900">How you earn</p>
                {isOperator ? (
                  <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                    <li>Refer another operator with your invite link and code.</li>
                    <li>+250 pts when they finish onboarding.</li>
                    <li>+500 pts after their first 3 paid card bookings (750 pts total).</li>
                    <li>Points never expire.</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                    <li>After your first completed booking, you can refer operators.</li>
                    <li>+350 pts when they finish onboarding.</li>
                    <li>+700 pts after their first 3 paid bookings (1,050 pts total).</li>
                    <li>Points never expire and cannot be cashed out.</li>
                  </ul>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900">How you use them</p>
                {isOperator ? (
                  <p className="text-gray-600">
                    Apply points as a platform kickback on a completed, paid booking (up to
                    100% of the service price). Your client's price stays the same; the
                    kickback is added to your next payout.
                  </p>
                ) : (
                  <p className="text-gray-600">
                    At checkout, use points for $ off the service price (not the tip) with
                    any operator — {PTS_PER_DOLLAR} pts = $1.
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
