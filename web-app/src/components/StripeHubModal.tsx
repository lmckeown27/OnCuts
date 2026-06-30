/**
 * Stripe Connect hub: step-by-step onboarding guide, Express dashboard, payout management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

const STRIPE_ONBOARDING_STEPS = [
  {
    short: 'Sign in',
    title: 'Sign in to Express',
    instructions: (
      <p className="text-sm text-gray-600">
        Enter the <strong>email address</strong> you use to sign in to PismoPlatforms into{' '}
        <strong>Stripe Express</strong>. It must match. Stripe uses this to link your payout account.
      </p>
    ),
  },
  {
    short: 'Identity',
    title: 'Identity & business details',
    instructions: (
      <>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>
            Enter your <strong>legal name</strong> and <strong>date of birth</strong> exactly as they appear on your
            government ID.
          </li>
          <li>
            Provide the <strong>last four digits of your SSN</strong> (or ITIN if applicable) when asked.
          </li>
          <li>
            Choose <strong>Individual</strong> or sole proprietor unless you operate as a registered company.
          </li>
          <li>
            Add the <strong>business name</strong> customers know you by, plus your <strong>address</strong> and phone
            number.
          </li>
          <li>
            Upload a photo of your ID if Stripe requests it. Use a clear, well-lit image with all corners visible.
          </li>
          <li>Save or continue until Stripe accepts this section, then come back here and tap <strong>Next</strong>.</li>
        </ol>
      </>
    ),
  },
  {
    short: 'Payments',
    title: 'Accept card payments',
    instructions: (
      <>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>
            Pick a <strong>business category</strong> that matches your services (for example, personal care or
            beauty services).
          </li>
          <li>
            Write a short description of what you sell (for example, &quot;Haircuts and grooming by appointment&quot;).
          </li>
          <li>
            If Stripe asks for a website, enter your <strong>PismoPlatforms profile URL</strong> or business site.
          </li>
          <li>Complete every field marked required, then submit so Stripe can enable <strong>card payments</strong>.</li>
          <li>Wait for Stripe to accept this section (it can take a minute), then tap <strong>Next</strong> here.</li>
        </ol>
      </>
    ),
  },
  {
    short: 'Bank',
    title: 'Bank account & payouts',
    instructions: (
      <>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>
            Open the bank or payout section and enter your <strong>routing number</strong> and{' '}
            <strong>account number</strong>.
          </li>
          <li>Select <strong>Checking</strong> or <strong>Savings</strong> to match your bank account type.</li>
          <li>Choose how often you want payouts (daily, weekly, etc.). You can change this later in Stripe.</li>
          <li>Save the details. Stripe may verify the account with small test deposits.</li>
          <li>When finished, return here and tap <strong>Next</strong>, then <strong>Check my progress</strong>.</li>
        </ol>
        <p className="text-xs text-gray-500 mt-3">
          PismoPlatforms never sees your bank login. Only Stripe stores this information.
        </p>
      </>
    ),
  },
] as const;

const STRIPE_STEP_COUNT = STRIPE_ONBOARDING_STEPS.length;
/** Intro + connect overview + Stripe onboarding steps + verify. */
const GUIDE_STEP_COUNT = STRIPE_STEP_COUNT + 3;
const GUIDE_INTRO_STEP = 0;
const GUIDE_CONNECT_STEP = 1;
const GUIDE_VERIFY_STEP = GUIDE_STEP_COUNT - 1;
const GUIDE_FIRST_STRIPE_STEP = 2;

const GUIDE_PROGRESS_STEPS = [
  { short: 'Intro', title: 'How payments work' },
  { short: 'Connect', title: 'Connect with Stripe' },
  ...STRIPE_ONBOARDING_STEPS.map((step) => ({ short: step.short, title: step.title })),
  { short: 'Review', title: 'Review your setup' },
] as const;

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

function stripeOnboardingIndex(guideStep: number): number | null {
  if (guideStep < GUIDE_FIRST_STRIPE_STEP || guideStep > GUIDE_FIRST_STRIPE_STEP + STRIPE_STEP_COUNT - 1) {
    return null;
  }
  return guideStep - GUIDE_FIRST_STRIPE_STEP;
}

export default function StripeHubModal({
  isOpen,
  onClose,
  blocking = false,
  onFullyConnected,
}: StripeHubModalProps) {
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [connectStatusUnknown, setConnectStatusUnknown] = useState(false);
  const [busy, setBusy] = useState<'dashboard' | 'onboarding' | 'refresh' | 'status' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [stripeTabOpened, setStripeTabOpened] = useState(false);
  const [platformSetupBlocked, setPlatformSetupBlocked] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setConnectStatusUnknown(false);
      const status = await fetchBarberConnectStatus();
      setConnectStatus(status);
      if (isBarberStripeFullyConnected(status)) {
        onFullyConnected?.();
      }
      return status;
    } catch (e) {
      console.error(e);
      setConnectStatus(null);
      setConnectStatusUnknown(true);
      return null;
    }
  }, [onFullyConnected]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (!wasOpenRef.current) {
        setStripeTabOpened(false);
        setPlatformSetupBlocked(null);
      }
      void loadRef.current();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(t);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadRef.current();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isOpen]);

  const markStripeTabOpened = useCallback(() => {
    setStripeTabOpened(true);
  }, []);

  const openOnboardingUrl = useCallback(async () => {
    const needsReconnect = Boolean(connectStatus?.needs_reconnect);
    const { onboarding_url: onboardingUrl } = needsReconnect
      ? await resetBarberConnect()
      : await createBarberConnectOnboarding();
    window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
    markStripeTabOpened();
    if (needsReconnect) {
      await load();
    }
  }, [markStripeTabOpened, connectStatus?.needs_reconnect, load]);

  const startStripeOnboarding = async () => {
    try {
      setBusy('onboarding');
      await openOnboardingUrl();
      toast.success('Stripe opened in a new tab. Complete step 1 (your email), then Continue.');
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
      if (guideStep === GUIDE_INTRO_STEP || guideStep === GUIDE_CONNECT_STEP) {
        await openOnboardingUrl();
      } else if (connectStatus?.has_account && !connectStatus?.needs_reconnect) {
        const { onboarding_url: onboardingUrl } = await refreshBarberConnectOnboarding();
        window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
        markStripeTabOpened();
      } else {
        await openOnboardingUrl();
      }
      toast('Switch between this tab and Stripe as needed. Both stay open.', { icon: '↔️' });
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
      markStripeTabOpened();
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
        toast.success('Stripe setup complete. Your dashboard is unlocked.');
        return;
      }
      if (status) {
        toast('Status updated. Check the checklist for items still marked Needed.', { icon: 'ℹ️' });
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
  const showWizard = needsSetup || blocking;

  const handleBackdropClick = () => {
    if (canDismiss) onClose();
  };

  const headerSubtitle = showWizard
    ? (() => {
        if (guideStep === GUIDE_INTRO_STEP) return 'How payments work';
        if (guideStep === GUIDE_CONNECT_STEP) return 'Connect with Stripe';
        if (guideStep === GUIDE_VERIFY_STEP) return 'Review your setup';
        const stripeIndex = stripeOnboardingIndex(guideStep);
        if (stripeIndex === null) return 'Stripe setup';
        const stripeStep = STRIPE_ONBOARDING_STEPS[stripeIndex];
        if (stripeIndex === 0) return stripeStep.title;
        return `Step ${stripeIndex} of ${STRIPE_STEP_COUNT - 1} · ${stripeStep.title}`;
      })()
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
      case GUIDE_INTRO_STEP:
        return (
          <>
            <p className="text-sm text-gray-600 leading-relaxed">
              PismoPlatforms helps customers book and pay for your services online. When a customer pays, the money
              does not sit in a PismoPlatforms balance. It is processed by <strong>Stripe</strong>, a third-party payment
              company, and deposited into the bank account you link during setup.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Stripe handles card processing, identity verification, payout schedules, and tax forms. You will create
              or sign in to a <strong>Stripe Express</strong> account so payouts go directly to you. Tap{' '}
              <strong>Next</strong> to see what to connect and how the checklist tracks your progress.
            </p>
          </>
        );
      case GUIDE_CONNECT_STEP:
        return (
          <>
            <p className="text-sm text-gray-600 leading-relaxed">
              Customer payments go to your linked bank account through <strong>Stripe Connect</strong>, a third-party
              payment service, not PismoPlatforms.{' '}
              <a
                href="https://en.wikipedia.org/wiki/Stripe,_Inc."
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline font-medium hover:text-black"
              >
                Learn about Stripe on Wikipedia
              </a>
              .
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
                (toggle <strong>live mode</strong> on). This is a one-time step for the PismoPlatforms owner, not
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
            <p className="text-sm text-gray-600">
              Tap <strong>Connect with Stripe</strong> to open Stripe in a new tab. Start by entering your PismoPlatforms
              email in Stripe Express, then follow this guide for identity, payments, and bank setup.
            </p>
          </>
        );
      case GUIDE_VERIFY_STEP:
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
                progress here. Use <strong>Back</strong> to reread earlier steps if you need help.
              </p>
            )}
            {fullyConnected && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Stripe is connected. Payouts flow directly to your bank. Your dashboard is unlocked.
              </div>
            )}
          </>
        );
      default: {
        const stripeIndex = stripeOnboardingIndex(guideStep);
        if (stripeIndex !== null) {
          const stripeStep = STRIPE_ONBOARDING_STEPS[stripeIndex];
          if (stripeIndex === 0) {
            return (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                {stripeStep.instructions}
              </div>
            );
          }
          return (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Step {stripeIndex} of {STRIPE_STEP_COUNT - 1}
              </p>
              <p className="text-sm font-semibold text-gray-900">What to do: {stripeStep.title}</p>
              {stripeStep.instructions}
            </div>
          );
        }
        return null;
      }
    }
  };

  const renderWizardFooter = () => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => setGuideStep((s) => Math.max(GUIDE_INTRO_STEP, s - 1))}
          disabled={busy !== null || guideStep === GUIDE_INTRO_STEP}
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
      {guideStep === GUIDE_CONNECT_STEP ? (
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
      ) : (
        <>
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
          {guideStep === GUIDE_VERIFY_STEP && (
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
          {hasAccount && !needsReconnect && guideStep === GUIDE_VERIFY_STEP && (
            <button
              type="button"
              onClick={() => void refreshStripeOnboarding()}
              disabled={busy !== null}
              className="w-full text-sm text-primary-600 hover:text-black font-medium py-2 disabled:opacity-60"
            >
              {busy === 'refresh' ? 'Opening…' : 'Get a fresh Stripe setup link'}
            </button>
          )}
        </>
      )}
    </div>
  );

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
            {showWizard && guideStep >= GUIDE_CONNECT_STEP && (
              <p className="text-white/70 text-xs mt-1.5 leading-snug">
                Keep this guide and Stripe open side by side. Jump back and forth if you get stuck. Use{' '}
                <strong className="text-white/90">Open Stripe tab</strong> below anytime.
              </p>
            )}
            {showWizard && (
              <div className="flex gap-1 mt-2" role="tablist" aria-label="Onboarding progress">
                {GUIDE_PROGRESS_STEPS.map((step, i) => {
                  const isCurrent = guideStep === i;
                  const isPast = guideStep > i;
                  return (
                    <div
                      key={step.short}
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={step.title}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        isCurrent ? 'bg-white' : isPast ? 'bg-white/60' : 'bg-white/30'
                      }`}
                      title={step.title}
                    />
                  );
                })}
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
          {showWizard ? (
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
                Stripe is connected. Payouts flow directly to your bank.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
