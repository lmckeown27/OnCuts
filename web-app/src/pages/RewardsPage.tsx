import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { useFrontendConfig } from '../hooks/useFrontendConfig';

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

export default function RewardsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { pointsVisible, isLoading: configLoading } = useFrontendConfig();
  const kind =
    user?.user_type === 'barber' || user?.user_type === 'admin' || user?.is_admin
      ? 'operator'
      : 'client';
  const [data, setData] = useState<RewardsMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<RewardsMe>('/referrals/rewards/me', { kind });
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load rewards');
    }
  }, [kind]);

  useEffect(() => {
    if (user && pointsVisible) void load();
  }, [user, load, pointsVisible]);

  useEffect(() => {
    if (!configLoading && !pointsVisible) {
      navigate(kind === 'operator' ? '/web/barber' : '/web/consumer', { replace: true });
    }
  }, [configLoading, pointsVisible, kind, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <p className="text-gray-600">Sign in to view rewards.</p>
      </div>
    );
  }

  if (!pointsVisible) return null;

  const backTo = kind === 'operator' ? '/web/barber' : '/web/consumer';

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
          <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
          <Link to="/web/referrals" className="ml-auto text-sm font-medium text-brand-700 hover:underline">
            Referrals
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {data?.empty && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center space-y-3">
            <p className="text-gray-700">No points yet. Refer an operator to start earning.</p>
            <Link
              to="/web/referrals"
              className="inline-flex px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
            >
              Go to Referrals
            </Link>
          </div>
        )}

        {data && !data.empty && (
          <>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
              <p className="text-3xl font-semibold tabular-nums text-emerald-950">
                {data.balancePts.toLocaleString()} pts
              </p>
              <p className="text-sm text-emerald-800 mt-1">
                ≈ ${data.balanceDollars.toFixed(2)} ({data.pointsPerDollar} pts = $1)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Earned</p>
                <p className="font-semibold text-gray-900 mt-1">
                  {data.lifetimeEarnedPts.toLocaleString()} pts
                </p>
                <p className="text-gray-500">${data.lifetimeEarnedDollars.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">On the way</p>
                <p className="font-semibold text-gray-900 mt-1">
                  {data.pendingPts.toLocaleString()} pts
                </p>
                <p className="text-gray-500">${data.pendingDollars.toFixed(2)}</p>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
              {data.history.length === 0 && (
                <p className="text-sm text-gray-500">No ledger entries yet.</p>
              )}
              {data.history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{h.reason.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(h.createdAt).toLocaleString()}
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
          </>
        )}
      </div>
    </div>
  );
}
