import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Info, X } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useFrontendConfig } from '../hooks/useFrontendConfig';
import { useBodyScrollLock } from '../hooks';

type RewardsMe = {
  kind: 'operator' | 'client';
  pointsPerDollar: number;
  balancePts: number;
  balanceDollars: number;
  lifetimeEarnedPts: number;
  lifetimeEarnedDollars: number;
  lifetimeSpentPts: number;
  pendingPts: number;
  pendingDollars: number;
  empty: boolean;
  history: Array<{
    id: string;
    deltaPts: number;
    reason: string;
    createdAt: string;
    availableAt: string;
  }>;
};

type ReferralAttribution = {
  id: string;
  displayName: string;
  check1At: string | null;
  check2Status: string;
  qualifyingBookingCount: number;
  m2AwardedAt: string | null;
};

interface RewardsModalProps {
  open: boolean;
  visible: boolean;
  onClose: () => void;
  onOpenReferrals?: () => void;
}

function toPascalCaseWords(label: string): string {
  return label.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function formatPointsReason(reason: string): string {
  if (reason === 'referral_m1') return 'Referral Onboarding';
  if (reason === 'referral_m2') return 'Referral Bookings (3 Paid)';
  if (reason === 'referral_m2_clawback') return 'Referral Bookings Revokal';
  return toPascalCaseWords(
    reason
      .replace(/_/g, ' ')
      .replace(/\bgrant\b/gi, 'gift')
      .replace(/\bclawback\b/gi, 'revokal'),
  );
}

function formatOperatorOnboardingStatus(a: ReferralAttribution): string {
  if (a.check2Status === 'passed') return 'Complete';
  if (a.check2Status === 'admin_review') return 'In review';
  if (a.check2Status === 'failed') return 'Failed';
  if (a.check1At) return 'In progress';
  return 'Pending';
}

/** Still earning toward M2 (or still finishing onboarding). */
function isActiveReferralProgress(a: ReferralAttribution): boolean {
  if (a.m2AwardedAt) return false;
  if (a.check2Status === 'failed') return false;
  return true;
}

export default function RewardsModal({
  open,
  visible,
  onClose,
  onOpenReferrals,
}: RewardsModalProps) {
  const user = useAuthStore((s) => s.user);
  const { pointsVisible } = useFrontendConfig();
  const kind =
    user?.user_type === 'barber' || user?.user_type === 'admin' || user?.is_admin
      ? 'operator'
      : 'client';
  const [data, setData] = useState<RewardsMe | null>(null);
  const [onboarding, setOnboarding] = useState<ReferralAttribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useBodyScrollLock(open);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rewards, referrals] = await Promise.all([
        api.get<RewardsMe>('/referrals/rewards/me', { kind }),
        api.get<{ attributions: ReferralAttribution[] }>('/referrals/me'),
      ]);
      setData(rewards);
      setOnboarding((referrals.attributions || []).filter(isActiveReferralProgress));
    } catch (e: any) {
      setOnboarding([]);
      setError(e?.message || 'Could not load rewards');
    }
  }, [kind]);

  useEffect(() => {
    if (!open || !user || !pointsVisible) return;
    setShowInfo(false);
    void load();
  }, [open, user, pointsVisible, load]);

  const ptsPerDollar = data?.pointsPerDollar ?? 10;

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[1100] min-h-[100dvh] flex items-end sm:items-center justify-center transition-colors duration-200 ${
        visible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-stone-50 w-full sm:max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out ${
          visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Rewards"
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
        </div>
        <div className="relative z-[80] bg-stone-50 px-4 sm:px-5 py-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-stone-200/80 shrink-0">
          <div className="justify-self-start">
            {showInfo ? (
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="p-2 -ml-2 hover:bg-stone-200/60 rounded-full transition-colors"
                aria-label="Back to Rewards"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" aria-hidden />
              </button>
            ) : (
              onOpenReferrals && (
                <button
                  type="button"
                  onClick={onOpenReferrals}
                  className="min-w-[8rem] px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Referral Code
                </button>
              )
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center">
            {showInfo ? 'About rewards' : 'Rewards'}
          </h2>
          <div className="justify-self-end flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className={`p-2 rounded-full transition-colors ${
                showInfo ? 'bg-stone-200/80 text-gray-900' : 'hover:bg-stone-200/60 text-gray-600'
              }`}
              aria-label={showInfo ? 'Hide rewards details' : 'About rewards'}
              aria-pressed={showInfo}
              title="About rewards"
            >
              <Info className="w-5 h-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-stone-200/60 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">
          {showInfo ? (
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">How OnCuts Points work</p>
                <p className="text-gray-600">
                  {ptsPerDollar} pts = $1. Points never expire.
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">How you earn</p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                  <li>Share your referral code with operators you know.</li>
                  <li>Earn points when they pass Check 2 and complete qualifying bookings.</li>
                  <li>
                    Track onboarding operators and your points history on this Rewards screen.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">How you spend</p>
                {kind === 'operator' ? (
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                    <li>
                      Apply points to a completed booking to{' '}
                      <strong>earn a kickback</strong> from OnCuts
                    </li>
                    <li>
                      If a client pays $30 for a service, apply 100 points to{' '}
                      <strong>receive $10 from OnCuts</strong>
                    </li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                    <li>
                      <strong>Earn discounts</strong> on bookings that will be covered by OnCuts
                    </li>
                    <li>
                      If a service costs $30, apply 100 points to{' '}
                      <strong>receive $10 off of your service</strong>. Don&apos;t worry, that $10
                      still goes to the operator complementary of OnCuts
                    </li>
                  </ul>
                )}
              </div>
            </div>
          ) : !user ? (
            <p className="text-sm text-gray-600">Sign in to view rewards.</p>
          ) : !pointsVisible ? (
            <p className="text-sm text-gray-600">Points are currently hidden.</p>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              {data?.empty && onboarding.length === 0 && (
                <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center space-y-3">
                  <p className="text-gray-700">
                    No points yet. Refer an operator to start earning.
                  </p>
                  {onOpenReferrals && (
                    <button
                      type="button"
                      onClick={onOpenReferrals}
                      className="inline-flex px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
                    >
                      Go to Referral Code
                    </button>
                  )}
                </div>
              )}

              {data && !data.empty && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                  <p className="text-3xl font-semibold tabular-nums text-emerald-950">
                    {data.balancePts.toLocaleString()} pts
                  </p>
                  <p className="text-sm text-emerald-800 mt-1">
                    ≈ ${data.balanceDollars.toFixed(2)} ({data.pointsPerDollar} pts = $1)
                  </p>
                </div>
              )}

              {onboarding.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Referral progress
                  </h3>
                  {onboarding.map((a) => {
                    const bookings = Math.min(
                      3,
                      Math.max(0, Number(a.qualifyingBookingCount) || 0)
                    );
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-stone-200 bg-white p-4 space-y-3"
                      >
                        <p className="font-medium text-gray-900">{a.displayName}</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Operator Onboarding
                            </p>
                            <p className="font-semibold text-gray-900 mt-1">
                              {formatOperatorOnboardingStatus(a)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Operator Bookings
                            </p>
                            <p className="font-semibold text-gray-900 mt-1 tabular-nums">
                              {bookings}/3
                            </p>
                            <div className="mt-2 flex gap-1.5" aria-hidden>
                              {[1, 2, 3].map((n) => (
                                <span
                                  key={n}
                                  className={`h-1.5 flex-1 rounded-full ${
                                    bookings >= n ? 'bg-brand-600' : 'bg-stone-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {data && !data.empty && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    History
                  </h3>
                  {data.history.length === 0 && (
                    <p className="text-sm text-gray-500">No ledger entries yet.</p>
                  )}
                  {data.history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatPointsReason(h.reason)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(h.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <p
                        className={`font-semibold tabular-nums ${
                          h.deltaPts >= 0 ? 'text-emerald-700' : 'text-gray-800'
                        }`}
                      >
                        {h.deltaPts >= 0 ? '+' : ''}
                        {h.deltaPts.toLocaleString()} pts
                      </p>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
