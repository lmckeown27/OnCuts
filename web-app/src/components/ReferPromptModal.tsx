import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { notifyPointsBalanceChanged } from '../utils/pointsBalanceEvents';
import { notifyOpenReferrals } from '../utils/referralsRewardsEvents';

/**
 * Post-booking / milestone thank-you prompt to refer someone.
 * At most once per cooldown; stops after max dismissals (server-enforced).
 * Admins with indefinite prompts: always open on claim page; Claim is one-time.
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
  const [pointsAudience, setPointsAudience] = useState<'operator' | 'client'>('operator');

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
        setIndefiniteAdmin(Boolean(res.indefiniteAdminPrompt));
        setWelcomeClaimAvailable(Boolean(res.welcomeClaimAvailable));
        setWelcomePts(Number(res.welcomePts) || 100);
        // Always open on the first (claim) page for admin indefinite prompts.
        setAdminPage(0);
        setPointsAudience(
          user?.user_type === 'consumer' || user?.user_type === 'client' ? 'client' : 'operator'
        );
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
    if (claimBusy || !welcomeClaimAvailable) return;
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
      if (user?.id && typeof res?.balanceAfter === 'number') {
        notifyPointsBalanceChanged({
          userId: user.id,
          kind: 'operator',
          balancePts: res.balanceAfter,
        });
      } else if (user?.id && granted > 0) {
        notifyPointsBalanceChanged({ userId: user.id, kind: 'operator' });
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
            {adminPage > 0 && (
              <button
                type="button"
                onClick={() => setAdminPage((p) => Math.max(0, p - 1))}
                className="absolute top-3 left-3 p-1.5 rounded-full text-gray-500 hover:bg-stone-100 hover:text-gray-800 transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {adminPage === 0 && (
              <div className="space-y-4 pt-1 text-center">
                <h2 className="text-xl font-bold text-gray-900 px-8">OnCuts Thanks You!</h2>
                <p className="text-xl text-gray-600 leading-snug px-8">
                  Please enjoy{' '}
                  <span className="font-bold text-gray-900">{welcomePts.toLocaleString()}</span>{' '}
                  complimentary OnCuts points
                </p>
                <button
                  type="button"
                  disabled={claimBusy || !welcomeClaimAvailable}
                  onClick={() => void claimWelcome()}
                  aria-disabled={!welcomeClaimAvailable}
                  className={`mx-auto rounded-xl px-8 py-2.5 text-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    welcomeClaimAvailable
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  {claimBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {welcomeClaimAvailable ? 'Claim' : 'Claimed'}
                </button>
                {!welcomeClaimAvailable && (
                  <button
                    type="button"
                    onClick={() => setAdminPage(1)}
                    className="block w-full text-xl font-semibold text-brand-700 hover:underline transition-colors"
                  >
                    Continue →
                  </button>
                )}
              </div>
            )}

            {adminPage === 1 && (
              <div className="space-y-4 pt-6">
                <div className="text-center space-y-1 px-8">
                  <h2 className="text-xl font-bold text-gray-900">How OnCuts Points work</h2>
                  <p className="text-xl font-bold text-gray-900">10 pts = $1.</p>
                </div>
                <nav
                  className="grid gap-0.5 rounded-lg bg-stone-100 p-1"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                  aria-label="Points audience"
                >
                  {(
                    [
                      { id: 'operator' as const, label: 'Operators' },
                      { id: 'client' as const, label: 'Clients' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPointsAudience(tab.id)}
                      className={`px-2 py-2 rounded-md text-sm font-bold text-center transition-colors ${
                        pointsAudience === tab.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="text-sm text-gray-600 leading-relaxed pr-1">
                  {pointsAudience === 'operator' ? (
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>
                        Apply points to a completed booking to earn a kickback from OnCuts
                      </li>
                      <li>
                        If a client pays $30 for a service, apply 100 points to receive $10 from
                        OnCuts
                      </li>
                    </ul>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1.5">
                      <li>Earn discounts on bookings that will be covered by OnCuts</li>
                      <li>
                        If a service costs $30, apply 100 points to receive $10 off of your service.
                        Don&apos;t worry, that $10 still goes to the operator complementary of
                        OnCuts
                      </li>
                    </ul>
                  )}
                </div>
                <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                </div>
                <button
                  type="button"
                  onClick={() => setAdminPage(2)}
                  className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
                >
                  Earn Points
                </button>
              </div>
            )}

            {adminPage === 2 && (
              <div className="space-y-4 pt-6">
                <div className="text-center space-y-1 px-8">
                  <h2 className="text-xl font-bold text-gray-900">How you earn more</h2>
                </div>
                <div className="text-sm text-gray-600 leading-relaxed pr-1">
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      Share your referral code with operators you know (beauty pros count too).
                    </li>
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
                <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    notifyOpenReferrals();
                  }}
                  className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
                >
                  Get referral code
                </button>
              </div>
            )}

            {adminPage === 0 && (
              <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
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
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notifyOpenReferrals();
              }}
              className="block w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
            >
              Refer someone
            </button>
          </>
        )}
      </div>
    </div>
  );
}
