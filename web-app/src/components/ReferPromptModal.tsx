import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Post-booking / milestone thank-you prompt to refer someone.
 * At most once per cooldown; stops after max dismissals (server-enforced).
 * Admins with indefinite prompts: claim complimentary points, then how-to earn more.
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
  const [welcomeClaimAvailable, setWelcomeClaimAvailable] = useState(false);
  const [welcomePts, setWelcomePts] = useState(100);
  const [adminPage, setAdminPage] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setOpen(false);
    setAdminPage(0);
    void (async () => {
      try {
        const res = await api.get<{
          show: boolean;
          message?: string;
          rewardPts?: number;
          rewardDollars?: number;
          newOpKickbackPercent?: number;
          indefiniteAdminPrompt?: boolean;
          welcomeClaimAvailable?: boolean;
          welcomePts?: number;
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
        const isAdminPrompt = Boolean(res.indefiniteAdminPrompt);
        setIndefiniteAdmin(isAdminPrompt);
        const canClaim = Boolean(res.welcomeClaimAvailable);
        setWelcomeClaimAvailable(canClaim);
        setWelcomePts(Number(res.welcomePts) || 100);
        // Already claimed: open on the how-to page; otherwise claim page first.
        setAdminPage(isAdminPrompt && !canClaim ? 1 : 0);
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

  const claimWelcome = async () => {
    if (claimBusy) return;
    setClaimBusy(true);
    try {
      const res = await api.post<{
        alreadyClaimed?: boolean;
        grantedPts?: number;
        welcomePts?: number;
        balanceAfter?: number;
      }>('/referrals/prompts/welcome-claim');
      const granted = Number(res?.grantedPts) || 0;
      if (granted > 0) {
        toast.success(`Claimed ${granted.toLocaleString()} OnCuts points`);
      }
      setWelcomeClaimAvailable(false);
      setAdminPage(1);
    } catch (err: any) {
      toast.error(err?.message || 'Could not claim points');
    } finally {
      setClaimBusy(false);
    }
  };

  const ptsLabel = rewardPts > 0 ? rewardPts.toLocaleString() : '750';
  const dollarsLabel =
    rewardDollars > 0 ? `$${Math.round(rewardDollars)}` : rewardPts > 0 ? null : '$75';

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
            {adminPage === 0 && (
              <div className="space-y-4 pt-1 text-center">
                <h2 className="text-xl font-bold text-gray-900 px-8">OnCuts Thanks You!</h2>
                <p className="text-xl text-gray-600 leading-snug px-8">
                  Please enjoy {welcomePts.toLocaleString()} complimentary OnCuts points
                </p>
                <button
                  type="button"
                  disabled={claimBusy || !welcomeClaimAvailable}
                  onClick={() => void claimWelcome()}
                  className="mx-auto rounded-xl bg-brand-600 text-white px-8 py-2.5 text-xl font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {claimBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Claim
                </button>
              </div>
            )}

            {adminPage === 1 && (
              <div className="space-y-4 pt-6">
                <h2 className="text-xl font-bold text-gray-900 pr-8">How OnCuts Points work</h2>
                <div className="text-sm text-gray-600 leading-relaxed space-y-4 pr-1">
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">How you earn more</p>
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>Share your referral code with operators you know (beauty pros count too).</li>
                      <li>
                        Earn up to{' '}
                        <span className="font-semibold text-gray-900">{ptsLabel} pts</span>
                        {dollarsLabel ? (
                          <>
                            {' '}
                            (about{' '}
                            <span className="font-semibold text-gray-900">{dollarsLabel}</span>)
                          </>
                        ) : null}{' '}
                        when they onboard and complete their first bookings
                        {kickbackPercent > 0 ? (
                          <>
                            , plus a{' '}
                            <span className="font-semibold text-gray-900">
                              {kickbackPercent}% kickback
                            </span>{' '}
                            on their early bookings
                          </>
                        ) : null}
                        .
                      </li>
                      <li>Points never expire.</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">What points are for</p>
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>
                        Operators: apply points as a payout boost on a completed paid booking
                        (client price stays the same).
                      </li>
                      <li>
                        Clients: use points at checkout for dollars off the service (not the tip).
                      </li>
                      <li>10 pts = $1.</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                </div>
                <Link
                  to="/web/referrals"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
                >
                  Earn Points
                </Link>
              </div>
            )}

            {adminPage === 0 && (
              <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
              </div>
            )}
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
