/**
 * Stripe Connect hub — step-by-step onboarding guide, Express dashboard, payout management.
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from './Button';
import {
  fetchBarberConnectStatus,
  createBarberConnectOnboarding,
  refreshBarberConnectOnboarding,
  resetBarberConnect,
  fetchBarberStripeDashboardUrl,
  type BarberConnectStatus,
} from '../services/barber-connect.service';
import { isBarberStripeFullyConnected } from '../utils/stripe-connect-status';

interface StripeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, hide Close and ignore backdrop clicks until Stripe Connect is fully complete. */
  blocking?: boolean;
  /** Called after status refresh when all checklist items are complete. */
  onFullyConnected?: () => void;
}

const GUIDE_STEP_LABELS = ['Overview', 'Identity', 'Payments', 'Bank', 'Verify'] as const;
const GUIDE_STEP_COUNT = GUIDE_STEP_LABELS.length;

function apiErrorDetails(err: unknown): { message?: string; code?: string } {
  if (!err || typeof err !== 'object' || !('response' in err)) return {};
  const errBody = (err as { response?: { data?: { error?: { message?: string; code?: string } } } }).response
    ?.data?.error;
  return { message: errBody?.message, code: errBody?.code };
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={done ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
        {done ? 'Complete' : 'Needed'}
      </span>
    </div>
  );
}

function guideStepForStatus(status: BarberConnectStatus | null): number {
  if (!status?.has_account || status.needs_reconnect) return 0;
  if (!status.detailsSubmitted) return 1;
  if (!status.chargesEnabled) return 2;
  if (!status.payoutsEnabled) return 3;
  return 4;
}

export default function StripeHubModal({
  isOpen,
  onClose,
  blocking = false,
  onFullyConnected,
}: StripeHubModalProps) {
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [connectStatusUnknown, setConnectStatusUnknown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<'dashboard' | 'onboarding' | 'refresh' | 'status' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [stripeTabOpened, setStripeTabOpened] = useState(false);
  const [platformSetupBlocked, setPlatformSetupBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectStatusUnknown(false);
      const status = await fetchBarberConnectStatus();
      setConnectStatus(status);
      if (isBarberStripeFullyConnected(status)) {
        onFullyConnected?.();
      } else if (blocking) {
        setGuideStep((prev) => Math.max(prev, guideStepForStatus(status)));
      }
      return status;
    } catch (e) {
      console.error(e);
      setConnectStatus(null);
      setConnectStatusUnknown(true);
      toast.error('Could not load Stripe status');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [blocking, onFullyConnected]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setGuideStep(0);
      setStripeTabOpened(false);
      setPlatformSetupBlocked(null);
      void load();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || isLoading) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isOpen, isLoading, load]);

  const advanceAfterStripeOpen = useCallback((openedStep: number) => {
    setStripeTabOpened(true);
    setGuideStep((prev) => Math.max(prev, Math.min(openedStep + 1, GUIDE_STEP_COUNT - 1)));
  }, []);

  const openOnboardingUrl = useCallback(
    async (advanceFromStep: number) => {
      const needsReconnect = Boolean(connectStatus?.needs_reconnect);
      const { onboarding_url: onboardingUrl } = needsReconnect
        ? await resetBarberConnect()
        : await createBarberConnectOnboarding();
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
      advanceAfterStripeOpen(advanceFromStep);
      if (needsReconnect) {
        await load();
      }
    },
    [advanceAfterStripeOpen, connectStatus?.needs_reconnect, load]
  );

  const startStripeOnboarding = async () => {
    try {
      setBusy('onboarding');
      await openOnboardingUrl(0);
      toast.success('Stripe opened in a new tab — follow the steps on the next page here.');
    } catch (err: unknown) {
      const { message: msg, code } = apiErrorDetails(err);
      if (code === 'STRIPE_CONNECT_PLATFORM_PROFILE_INCOMPLETE') {
        setPlatformSetupBlocked(
          msg ||
            'PismoPlatforms must finish Stripe Connect platform setup in the Stripe Dashboard before barbers can onboard.'
        );
      }
      toast.error(msg || 'Could not start Stripe Connect');
    } finally {
      setBusy(null);
    }
  };

  const openStripeTabForCurrentStep = async () => {
    try {
      setBusy('onboarding');
      if (guideStep === 0) {
        await openOnboardingUrl(0);
      } else if (connectStatus?.has_account && !connectStatus?.needs_reconnect) {
        const { onboarding_url: onboardingUrl } = await refreshBarberConnectOnboarding();
        window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
        advanceAfterStripeOpen(guideStep);
      } else {
        await openOnboardingUrl(guideStep);
      }
      toast('Switch between this tab and Stripe as needed — both stay open.', { icon: '↔️' });
    } catch (err: unknown) {
      const { message: msg } = apiErrorDetails(err);
      toast.error(msg || 'Could not open Stripe');
    } finally {
      setBusy(null);
    }
  };

  const openStripeDashboard = async () => {
    try {
      setBusy('dashboard');
      const url = await fetchBarberStripeDashboardUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const { message: msg } = apiErrorDetails(err);
      toast.error(msg || 'Could not open Stripe. Complete Connect setup first.');
    } finally {
      setBusy(null);
    }
  };

  const refreshStripeOnboarding = async () => {
    try {
      setBusy('refresh');
      const { onboarding_url: onboardingUrl } = await refreshBarberConnectOnboarding();
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
      advanceAfterStripeOpen(Math.max(guideStep, 1));
    } catch (err: unknown) {
      const { message: msg } = apiErrorDetails(err);
      toast.error(msg || 'Could not refresh Stripe setup link');
    } finally {
      setBusy(null);
    }
  };

  const checkProgress = async () => {
    try {
      setBusy('status');
      const status = await load();
      if (status && isBarberStripeFullyConnected(status)) {
        toast.success('Stripe setup complete — your dashboard is unlocked.');
        return;
      }
      if (status) {
        const resumeStep = guideStepForStatus(status);
        setGuideStep(resumeStep);
        toast('Status updated — continue where Stripe still shows items to complete.', { icon: 'ℹ️' });
      }
    } finally {
      setBusy(null);
    }
  };

  if (!isVisible && !isOpen) return null;

  const hasAccount = Boolean(connectStatus?.has_account);
  const needsReconnect = Boolean(connectStatus?.needs_reconnect);
  const detailsSubmitted = Boolean(connectStatus?.detailsSubmitted);
  const chargesEnabled = Boolean(connectStatus?.chargesEnabled);
  const payoutsEnabled = Boolean(connectStatus?.payoutsEnabled);
  const fullyConnected = isBarberStripeFullyConnected(connectStatus);
  const needsSetup = !fullyConnected;
  const canDismiss = !blocking || fullyConnected;
  const showWizard = needsSetup;

  const handleBackdropClick = () => {
    if (canDismiss) onClose();
  };

  const headerSubtitle = fullyConnected
    ? 'Payments, payouts, and bank account'
    : blocking
      ? `Setup guide · Step ${guideStep + 1} of ${GUIDE_STEP_COUNT}`
      : 'Payments, payouts, and bank account';

  const renderChecklist = () => (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Setup checklist</p>
      <StatusRow label="Stripe account linked" done={hasAccount && !needsReconnect} />
      <StatusRow label="Identity & business details" done={detailsSubmitted} />
      <StatusRow label="Accept card payments" done={chargesEnabled} />
      <StatusRow label="Bank account & payouts" done={payoutsEnabled} />
    </div>
  );

  const renderGuideStep = () => {
    switch (guideStep) {
      case 0:
        return (
          <>
            <p className="text-sm text-gray-600 leading-relaxed">
              PismoPlatforms uses <strong>Stripe Connect</strong> so customer payments go to your linked bank
              account. Stripe handles identity verification, card processing, payout schedules, balances, and tax
              forms—not a PismoPlatforms balance.
            </p>
            {platformSetupBlocked && (
              <p className="text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed">
                <strong>Platform setup required:</strong> {platformSetupBlocked} Stripe Dashboard →{' '}
                <a
                  href="https://dashboard.stripe.com/connect/accounts/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Connect → Accounts overview
                </a>{' '}
                (toggle <strong>live mode</strong> on). This is a one-time step for the PismoPlatforms owner—not
                something barbers can fix themselves.
              </p>
            )}
            {connectStatusUnknown && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Could not verify Stripe status. You can still start connecting below.
              </p>
            )}
            {needsReconnect && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                Your saved payout account is from a previous Stripe setup (test mode or an old platform account).
                The next step creates a fresh connection to the current live payout account.
              </p>
            )}
            {blocking && (
              <p className="text-xs text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                Your provider dashboard stays disabled until every checklist item shows{' '}
                <strong>Complete</strong>. This guide walks you through each part.
              </p>
            )}
            <p className="text-sm text-gray-600">
              When you tap <strong>Connect with Stripe</strong>, Stripe opens in a new tab and this guide moves to
              step-by-step instructions for what to enter there.
            </p>
          </>
        );
      case 1:
        return (
          <>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-900">In Stripe: Identity & business details</p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Confirm your <strong>legal name</strong> and date of birth match your government ID.</li>
                <li>Enter the <strong>last 4 digits of your SSN</strong> (or ITIN where applicable) for verification.</li>
                <li>Choose your business type — most solo providers select <strong>Individual</strong> or sole proprietor.</li>
                <li>Add a <strong>business name</strong> customers may recognize (your brand or your name).</li>
                <li>Provide your <strong>address</strong> and phone number when prompted.</li>
                <li>If Stripe asks for an ID photo, upload a clear image of your driver&apos;s license or passport.</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500">
              Stripe may save progress partway through. If a section looks grayed out, you may have already completed
              it — use <strong>Check my progress</strong> on the last step.
            </p>
          </>
        );
      case 2:
        return (
          <>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-900">In Stripe: Accept card payments</p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Review your <strong>business category</strong> — select a service that matches what you offer (e.g. personal services).</li>
                <li>Describe what you sell in a sentence (e.g. &quot;Haircuts and grooming appointments&quot;).</li>
                <li>Confirm your <strong>website or app</strong> — you can use your PismoPlatforms profile URL if asked.</li>
                <li>Complete any remaining <strong>business details</strong> fields with a red asterisk.</li>
                <li>Submit the section so Stripe can enable <strong>card payments</strong> on your account.</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500">
              Stripe enables charges only after identity and business sections pass review — this can take a minute
              after you submit.
            </p>
          </>
        );
      case 3:
        return (
          <>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-900">In Stripe: Bank account & payouts</p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Open the <strong>Payouts</strong> or <strong>Bank details</strong> section in Stripe Express.</li>
                <li>Enter your <strong>routing number</strong> and <strong>account number</strong> for the bank where you want deposits.</li>
                <li>Double-check account type (<strong>Checking</strong> vs savings) matches your bank.</li>
                <li>Choose a <strong>payout schedule</strong> (daily, weekly, etc.) — you can change this later in Stripe.</li>
                <li>Save and confirm — Stripe may send small test deposits to verify the account.</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500">
              PismoPlatforms never stores your bank login — only Stripe receives this information.
            </p>
          </>
        );
      case 4:
      default:
        return (
          <>
            {stripeTabOpened ? (
              <p className="text-sm text-gray-600">
                Return here after working in Stripe. We automatically refresh when you switch back to this tab, or
                tap <strong>Check my progress</strong> below.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Open Stripe to finish any remaining sections, then verify everything in the checklist shows{' '}
                <strong>Complete</strong>.
              </p>
            )}
            {!fullyConnected && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Items still marked <strong>Needed</strong>? Open Stripe again and complete those sections, then check
                progress here. You can move back to earlier guide pages if you need the instructions.
              </p>
            )}
            {fullyConnected && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Stripe is connected — payouts flow directly to your bank. Your dashboard is unlocked.
              </div>
            )}
          </>
        );
    }
  };

  const renderWizardFooter = () => {
    if (guideStep === 0) {
      return (
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => void startStripeOnboarding()}
          disabled={busy !== null || Boolean(platformSetupBlocked)}
        >
          {busy === 'onboarding'
            ? 'Opening Stripe…'
            : needsReconnect
              ? 'Connect with Stripe'
              : hasAccount
                ? 'Continue setup in Stripe'
                : 'Connect with Stripe'}
        </Button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => setGuideStep((s) => Math.max(0, s - 1))}
            disabled={busy !== null || guideStep === 0}
          >
            Back
          </Button>
          {guideStep < GUIDE_STEP_COUNT - 1 ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setGuideStep((s) => Math.min(GUIDE_STEP_COUNT - 1, s + 1))}
              disabled={busy !== null}
            >
              Next
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => void openStripeTabForCurrentStep()}
          disabled={busy !== null}
        >
          {busy === 'onboarding' ? 'Opening Stripe…' : 'Open Stripe tab'}
        </Button>
        {guideStep === GUIDE_STEP_COUNT - 1 && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => void checkProgress()}
            disabled={busy !== null}
          >
            {busy === 'status' ? 'Checking…' : 'Check my progress'}
          </Button>
        )}
        {hasAccount && !needsReconnect && guideStep > 0 && (
          <button
            type="button"
            onClick={() => void refreshStripeOnboarding()}
            disabled={busy !== null}
            className="w-full text-sm text-primary-600 hover:text-black font-medium py-2 disabled:opacity-60"
          >
            {busy === 'refresh' ? 'Opening…' : 'Get a fresh Stripe setup link'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center p-2 sm:p-4 transition-all duration-150 ease-out ${
        blocking ? 'z-[100]' : 'z-50'
      } ${isAnimating ? 'bg-black/50' : 'bg-black/0'}`}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Stripe</h2>
            <p className="text-white/80 text-sm truncate">{headerSubtitle}</p>
            {showWizard && !isLoading && guideStep > 0 && (
              <p className="text-white/70 text-xs mt-1.5 leading-snug">
                Keep this guide and Stripe open side by side — jump back and forth if you get stuck. Use{' '}
                <strong className="text-white/90">Open Stripe tab</strong> below anytime.
              </p>
            )}
            {showWizard && !isLoading && (
              <div className="flex gap-1 mt-2">
                {GUIDE_STEP_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= guideStep ? 'bg-white' : 'bg-white/30'
                    }`}
                    title={label}
                  />
                ))}
              </div>
            )}
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shrink-0 ml-3"
            >
              Close
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading Stripe status…</p>
            </div>
          ) : showWizard ? (
            <>
              {renderChecklist()}
              {renderGuideStep()}
              <div className="space-y-3 pt-1 border-t border-gray-100">{renderWizardFooter()}</div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">
                PismoPlatforms uses <strong>Stripe Connect</strong> so customer payments go to your linked bank
                account.
              </p>
              {renderChecklist()}
              <div className="space-y-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => void openStripeDashboard()}
                  disabled={busy !== null}
                >
                  {busy === 'dashboard' ? 'Opening Stripe…' : 'Open Stripe Express'}
                </Button>
                <button
                  type="button"
                  onClick={() => void openStripeDashboard()}
                  disabled={busy !== null}
                  className="w-full text-sm text-primary-600 hover:text-black font-medium py-2 disabled:opacity-60"
                >
                  Manage bank account & payouts in Stripe
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Stripe is connected — payouts flow directly to your bank.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
