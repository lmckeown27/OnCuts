import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Post-booking / milestone thank-you prompt to refer someone.
 * At most once per cooldown; stops after max dismissals (server-enforced).
 * Admins with indefinite prompts: show on every platform home entry.
 */
export default function ReferPromptModal() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [rewardPts, setRewardPts] = useState(0);
  const [rewardDollars, setRewardDollars] = useState(0);
  const [kickbackPercent, setKickbackPercent] = useState(0);
  const [indefiniteAdmin, setIndefiniteAdmin] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setOpen(false);
    void (async () => {
      try {
        const res = await api.get<{
          show: boolean;
          message?: string;
          rewardPts?: number;
          rewardDollars?: number;
          newOpKickbackPercent?: number;
          indefiniteAdminPrompt?: boolean;
        }>('/referrals/prompts/refer');
        if (cancelled || !res.show) return;
        setMessage(res.message || 'Know a great operator? Refer them and earn points.');
        setRewardPts(res.rewardPts || 0);
        setRewardDollars(
          typeof res.rewardDollars === 'number'
            ? res.rewardDollars
            : (res.rewardPts || 0) / 10
        );
        setKickbackPercent(Number(res.newOpKickbackPercent) || 0);
        setIndefiniteAdmin(Boolean(res.indefiniteAdminPrompt));
        setOpen(true);
        await api.post('/referrals/prompts/refer', { action: 'shown' });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname]);

  if (!open) return null;

  const dismiss = async () => {
    try {
      await api.post('/referrals/prompts/refer', { action: 'dismiss' });
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <button
          type="button"
          onClick={() => void dismiss()}
          className="absolute top-3 right-3 p-1.5 rounded-full text-gray-500 hover:bg-stone-100 hover:text-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {indefiniteAdmin ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 pr-8">
              Thank you for actively using OnCuts!
            </h2>
            <div className="text-sm text-gray-600 leading-relaxed space-y-2 pr-2">
              <p>Refer operators you know and help grow the platform:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  Earn up to{' '}
                  <span className="font-semibold text-gray-900">
                    {rewardPts.toLocaleString()} pts
                  </span>
                  {rewardDollars > 0 ? (
                    <>
                      {' '}
                      (about{' '}
                      <span className="font-semibold text-gray-900">
                        ${rewardDollars.toFixed(0)}
                      </span>
                      )
                    </>
                  ) : null}
                  {kickbackPercent > 0 ? (
                    <>
                      {' '}
                      plus a{' '}
                      <span className="font-semibold text-gray-900">
                        {kickbackPercent}% kickback
                      </span>{' '}
                      on their early bookings
                    </>
                  ) : null}
                  .
                </li>
                <li>
                  Tap into a bigger client pool as more operators join your network and bring
                  their clients onto OnCuts.
                </li>
                <li>
                  Grow OnCuts — every operator you refer strengthens the marketplace for everyone.
                </li>
              </ul>
              <p className="text-xs text-gray-500 pt-1">
                Beauty pros count too — braids, nails, lashes, makeup, tanning.
              </p>
            </div>
            <Link
              to="/web/referrals"
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
            >
              Refer someone
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 pr-8">Thanks — and one more thing</h2>
            <p className="text-sm text-gray-600 leading-relaxed pr-2">{message}</p>
            {rewardPts > 0 && (
              <p className="text-sm font-semibold text-emerald-800">
                Up to {rewardPts.toLocaleString()} pts
              </p>
            )}
            <Link
              to="/web/referrals"
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
            >
              Refer someone
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
