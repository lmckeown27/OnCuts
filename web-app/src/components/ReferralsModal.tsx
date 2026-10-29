import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Copy, Eye, EyeOff, Info, MessageSquare, RefreshCw, X } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useFrontendConfig } from '../hooks/useFrontendConfig';
import { useBodyScrollLock } from '../hooks';

type Attribution = {
  id: string;
  displayName: string;
  check1At: string;
  check2Status: string;
  qualifyingBookingCount: number;
  m1AwardedAt: string | null;
  m2HoldUntil: string | null;
  m2AwardedAt: string | null;
};

type CodeRequest = {
  id: string;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};

type ReferralMe = {
  canRefer: boolean;
  referrerKind: 'operator' | 'client';
  pointsPerDollar: number;
  code: {
    masked: string;
    createdAt: string;
    useCount: number;
    lastUsedAt: string | null;
    usesThisMonth: number;
    maxUsesPerMonth: number;
  } | null;
  history: Array<{
    code: string;
    createdAt: string;
    retiredAt: string;
    useCount: number;
    lastUsedAt: string | null;
  }>;
  attributions: Attribution[];
  codeRequests: CodeRequest[];
  rewardsHint: { m1: number; m2: number; total: number };
};

interface ReferralsModalProps {
  open: boolean;
  visible: boolean;
  onClose: () => void;
  onOpenRewards?: () => void;
}

export default function ReferralsModal({
  open,
  visible,
  onClose,
  onOpenRewards,
}: ReferralsModalProps) {
  const user = useAuthStore((s) => s.user);
  const { pointsVisible } = useFrontendConfig();
  const [data, setData] = useState<ReferralMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useBodyScrollLock(open);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<ReferralMe>('/referrals/me');
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load referrals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    setRevealed(null);
    setShowInfo(false);
    void load();
  }, [open, user, load]);

  const reveal = async () => {
    try {
      setBusy(true);
      const res = await api.post<{ code: string }>('/referrals/codes/reveal', {});
      setRevealed(res.code);
    } catch (e: any) {
      setError(e?.message || 'Could not reveal code');
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm('Rotate your code? The old code stops working immediately.')) return;
    try {
      setBusy(true);
      const res = await api.post<{ code: string }>('/referrals/codes/rotate', {});
      setRevealed(res.code);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not rotate code');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    const code = revealed || data?.code?.masked;
    if (!code || code.includes('•')) {
      await reveal();
      return;
    }
    await navigator.clipboard.writeText(code);
  };

  const textCode = async () => {
    let code = revealed;
    if (!code) {
      const res = await api.post<{ code: string }>('/referrals/codes/reveal', {});
      code = res.code;
      setRevealed(code);
    }
    const applyUrl = `${window.location.origin}/?apply=1&ref=${encodeURIComponent(code)}`;
    const body = encodeURIComponent(
      `Join OnCuts with my referral code: ${code}. Apply here: ${applyUrl}`
    );
    window.open(`sms:?&body=${body}`, '_blank');
  };

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
        aria-label="Referral Code"
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
                aria-label="Back to Referral Code"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" aria-hidden />
              </button>
            ) : (
              pointsVisible &&
              onOpenRewards && (
                <button
                  type="button"
                  onClick={onOpenRewards}
                  className="min-w-[8rem] px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Rewards
                </button>
              )
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center">
            {showInfo ? 'About referrals' : 'Referral Code'}
          </h2>
          <div className="justify-self-end flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className={`p-2 rounded-full transition-colors ${
                showInfo ? 'bg-stone-200/80 text-gray-900' : 'hover:bg-stone-200/60 text-gray-600'
              }`}
              aria-label={showInfo ? 'Hide referral details' : 'About the referral system'}
              aria-pressed={showInfo}
              title="About the referral system"
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
                <p className="font-semibold text-gray-900">How referrals work</p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                  <li>
                    Share your referral code with operators you know — barbers and beauty
                    professionals.
                  </li>
                  <li>
                    When they apply with your code, the referral is locked to you.
                  </li>
                  <li>
                    Check 1 passes when OnCuts approves their operator application.
                  </li>
                  <li>
                    Check 2 runs when they finish Stripe Connect onboarding and verification.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">How you earn points</p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                  <li>
                    +
                    {(data?.rewardsHint.m1 ?? 0).toLocaleString()} pts when Check 2 passes
                    (Milestone 1)
                  </li>
                  <li>
                    +
                    {(data?.rewardsHint.m2 ?? 0).toLocaleString()} pts after they complete 3
                    qualifying paid bookings (Milestone 2)
                  </li>
                  <li>
                    Up to {(data?.rewardsHint.total ?? 0).toLocaleString()} pts total per
                    successful referral
                  </li>
                  <li>Points never expire.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-gray-900">Your code</p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                  <li>Reveal, copy, or text your code from this screen.</li>
                  <li>Rotate anytime if you need a fresh code (old codes stop working).</li>
                </ul>
              </div>
            </div>
          ) : !user ? (
            <p className="text-sm text-gray-600">Sign in to view referrals.</p>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              {loading && <p className="text-sm text-gray-500">Loading…</p>}

              {!loading && data && !data.canRefer && (
                <div className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-gray-700">
                  Complete your first booking to unlock referring operators.
                </div>
              )}

              {!loading && data?.canRefer && data.code && (
                <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Referral code
                    </h3>
                    {data.code.maxUsesPerMonth > 0 && (
                      <p className="text-xs text-gray-500">
                        {data.code.usesThisMonth}/{data.code.maxUsesPerMonth} uses this month
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-2xl font-semibold tracking-widest text-gray-900 tabular-nums">
                      {revealed || data.code.masked}
                    </code>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => (revealed ? setRevealed(null) : void reveal())}
                      className="p-2 rounded-lg hover:bg-stone-100"
                      aria-label={revealed ? 'Hide code' : 'Show code'}
                    >
                      {revealed ? (
                        <EyeOff className="w-5 h-5" aria-hidden />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void copyCode()}
                      className="p-2 rounded-lg hover:bg-stone-100"
                      aria-label="Copy code"
                    >
                      <Copy className="w-5 h-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rotate()}
                      className="p-2 rounded-lg hover:bg-stone-100"
                      aria-label="Rotate code"
                      title="Rotate code"
                    >
                      <RefreshCw className="w-5 h-5" aria-hidden />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void copyCode()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-sm font-medium hover:bg-stone-200"
                    >
                      <Copy className="w-4 h-4" /> Copy
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void textCode()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-sm font-medium hover:bg-stone-200"
                    >
                      <MessageSquare className="w-4 h-4" /> Text
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rotate()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-50"
                    >
                      <RefreshCw className="w-4 h-4" /> Rotate
                    </button>
                  </div>
                </section>
              )}

              {!loading && data && data.attributions.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Progress
                  </h3>
                  {data.attributions.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
                    >
                      <p className="font-medium text-gray-900">{a.displayName}</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Operator Onboarding
                          </p>
                          <p className="font-semibold text-gray-900 mt-1">
                            {a.check2Status === 'passed'
                              ? 'Complete'
                              : a.check2Status === 'admin_review'
                                ? 'In review'
                                : a.check2Status === 'failed'
                                  ? 'Failed'
                                  : a.check1At
                                    ? 'In progress'
                                    : 'Pending'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Operator Bookings
                          </p>
                          <p className="font-semibold text-gray-900 mt-1 tabular-nums">
                            {Math.min(3, Math.max(0, a.qualifyingBookingCount || 0))}/3
                          </p>
                          <div className="mt-2 flex gap-1.5" aria-hidden>
                            {[1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className={`h-1.5 flex-1 rounded-full ${
                                  (a.qualifyingBookingCount || 0) >= n
                                    ? 'bg-brand-600'
                                    : 'bg-stone-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      {(a.m1AwardedAt || a.m2HoldUntil || a.m2AwardedAt) && (
                        <ul className="text-sm text-gray-600 space-y-1">
                          {a.m1AwardedAt && <li>Milestone 1 awarded</li>}
                          {a.m2HoldUntil && !a.m2AwardedAt && (
                            <li>
                              Milestone 2 on hold until{' '}
                              {new Date(a.m2HoldUntil).toLocaleDateString()}
                            </li>
                          )}
                          {a.m2AwardedAt && <li>Milestone 2 awarded</li>}
                        </ul>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {!loading && data && data.codeRequests.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Code requests
                  </h3>
                  {data.codeRequests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 text-sm space-y-1"
                    >
                      <p className="font-medium text-gray-900">{r.requesterName || 'Prospect'}</p>
                      {r.requesterEmail && <p className="text-gray-600">{r.requesterEmail}</p>}
                      {r.message && <p className="text-gray-600">{r.message}</p>}
                      <p className="text-xs text-gray-500">
                        {r.status} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </section>
              )}

              {!loading && data && data.history.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Past codes
                  </h3>
                  {data.history.map((h, i) => (
                    <div
                      key={`${h.retiredAt}-${i}`}
                      className="text-sm text-gray-600 flex justify-between gap-2"
                    >
                      <span className="font-mono">{h.code}</span>
                      <span>
                        {h.useCount} uses · retired {new Date(h.retiredAt).toLocaleDateString()}
                      </span>
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
