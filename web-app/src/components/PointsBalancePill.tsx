import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Info } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBodyScrollLock } from '../hooks';

export type PointsPillKind = 'operator' | 'client';

type PointsPopupPage = 'home' | 'referral' | 'info';

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
 * Popup pages: home (balance), referral, and points info.
 */
export default function PointsBalancePill({ kind, className = '' }: PointsBalancePillProps) {
  const user = useAuthStore((s) => s.user);
  const [balancePts, setBalancePts] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [page, setPage] = useState<PointsPopupPage>('home');

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
      setPage('home');
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return;
    }
    setIsVisible(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setPage('home');
    }, 150);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (page !== 'home') {
          setPage('home');
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, page]);

  if (!user) return null;

  const label = loaded ? `${formatPts(balancePts)} pts` : '… pts';
  const isOperator = kind === 'operator';
  const title =
    page === 'referral' ? 'Referral' : page === 'info' ? 'About Points' : 'OnCuts Points';

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
              <div className="min-w-0 flex items-center gap-2">
                {page !== 'home' && (
                  <button
                    type="button"
                    onClick={() => setPage('home')}
                    className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors shrink-0 -ml-1"
                    aria-label="Back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 id="oncuts-points-title" className="text-2xl font-bold truncate">
                  {title}
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
              {page === 'home' && (
                <>
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-3 text-center inline-block">
                      <p className="text-2xl font-semibold tabular-nums text-emerald-950">
                        {formatPts(balancePts)}{' '}
                        <span className="text-base font-medium text-emerald-800">pts</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPage('referral')}
                      className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      Referral
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage('info')}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-stone-300 bg-white text-gray-700 hover:bg-stone-100 transition-colors shadow-sm"
                      aria-label="About OnCuts Points"
                      title="About OnCuts Points"
                    >
                      <Info className="w-5 h-5" aria-hidden />
                    </button>
                  </div>
                </>
              )}

              {page === 'referral' && (
                <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                  <p className="text-gray-600">
                    Referral on OnCuts means inviting someone to join as an operator — beauty
                    pros included (braids, nails, lashes, makeup, tanning, and more). When they
                    sign up with your invite and grow on the platform, you earn OnCuts Points.
                  </p>
                  {isOperator ? (
                    <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                      <li>Share your invite link and a unique referral code.</li>
                      <li>
                        The new operator enters your code on onboarding, applies, completes
                        setup, and takes bookings.
                      </li>
                      <li>+250 pts when they finish onboarding.</li>
                      <li>
                        +500 pts after their first 3 paid card bookings (750 pts / about $75
                        total).
                      </li>
                      <li>Points never expire.</li>
                    </ul>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                      <li>
                        You can refer operators after your own first completed booking —
                        campus or hometown.
                      </li>
                      <li>They join with your unique referral code.</li>
                      <li>+350 pts when they finish onboarding.</li>
                      <li>
                        +700 pts after their first 3 paid bookings (1,050 pts / about $105
                        total). At most one of those three can be with you.
                      </li>
                      <li>Points never expire and cannot be cashed out.</li>
                    </ul>
                  )}
                  <p className="text-xs text-gray-500 pt-1">
                    Invite links and codes are rolling out next. This page explains how
                    referral will work once live.
                  </p>
                </div>
              )}

              {page === 'info' && (
                <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">How you earn points</p>
                    {isOperator ? (
                      <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                        <li>Refer another operator with your invite link and code.</li>
                        <li>+250 pts when they finish onboarding.</li>
                        <li>
                          +500 pts after their first 3 paid card bookings (750 pts total).
                        </li>
                        <li>Points never expire.</li>
                      </ul>
                    ) : (
                      <ul className="list-disc pl-4 space-y-1.5 text-gray-600">
                        <li>After your first completed booking, you can refer operators.</li>
                        <li>+350 pts when they finish onboarding.</li>
                        <li>
                          +700 pts after their first 3 paid bookings (1,050 pts total).
                        </li>
                        <li>Points never expire and cannot be cashed out.</li>
                      </ul>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">What you can use them for</p>
                    {isOperator ? (
                      <p className="text-gray-600">
                        Apply points as a platform kickback on a completed, paid booking (up
                        to 100% of the service price). {PTS_PER_DOLLAR} pts = $1. Your
                        client&apos;s price stays the same; the kickback is added to your next
                        payout.
                      </p>
                    ) : (
                      <p className="text-gray-600">
                        At checkout, use points for dollars off the service price (not the
                        tip) with any operator — {PTS_PER_DOLLAR} pts = $1.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
