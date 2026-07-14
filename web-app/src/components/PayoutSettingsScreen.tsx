/**
 * Payout Settings — modal Connect hub.
 * Incomplete: embedded onboarding guide + Stripe App.
 * Connected: Payouts | Analytics tabs (Connect status / Express / App vs analytics).
 * Does not auto-dismiss when Connect becomes active.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import BarberAnalyticsPanel from './BarberAnalyticsPanel';
import {
  fetchBarberConnectStatus,
  createBarberConnectOnboarding,
  refreshBarberConnectOnboarding,
  resetBarberConnect,
  fetchBarberStripeDashboardUrl,
  formatPayoutScheduleClarity,
  type BarberConnectStatus,
} from '../services/barber-connect.service';
import {
  fetchBarberPerformance,
  type BarberPerformance,
} from '../services/barber-payout.service';
import { isBarberStripeFullyConnected } from '../utils/stripe-connect-status';

const STRIPE_DASHBOARD_APP_STORE_URL = 'https://apps.apple.com/app/id978516833';
const STRIPE_WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/Stripe,_Inc.';
const ONCUTS_URL = 'https://oncuts.com';
const STRIPE_PURPLE_BTN =
  'w-full bg-[#635BFF] hover:bg-[#5851E6] text-white font-semibold rounded-xl px-4 py-3.5 transition-colors disabled:opacity-60';

const EMPTY_PERFORMANCE: BarberPerformance = {
  has_barber_profile: false,
  totalRevenue: 0,
  totalBarberEarnings: 0,
  totalPlatformFees: 0,
  totalTips: 0,
  completedBookings: 0,
  cancelledBookings: 0,
  pendingRequests: 0,
  acceptedUpcoming: 0,
  uniqueClients: 0,
  repeatClientPct: 0,
  completionRatePct: 0,
  cardRevenue: 0,
  cardCount: 0,
  cardTips: 0,
  cashRevenue: 0,
  cashCount: 0,
  cashTips: 0,
  averageRating: 0,
  totalReviews: 0,
  averageBookingsPerDay: 0,
  averageBookingsPerWeek: 0,
  averageBookingsPerMonth: 0,
  averageRevenuePerDay: 0,
  averageRevenuePerWeek: 0,
  averageRevenuePerMonth: 0,
  averageCostPerAppointment: 0,
  averageTakeHomePerAppointment: 0,
};

const LEARN_MORE_LINK_CLASS =
  'text-purple-600 bg-purple-50 px-1 rounded underline font-semibold hover:text-purple-800 hover:bg-purple-100';

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
      'A US mobile number you can receive SMS on. Use the same number you use for OnCuts Provider if possible.',
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
    input: ONCUTS_URL,
    copyable: true,
  },
  {
    id: 'bank',
    label: 'Bank account (external account)',
    input:
      'Select your bank institution in Stripe (Chase, Wells Fargo, etc) and connect the account where you want payouts deposited.',
  },
  {
    id: 'link',
    label: 'Continue with Link',
    input: 'Not now',
  },
  {
    id: 'tos',
    label: 'Accept terms of service',
    input:
      'Read and accept the Stripe Connected Account Agreement. Payments and payouts stay blocked until you accept.',
  },
] as const;

type StripeRequirementId = (typeof STRIPE_REQUIRED_ACTIONS)[number]['id'];

function apiErrorDetails(err: unknown): { message?: string; code?: string } {
  if (!err || typeof err !== 'object' || !('response' in err)) return {};
  const errBody = (err as { response?: { data?: { error?: { message?: string; code?: string } } } })
    .response?.data?.error;
  return { message: errBody?.message, code: errBody?.code };
}

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
        className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Copy text to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ChecklistDrawerPanel({
  expandedId,
  onToggle,
}: {
  expandedId: StripeRequirementId | null;
  onToggle: (id: StripeRequirementId) => void;
}) {
  return (
    <div className="space-y-3 p-5">
      <h3 className="text-lg font-semibold text-gray-900">Checklist</h3>
      <p className="text-sm text-gray-600">
        Guidance only — expanding an item does not verify that you finished it in Stripe.
      </p>
      <ul className="space-y-2">
        {STRIPE_REQUIRED_ACTIONS.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-2 border-t border-gray-100">
                  {'copyable' in item && item.copyable ? (
                    <ChecklistInputBlock text={item.input} />
                  ) : (
                    <p className="text-sm text-gray-600 leading-relaxed">{item.input}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StripeAppSection({ className = '' }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 space-y-3 flex flex-col ${className}`}
    >
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 text-center">Stripe App</h3>
      <a
        href={STRIPE_DASHBOARD_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs sm:text-sm font-semibold text-gray-800 hover:bg-gray-50 text-center mt-auto"
      >
        Get Stripe App
      </a>
    </section>
  );
}

interface PayoutSettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  /** Refresh parent Stripe gate after status changes (does not dismiss this screen). */
  onStatusChange?: () => void;
}

export default function PayoutSettingsScreen({
  isOpen,
  onClose,
  onStatusChange,
}: PayoutSettingsScreenProps) {
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'stripe' | 'dashboard' | 'recheck' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [expandedRequirementId, setExpandedRequirementId] = useState<StripeRequirementId | null>(
    null
  );
  const [stripeTabOpened, setStripeTabOpened] = useState(false);
  const [platformSetupBlocked, setPlatformSetupBlocked] = useState<string | null>(null);
  const [panel, setPanel] = useState<'payouts' | 'analytics'>('payouts');
  const [performance, setPerformance] = useState<BarberPerformance>(EMPTY_PERFORMANCE);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [analyticsRefreshSignal, setAnalyticsRefreshSignal] = useState(0);
  const loadRef = useRef<() => Promise<BarberConnectStatus | null>>(async () => null);

  const load = useCallback(async () => {
    try {
      const status = await fetchBarberConnectStatus();
      setConnectStatus(status);
      onStatusChange?.();
      return status;
    } catch (e) {
      console.error(e);
      setConnectStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  loadRef.current = load;

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setLoading(true);
      setStripeTabOpened(false);
      setPlatformSetupBlocked(null);
      setChecklistOpen(false);
      setPanel('payouts');
      void loadRef.current();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => {
        setIsVisible(false);
        setPanel('payouts');
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const loadPerformance = useCallback(async () => {
    try {
      setPerformanceLoading(true);
      const perf = await fetchBarberPerformance();
      setPerformance(perf);
    } catch (e) {
      console.error(e);
      toast.error('Could not load business analytics');
      setPerformance(EMPTY_PERFORMANCE);
    } finally {
      setPerformanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || panel !== 'analytics') return;
    void loadPerformance();
  }, [isOpen, panel, loadPerformance]);

  const handleAnalyticsRefresh = async () => {
    await loadPerformance();
    setAnalyticsRefreshSignal((n) => n + 1);
  };

  const selectPanel = (next: 'payouts' | 'analytics') => {
    setPanel(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        const status = await loadRef.current();
        if (stripeTabOpened && status && isBarberStripeFullyConnected(status)) {
          toast.success("You're fully connected. Payouts and card charges are enabled.");
        }
      })();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isOpen, stripeTabOpened]);

  const handlePrimaryStripeAction = async () => {
    try {
      setBusy('stripe');
      const status = await load();
      if (status && isBarberStripeFullyConnected(status)) {
        toast.success("You're fully connected. Payouts and card charges are enabled.");
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
      toast(
        needsReconnectNow || !hasAccountNow
          ? 'Stripe opened in a new tab. Sign in with your provider email to continue.'
          : 'Finish any remaining items in Stripe, then return here.',
        { icon: '↔️' }
      );
    } catch (err: unknown) {
      const { message: msg, code } = apiErrorDetails(err);
      if (
        code === 'STRIPE_CONNECT_PLATFORM_PROFILE_INCOMPLETE' ||
        code === 'STRIPE_CONNECT_PLATFORM_NOT_ENABLED'
      ) {
        setPlatformSetupBlocked(
          msg ||
            'OnCuts must finish Stripe Connect platform setup before providers can onboard.'
        );
      }
      if (code === 'STRIPE_CONNECT_STALE_ACCOUNT') {
        try {
          const { onboarding_url: resetUrl } = await resetBarberConnect();
          window.open(resetUrl, '_blank', 'noopener,noreferrer');
          setStripeTabOpened(true);
          toast.success('Previous payout account cleared. Stripe opened for a fresh connection.');
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
      toast.error(msg || 'Could not open Stripe Express. Complete Connect setup first.');
    } finally {
      setBusy(null);
    }
  };

  const recheckStatus = async () => {
    try {
      setBusy('recheck');
      const status = await load();
      if (status && isBarberStripeFullyConnected(status)) {
        toast.success("You're fully connected. Payouts and card charges are enabled.");
      } else {
        toast('Still finishing Stripe setup — complete remaining steps, then check again.', {
          icon: '⏳',
        });
      }
    } finally {
      setBusy(null);
    }
  };

  if (!isVisible && !isOpen) return null;

  const fullyConnected = isBarberStripeFullyConnected(connectStatus);
  const hasAccount = Boolean(connectStatus?.has_account);
  const needsReconnect = Boolean(connectStatus?.needs_reconnect);
  const primaryLabel = needsReconnect
    ? 'Reconnect Stripe'
    : !hasAccount
      ? 'Continue with Stripe'
      : 'Open Stripe';

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payout Settings"
    >
      <div
        className={`relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-4 sm:px-6 py-4 flex items-center justify-between z-30 shrink-0 gap-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Payout Settings</h2>
            <p className="text-white/80 text-sm">Stripe Connect and Express dashboard</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shrink-0"
          >
            Close
          </button>
        </div>

        {loading && !connectStatus ? (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <div className="text-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Checking Stripe Connect…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 sm:px-6 pt-3 pb-2 shrink-0 bg-white border-b border-stone-100">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => selectPanel('payouts')}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    panel === 'payouts'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Payouts
                </button>
                <button
                  type="button"
                  onClick={() => selectPanel('analytics')}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    panel === 'analytics'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>

            {panel === 'analytics' ? (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-stone-50">
                <BarberAnalyticsPanel
                  performance={performance}
                  isLoadingPerformance={performanceLoading}
                  payoutScheduleClarity={formatPayoutScheduleClarity(connectStatus?.payoutSchedule, {
                    instantPayoutsEnabled: connectStatus?.instantPayoutsEnabled,
                  })}
                  refreshSignal={analyticsRefreshSignal}
                  onRefresh={handleAnalyticsRefresh}
                />
              </div>
            ) : fullyConnected ? (
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 relative">
                <div className="space-y-6">
                  <section className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-900">Stripe Connect is Active</h3>
                    </div>
                  </section>

                  <div className="grid grid-cols-2 gap-3 items-stretch">
                    <section className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 space-y-3 flex flex-col">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 text-center">
                        Stripe Express
                      </h3>
                      <button
                        type="button"
                        className="w-full bg-[#635BFF] hover:bg-[#5851E6] text-white font-semibold rounded-xl px-3 py-2.5 text-xs sm:text-sm transition-colors disabled:opacity-60 mt-auto"
                        onClick={() => void openStripeDashboard()}
                        disabled={busy !== null}
                      >
                        {busy === 'dashboard' ? 'Opening…' : 'Open Stripe Express'}
                      </button>
                    </section>

                    <StripeAppSection />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 relative">
                <div className="space-y-6 relative min-h-[20rem]">
              {checklistOpen && (
                <button
                  type="button"
                  className="absolute inset-0 z-10 bg-black/40 rounded-xl"
                  aria-label="Close checklist"
                  onClick={() => setChecklistOpen(false)}
                />
              )}
              <div
                className={`absolute top-0 bottom-0 left-0 z-20 w-[min(18.75rem,85vw)] max-h-full overflow-hidden bg-stone-100 border border-gray-200 rounded-xl shadow-xl transition-transform duration-200 ease-in-out ${
                  checklistOpen ? 'translate-x-0' : '-translate-x-[110%]'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-stone-100">
                  <span className="font-semibold text-gray-900">Checklist</span>
                  <button
                    type="button"
                    onClick={() => setChecklistOpen(false)}
                    className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[min(70vh,32rem)]">
                  <ChecklistDrawerPanel
                    expandedId={expandedRequirementId}
                    onToggle={(id) =>
                      setExpandedRequirementId((current) => (current === id ? null : id))
                    }
                  />
                </div>
              </div>

              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setChecklistOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
                  aria-expanded={checklistOpen}
                >
                  {checklistOpen ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Checklist
                </button>

                <div className="text-center space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Payments Onboarding Guide
                  </p>
                  <h3 className="text-xl font-semibold text-gray-900">Welcome to OnCuts Operator!</h3>
                </div>

                <p className="text-base text-gray-600 leading-relaxed">
                  OnCuts relies on a third-party payment processing system. This third-party is{' '}
                  <strong>Stripe</strong>, which you can read more about{' '}
                  <a
                    href={STRIPE_WIKIPEDIA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LEARN_MORE_LINK_CLASS}
                  >
                    here
                  </a>
                  .
                </p>
                <p className="text-base text-gray-600 leading-relaxed">
                  When a client pays by card, Stripe moves your take-home toward your bank
                  {connectStatus?.instantPayoutsEnabled
                    ? ' — eligible Instant Payouts can arrive in minutes'
                    : ''}
                  . Stripe will ask for personal details — open Checklist if you get stuck.
                </p>

                {platformSetupBlocked && (
                  <p className="text-sm text-red-900 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    <strong>Platform setup required:</strong> {platformSetupBlocked}
                  </p>
                )}
                {needsReconnect ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5">
                    Your saved payout account needs a fresh connection. Select{' '}
                    <strong>Reconnect Stripe</strong> below.
                  </p>
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    You&apos;re seeing this because you still need to connect with Stripe to enable
                    safe and secure payments.
                  </p>
                )}

                {stripeTabOpened && (
                  <p className="text-sm text-gray-600">
                    Return here after working in Stripe. We check your progress when you switch back
                    to this tab.
                  </p>
                )}

                <button
                  type="button"
                  className={STRIPE_PURPLE_BTN}
                  onClick={() => void handlePrimaryStripeAction()}
                  disabled={busy !== null || Boolean(platformSetupBlocked)}
                >
                  {busy === 'stripe' ? 'Opening Stripe…' : primaryLabel}
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => void recheckStatus()}
                  disabled={busy !== null}
                >
                  {busy === 'recheck' ? 'Checking…' : "I've finished in Stripe — check again"}
                </Button>
              </div>

              <StripeAppSection />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
