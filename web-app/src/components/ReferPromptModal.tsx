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
 * Pass enabled=false while Stripe onboarding (or similar) should take precedence.
 */
export default function ReferPromptModal({ enabled = true }: { enabled?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [rewardPts, setRewardPts] = useState(0);
  const [rewardDollars, setRewardDollars] = useState(0);
  const [welcomeClaimAvailable, setWelcomeClaimAvailable] = useState(false);
  const [welcomePts, setWelcomePts] = useState(100);
  const [page, setPage] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [pointsAudience, setPointsAudience] = useState<'operator' | 'client'>('operator');

  const minPage = welcomeClaimAvailable ? 0 : 1;

  useEffect(() => {
    if (!user?.id || !enabled) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    setOpen(false);
    setPage(0);
    void (async () => {
      try {
        const res = await api.get<{
          show: boolean;
          message?: string;
          rewardPts?: number;
          rewardDollars?: number;
          indefiniteAdminPrompt?: boolean;
          welcomeClaimAvailable?: boolean;
          welcomePts?: number;
        }>('/referrals/prompts/refer');
        if (cancelled || !res.show) return;
        setRewardPts(res.rewardPts || 0);
        setRewardDollars(
          typeof res.rewardDollars === 'number'
            ? res.rewardDollars
            : (res.rewardPts || 0) / 10
        );
        const canClaim = Boolean(res.welcomeClaimAvailable);
        setWelcomeClaimAvailable(canClaim);
        setWelcomePts(Number(res.welcomePts) || 100);
        setPage(canClaim ? 0 : 1);
        setPointsAudience(user?.user_type === 'student' ? 'client' : 'operator');
        setOpen(true);
        await api.post('/referrals/prompts/refer', { action: 'shown' });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname, enabled]);

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
      setPage(1);
    } catch (err: any) {
      toast.error(err?.message || 'Could not claim points');
    } finally {
      setClaimBusy(false);
    }
  };

  const ptsLabel = rewardPts > 0 ? rewardPts.toLocaleString() : '750';
  const dollarsLabel =
    rewardDollars > 0 ? `$${Math.round(rewardDollars)}` : rewardPts > 0 ? null : '$75';

  const pageDots = (
    <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden>
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${page === n ? 'bg-brand-600' : 'bg-stone-300'}`}
        />
      ))}
    </div>
  );

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

        {page > minPage && (
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(minPage, p - 1))}
            className="absolute top-3 left-3 p-1.5 rounded-full text-gray-500 hover:bg-stone-100 hover:text-gray-800 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {page === 0 && welcomeClaimAvailable && (
          <div className="space-y-4 pt-1 text-center">
            <h2 className="text-xl font-bold text-gray-900 px-8">OnCuts Thanks You!</h2>
            <p className="text-xl text-gray-600 leading-snug px-8">
              Please enjoy{' '}
              <span className="font-bold text-gray-900">{welcomePts.toLocaleString()}</span>{' '}
              complimentary OnCuts points
            </p>
            <button
              type="button"
              disabled={claimBusy}
              onClick={() => void claimWelcome()}
              className="mx-auto rounded-xl px-8 py-2.5 text-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {claimBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Claim
            </button>
            {pageDots}
          </div>
        )}

        {page === 1 && (
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
                    Apply points to a completed booking to{' '}
                    <strong>earn a kickback</strong> from OnCuts
                  </li>
                  <li>
                    If a client pays $30 for a service, apply 100 points to{' '}
                    <strong>receive $10 from OnCuts</strong>
                  </li>
                </ul>
              ) : (
                <ul className="list-disc pl-5 space-y-1.5">
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
            {pageDots}
            <button
              type="button"
              onClick={() => setPage(2)}
              className="mx-auto block rounded-xl bg-brand-600 text-white px-8 py-2.5 text-xl font-semibold text-center"
            >
              Earn Points
            </button>
          </div>
        )}

        {page === 2 && (
          <div className="space-y-4 pt-6">
            <div className="text-center space-y-1 px-8">
              <h2 className="text-xl font-bold text-gray-900">How to Earn OnCuts Points</h2>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed pr-1">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  Share your Referral Code with operators you know whether they be{' '}
                  <span className="font-semibold text-gray-900">barbers</span> or{' '}
                  <span className="font-semibold text-gray-900">beauty</span> professionals
                </li>
                <li>
                  Earn up to{' '}
                  <span className="font-semibold text-gray-900">{ptsLabel} points</span>
                  {dollarsLabel ? (
                    <>
                      {' '}
                      (or <span className="font-semibold text-gray-900">{dollarsLabel}</span>)
                    </>
                  ) : null}{' '}
                  when they onboard to OnCuts using your Referral Code
                </li>
              </ul>
            </div>
            {pageDots}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notifyOpenReferrals();
              }}
              className="mx-auto block rounded-xl bg-brand-600 text-white px-8 py-2.5 text-xl font-semibold text-center"
            >
              View Referral Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
