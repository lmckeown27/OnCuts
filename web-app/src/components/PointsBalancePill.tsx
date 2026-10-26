import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Info, X } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBodyScrollLock } from '../hooks';

export type PointsPillKind = 'operator' | 'client';

type PointsSubPage = 'referral' | 'info';

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
const SHEET_MS = 200;

function formatPts(n: number): string {
  return n.toLocaleString();
}

/**
 * Compact header counter for OnCuts Points (operator_points / client_points).
 * Home popup + nested referral/info sheets (Block Time–style enter/exit).
 */
export default function PointsBalancePill({ kind, className = '' }: PointsBalancePillProps) {
  const user = useAuthStore((s) => s.user);
  const [balancePts, setBalancePts] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const [subPage, setSubPage] = useState<PointsSubPage | null>(null);
  const [subShouldRender, setSubShouldRender] = useState(false);
  const [subAnimating, setSubAnimating] = useState(false);

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
      setSubAnimating(false);
      setSubShouldRender(false);
      setSubPage(null);
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return;
    }
    setIsVisible(false);
    setSubAnimating(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setSubShouldRender(false);
      setSubPage(null);
    }, SHEET_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const openSubPage = useCallback((page: PointsSubPage) => {
    setSubPage(page);
    setSubShouldRender(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSubAnimating(true));
    });
  }, []);

  const closeSubPage = useCallback(() => {
    setSubAnimating(false);
    setTimeout(() => {
      setSubShouldRender(false);
      setSubPage(null);
    }, SHEET_MS);
  }, []);

  const closeAll = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (subShouldRender) {
        closeSubPage();
      } else {
        closeAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, subShouldRender, closeSubPage, closeAll]);

  if (!user) return null;

  const label = loaded ? `${formatPts(balancePts)} pts` : '… pts';
  const isOperator = kind === 'operator';
  const subTitle = subPage === 'referral' ? 'Referral' : 'About Points';

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
          className={`fixed inset-0 min-h-[100dvh] flex items-end sm:items-center justify-center z-[1100] transition-colors duration-200 ${
            isVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          role="presentation"
          onClick={closeAll}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="oncuts-points-title"
            className={`relative bg-stone-50 w-full sm:max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200 ease-out ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>

            <div className="sticky top-0 bg-brand-600 text-white px-4 sm:px-6 py-4 flex items-center justify-between z-10 shrink-0 gap-2">
              <h2 id="oncuts-points-title" className="text-2xl font-bold truncate">
                OnCuts Points
              </h2>
              <button
                type="button"
                onClick={closeAll}
                className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shrink-0"
              >
                Close
              </button>
            </div>

            <div className="relative p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4">
              <button
                type="button"
                onClick={() => openSubPage('info')}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center justify-center w-10 h-10 rounded-full border border-stone-300 bg-white text-gray-700 hover:bg-stone-100 transition-colors shadow-sm"
                aria-label="About OnCuts Points"
                title="About OnCuts Points"
              >
                <Info className="w-5 h-5" aria-hidden />
              </button>

              <div className="flex justify-center pt-2">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-3 text-center inline-block">
                  <p className="text-2xl font-semibold tabular-nums text-emerald-950">
                    {formatPts(balancePts)}{' '}
                    <span className="text-base font-medium text-emerald-800">pts</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={() => openSubPage('referral')}
                  className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Referral
                </button>
              </div>
            </div>

            {subShouldRender && subPage && (
              <div
                className={`absolute inset-0 z-40 bg-stone-50 flex flex-col overflow-hidden transition-all duration-200 ease-out ${
                  subAnimating
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'
                }`}
                role="dialog"
                aria-modal="true"
                aria-label={subTitle}
              >
                <div className="flex justify-center pt-2 pb-1 sm:hidden">
                  <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
                </div>

                <div className="px-5 pt-2 pb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-stone-200/80 shrink-0 gap-2">
                  <div className="justify-self-start">
                    <button
                      type="button"
                      onClick={closeSubPage}
                      className="p-2 -ml-2 hover:bg-stone-200/60 rounded-full transition-colors shrink-0"
                      aria-label="Back to OnCuts Points"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                  <h2 className="text-center text-lg font-semibold text-gray-900 truncate">
                    {subTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="justify-self-end p-2 hover:bg-stone-200/60 rounded-full transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 text-sm text-gray-700 leading-relaxed">
                  {subPage === 'referral' && (
                    <>
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
                    </>
                  )}

                  {subPage === 'info' && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
