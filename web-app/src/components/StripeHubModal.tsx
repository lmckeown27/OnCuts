/**
 * Stripe Connect hub: onboarding guide, Express dashboard, payout management.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Check, Copy } from 'lucide-react';
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

const LEARN_MORE_LINK_CLASS =
  'text-purple-600 bg-purple-50 px-1 rounded underline font-semibold hover:text-purple-800 hover:bg-purple-100';
const STRIPE_WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/Stripe,_Inc.';
const TIVELA_PLATFORMS_URL = 'www.tivelaplatforms.com';

/** Matches Stripe Dashboard “Actions required” for Express individual providers on TivelaPlatforms. */
const STRIPE_REQUIRED_ACTIONS = [
  {
    id: 'dob',
    label: 'Date of birth',
    input:
      'Your legal date of birth exactly as it appears on your government ID (MM / DD / YYYY).',
  },
  {
    id: 'address',
    label: 'Home address',
    input:
      'Your current residential street address, city, state, and ZIP. Use the address on your ID or bank statements.',
  },
  {
    id: 'phone',
    label: 'Phone number',
    input:
      'A US mobile number you can receive SMS on. Use the same number you use for TivelaProvider if possible.',
  },
  {
    id: 'ssn',
    label: 'Last four digits of SSN',
    input:
      'The last 4 digits of your Social Security number as the account representative. Stripe will never ask for your full SSN.',
  },
  {
    id: 'industry',
    label: 'Industry',
    input: 'Other personal services',
    copyable: true,
  },
  {
    id: 'website',
    label: 'Business website',
    input: TIVELA_PLATFORMS_URL,
    copyable: true,
  },
  {
    id: 'bank',
    label: 'Bank account (external account)',
    input:
      'Select your bank institution in Stripe (Chase, Wells Fargo, etc) and connect the account where you want payouts deposited.',
  },
  {
    id: 'tos',
    label: 'Accept terms of service',
    input:
      'Read and accept the Stripe Connected Account Agreement. Payments and payouts stay blocked until you accept.',
  },
] as const;

type StripeRequirementId = (typeof STRIPE_REQUIRED_ACTIONS)[number]['id'];

function ChecklistInputBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy text');
    }
  };

  return (
    <div className="flex items-start gap-2">
      <p className="text-sm text-gray-600 leading-relaxed select-text flex-1 min-w-0">{text}</p>
      <button
        type="button"
        onClick={(event) => void handleCopy(event)}
        className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Copy text to clipboard"
        title="Copy"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function StripeRequirementsDrawerPanel({
  expandedId,
  onToggle,
}: {
  expandedId: StripeRequirementId | null;
  onToggle: (id: StripeRequirementId) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-gray-600">
          Select an item you are confused on during the onboarding process.
        </p>
      </div>
      <ul className="space-y-2">
        {STRIPE_REQUIRED_ACTIONS.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset"
              >
                <span className="text-sm font-medium text-gray-900 leading-snug">{item.label}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-3 pb-3 pt-3 border-t border-gray-100">
                    {'copyable' in item && item.copyable ? (
                      <ChecklistInputBlock text={item.input} />
                    ) : (
                      <p className="text-sm text-gray-600 leading-relaxed">{item.input}</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CHECKLIST_TOGGLE_FALLBACK_TOP_PX = 112;

function apiErrorDetails(err: unknown): { message?: string; code?: string } {
  if (!err || typeof err !== 'object' || !('response' in err)) return {};
  const errBody = (err as { response?: { data?: { error?: { message?: string; code?: string } } } }).response
    ?.data?.error;
  return { message: errBody?.message, code: errBody?.code };
}

export default function StripeHubModal({
  isOpen,
  onClose,
  blocking = false,
  onFullyConnected,
}: StripeHubModalProps) {
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [connectStatusUnknown, setConnectStatusUnknown] = useState(false);
  const [busy, setBusy] = useState<'stripe' | 'dashboard' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [requirementsDrawerOpen, setRequirementsDrawerOpen] = useState(false);
  const [expandedRequirementId, setExpandedRequirementId] = useState<StripeRequirementId | null>(null);
  const [stripeTabOpened, setStripeTabOpened] = useState(false);
  const [platformSetupBlocked, setPlatformSetupBlocked] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const welcomeRowRef = useRef<HTMLDivElement>(null);
  const checklistToggleRef = useRef<HTMLButtonElement>(null);
  const [checklistToggleTopPx, setChecklistToggleTopPx] = useState<number | null>(null);

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
    if (!isOpen) {
      setRequirementsDrawerOpen(false);
      setExpandedRequirementId(null);
    }
  }, [isOpen]);

  const updateChecklistTogglePosition = useCallback(() => {
    const modal = modalPanelRef.current;
    const welcomeRow = welcomeRowRef.current;
    const toggle = checklistToggleRef.current;
    if (!modal || !welcomeRow) return;

    const modalTop = modal.getBoundingClientRect().top;
    const welcomeRowRect = welcomeRow.getBoundingClientRect();
    const toggleHeight = toggle?.getBoundingClientRect().height ?? 56;
    const top =
      welcomeRowRect.top - modalTop + Math.max(0, (welcomeRowRect.height - toggleHeight) / 2);
    setChecklistToggleTopPx(Math.round(top));
  }, []);

  useEffect(() => {
    if (!isOpen || !isVisible) {
      setChecklistToggleTopPx(null);
      return;
    }

    const scheduleUpdate = () => {
      requestAnimationFrame(updateChecklistTogglePosition);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);

    const observer = new ResizeObserver(scheduleUpdate);
    const modal = modalPanelRef.current;
    const welcomeRow = welcomeRowRef.current;
    if (modal) observer.observe(modal);
    if (welcomeRow) observer.observe(welcomeRow);

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      observer.disconnect();
    };
  }, [isOpen, isVisible, isAnimating, connectStatus, updateChecklistTogglePosition]);

  const stripeTabOpenedRef = useRef(false);
  stripeTabOpenedRef.current = stripeTabOpened;

  useEffect(() => {
    if (!isOpen) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        const status = await loadRef.current();
        if (stripeTabOpenedRef.current && status && isBarberStripeFullyConnected(status)) {
          toast.success('Stripe setup complete. Your dashboard is unlocked.');
        }
      })();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isOpen]);

  const handlePrimaryStripeAction = async () => {
    try {
      setBusy('stripe');
      const status = await load();
      if (status && isBarberStripeFullyConnected(status)) {
        toast.success('Stripe setup complete. Your dashboard is unlocked.');
        return;
      }

      const needsReconnectNow = Boolean(status?.needs_reconnect);
      const hasAccountNow = Boolean(status?.has_account);
      const { onboarding_url: onboardingUrl } =
        needsReconnectNow || !hasAccountNow
          ? needsReconnectNow
            ? await resetBarberConnect()
            : await createBarberConnectOnboarding()
          : await refreshBarberConnectOnboarding();

      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
      setStripeTabOpened(true);
      await load();

      if (needsReconnectNow || !hasAccountNow) {
        toast.success('Stripe opened in a new tab. Sign in with your TivelaProvider email to continue.');
      } else {
        toast('Finish any remaining items in Stripe, then return here. We check your progress automatically.', {
          icon: '↔️',
        });
      }
    } catch (err: unknown) {
      const { message: msg, code } = apiErrorDetails(err);
      if (code === 'STRIPE_CONNECT_PLATFORM_PROFILE_INCOMPLETE') {
        setPlatformSetupBlocked(
          msg ||
            'TivelaPlatforms must finish Stripe Connect platform setup in the Stripe Dashboard before barbers can onboard.'
        );
      }
      if (code === 'STRIPE_CONNECT_STALE_ACCOUNT') {
        try {
          const { onboarding_url: resetUrl } = await resetBarberConnect();
          window.open(resetUrl, '_blank', 'noopener,noreferrer');
          setStripeTabOpened(true);
          toast.success(
            'Previous payout account cleared. Stripe opened for a fresh Tivela Platforms connection.'
          );
          await load();
          return;
        } catch {
          await load();
        }
      }
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

  if (!isVisible && !isOpen) return null;

  const hasAccount = Boolean(connectStatus?.has_account);
  const needsReconnect = Boolean(connectStatus?.needs_reconnect);
  const fullyConnected = isBarberStripeFullyConnected(connectStatus);
  const needsSetup = !fullyConnected;
  const canDismiss = !blocking || fullyConnected;
  const showWizard = needsSetup || blocking;
  const showRequirementsDrawer = showWizard;
  const primaryStripeButtonLabel =
    !hasAccount || needsReconnect ? 'Continue with Stripe' : 'Open Stripe';

  const toggleRequirement = (id: StripeRequirementId) => {
    setExpandedRequirementId((current) => (current === id ? null : id));
  };

  const handleBackdropClick = () => {
    if (canDismiss) onClose();
  };

  const renderConnectAlerts = () => (
    <>
      {platformSetupBlocked && (
        <p className="text-sm text-red-900 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 leading-relaxed">
          <strong>Platform setup required:</strong> {platformSetupBlocked} Stripe Dashboard →{' '}
          <a
            href="https://dashboard.stripe.com/connect/accounts/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Connect → Accounts overview
          </a>{' '}
          (toggle <strong>live mode</strong> on). This is a one-time step for the TivelaPlatforms owner, not something
          barbers can fix themselves.
        </p>
      )}
      {connectStatusUnknown && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          Could not verify Stripe status. You can still start connecting below.
        </p>
      )}
      {needsReconnect && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5">
          Your saved payout account is from a previous Stripe setup (test mode or an old platform account). Select{' '}
          <strong>Continue with Stripe</strong> below to create a fresh connection to the current live payout account.
        </p>
      )}
    </>
  );

  const renderOnboardingContent = () => (
    <div className="space-y-5">
      <div
        ref={welcomeRowRef}
        className="min-h-[3.75rem] flex items-center justify-center"
      >
        <h3 className="text-xl font-semibold text-gray-900 text-center">Welcome to Tivela Provider!</h3>
      </div>
      <p className="text-base text-gray-600 leading-relaxed">
        TivelaPlatforms relies on a third-party payment processing system. This third-party is{' '}
        <strong>Stripe</strong>, which you can read more about{' '}
        <a
          href={STRIPE_WIKIPEDIA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LEARN_MORE_LINK_CLASS}
        >
              here
            </a>
      </p>
      <p className="text-base text-gray-600 leading-relaxed">
        When a client pays you, the transaction is handled by <strong>Stripe</strong>. Stripe securely moves
        funds from your customers to your <strong>bank account</strong>.
      </p>
      <p className="text-base text-gray-600 leading-relaxed">
        Stripe will ask for <strong>personal details</strong> (date of birth, address, bank account, and more). Use
        the button below to connect payouts with <strong>TivelaPlatforms</strong>.
      </p>
      <p className="text-base text-gray-600 leading-relaxed text-center">
        Stuck on a step? Open <strong>Checklist</strong> in the top left corner.
      </p>
      {renderConnectAlerts()}
      {stripeTabOpened && !fullyConnected ? (
        <p className="text-base text-gray-600">
          Return here after working in Stripe. We automatically check your progress when you switch back to this tab.
        </p>
      ) : null}
      {fullyConnected && (
        <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Stripe is connected. Payouts flow directly to your bank. Your dashboard is unlocked.
        </div>
      )}
    </div>
  );

  const renderOnboardingActions = () => (
    <Button
      type="button"
      variant="primary"
      size="lg"
      className="w-full"
      onClick={() => void handlePrimaryStripeAction()}
      disabled={busy !== null || Boolean(platformSetupBlocked)}
    >
      {busy === 'stripe' ? 'Opening Stripe…' : primaryStripeButtonLabel}
    </Button>
  );

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center p-2 sm:p-4 transition-all duration-150 ease-out ${
        blocking ? 'z-[100]' : 'z-50'
      } ${isAnimating ? 'bg-black/50' : 'bg-black/0'}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalPanelRef}
        className={`relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {showRequirementsDrawer && (
          <>
            {requirementsDrawerOpen && (
              <button
                type="button"
                className="absolute inset-0 z-[15] bg-black/20"
                aria-label="Close Stripe checklist panel"
                onClick={() => setRequirementsDrawerOpen(false)}
              />
            )}
            <div
              className={`absolute top-0 bottom-0 left-0 z-20 flex items-stretch transition-transform duration-200 ease-out ${
                requirementsDrawerOpen ? 'translate-x-0' : '-translate-x-[calc(100%-3.75rem)]'
              }`}
            >
              <div className="w-96 max-w-[90vw] h-full overflow-y-auto bg-white border-r border-gray-200 shadow-xl">
                <div className="min-h-full flex flex-col justify-center p-5">
                  <StripeRequirementsDrawerPanel
                    expandedId={expandedRequirementId}
                    onToggle={toggleRequirement}
                  />
                </div>
              </div>
              <button
                ref={checklistToggleRef}
                type="button"
                onClick={() => setRequirementsDrawerOpen((open) => !open)}
                aria-expanded={requirementsDrawerOpen}
                aria-label={requirementsDrawerOpen ? 'Hide Stripe checklist' : 'Show Stripe checklist'}
                className={`self-start origin-left flex flex-col items-center gap-1 w-[3.75rem] shrink-0 px-1.5 py-2.5 bg-white border border-gray-200 border-l-0 rounded-r-lg shadow-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 motion-safe:transition-transform ${
                  requirementsDrawerOpen
                    ? ''
                    : 'motion-safe:animate-checklist-tab-bounce motion-reduce:animate-none'
                }`}
                style={{ marginTop: checklistToggleTopPx ?? CHECKLIST_TOGGLE_FALLBACK_TOP_PX }}
              >
                {requirementsDrawerOpen ? (
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="text-[11px] font-semibold text-gray-700 leading-tight text-center">Checklist</span>
              </button>
            </div>
          </>
        )}
        <div className="sticky top-0 bg-gradient-to-r from-brand-500 to-brand-600 text-white px-8 py-5 z-10 shrink-0">
          <div
            className={`min-w-0 text-center${canDismiss ? ' pr-16' : ''}${showRequirementsDrawer ? ' pl-14' : ''}`}
          >
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">Payments Onboarding Guide</h2>
            {showWizard && (
              <p className="text-white/70 text-xs mt-1.5 leading-snug">
                Open <strong className="text-white/90">Checklist</strong> for help on any field. Jump back and forth
                if you&apos;re stuck.
              </p>
            )}
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-8 text-white hover:bg-white/20 rounded-lg px-4 py-2 text-base font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>

        <div
          className={`p-6 sm:p-8 overflow-y-auto flex-1 space-y-6${showRequirementsDrawer ? ' pl-14 sm:pl-16' : ''}`}
        >
          {showWizard ? (
            <>
              {renderOnboardingContent()}
              <div className="space-y-3 pt-1 border-t border-gray-100">{renderOnboardingActions()}</div>
            </>
          ) : (
            <>
              <p className="text-base text-gray-600 leading-relaxed">
                TivelaPlatforms uses <strong>Stripe Connect</strong> so customer payments go to your linked bank
                account.
              </p>
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
                  className="w-full text-base text-primary-600 hover:text-black font-medium py-2.5 disabled:opacity-60"
                >
                  Manage bank account & payouts in Stripe
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
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
