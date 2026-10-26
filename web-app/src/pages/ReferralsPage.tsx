import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Eye, EyeOff, MessageSquare, RefreshCw } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';

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

export default function ReferralsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [data, setData] = useState<ReferralMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!user) return;
    void load();
  }, [user, load]);

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
    const body = encodeURIComponent(
      `Join OnCuts with my referral code ${code}. Beauty pros welcome — braids, nails, lashes, makeup, tanning.`
    );
    window.open(`sms:?&body=${body}`, '_blank');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <p className="text-gray-600">Sign in to view referrals.</p>
      </div>
    );
  }

  const backTo = data?.referrerKind === 'operator' ? '/web/barber' : '/web/consumer';

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="p-2 rounded-full hover:bg-stone-200/60"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <Link to="/web/rewards" className="ml-auto text-sm font-medium text-brand-700 hover:underline">
            Rewards
          </Link>
        </div>

        <p className="text-sm text-gray-600">
          Refer operators onto OnCuts — beauty pros included (braids, nails, lashes, makeup, tanning).
          Earn up to {data?.rewardsHint.total ?? '—'} pts when they onboard and complete bookings.
        </p>

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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Referral code</h2>
              <p className="text-xs text-gray-500">
                {data.code.usesThisMonth}/{data.code.maxUsesPerMonth} uses this month
              </p>
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
                {revealed ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
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
            <p className="text-xs text-gray-500">
              Created {new Date(data.code.createdAt).toLocaleDateString()} · {data.code.useCount} total uses
              {data.code.lastUsedAt
                ? ` · last used ${new Date(data.code.lastUsedAt).toLocaleDateString()}`
                : ''}
            </p>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Progress</h2>
            {data.attributions.map((a) => (
              <div key={a.id} className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
                <p className="font-medium text-gray-900">{a.displayName}</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Check 1: {a.check1At ? 'Passed' : '—'}</li>
                  <li>
                    Check 2:{' '}
                    {a.check2Status === 'passed'
                      ? 'Passed'
                      : a.check2Status === 'admin_review'
                        ? 'In review'
                        : a.check2Status === 'failed'
                          ? 'Failed'
                          : 'Pending'}
                  </li>
                  <li>Bookings toward 3: {a.qualifyingBookingCount}/3</li>
                  {a.m1AwardedAt && <li>Milestone 1 awarded</li>}
                  {a.m2HoldUntil && !a.m2AwardedAt && (
                    <li>Milestone 2 on hold until {new Date(a.m2HoldUntil).toLocaleDateString()}</li>
                  )}
                  {a.m2AwardedAt && <li>Milestone 2 awarded</li>}
                </ul>
              </div>
            ))}
          </section>
        )}

        {!loading && data && data.codeRequests.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Code requests</h2>
            {data.codeRequests.map((r) => (
              <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 text-sm space-y-1">
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Past codes</h2>
            {data.history.map((h, i) => (
              <div key={`${h.retiredAt}-${i}`} className="text-sm text-gray-600 flex justify-between gap-2">
                <span className="font-mono">{h.code}</span>
                <span>{h.useCount} uses · retired {new Date(h.retiredAt).toLocaleDateString()}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
