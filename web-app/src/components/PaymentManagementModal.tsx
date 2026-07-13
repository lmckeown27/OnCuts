/**
 * Business Analytics — bottom sheet from Account menu (iOS-style), drag indicator.
 * Connected providers see Performance | Clients analytics; others get Connect onboarding.
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import BarberAnalyticsPanel from './BarberAnalyticsPanel';
import {
  fetchBarberPerformance,
  type BarberPerformance,
} from '../services/barber-payout.service';
import {
  fetchBarberConnectStatus,
  createBarberConnectOnboarding,
  fetchBarberStripeDashboardUrl,
  formatPayoutScheduleClarity,
  type BarberConnectStatus,
} from '../services/barber-connect.service';

interface PaymentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isPayoutConnected(status: BarberConnectStatus | null): boolean {
  return Boolean(status?.has_account && status?.payoutsEnabled);
}

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

export default function PaymentManagementModal({ isOpen, onClose }: PaymentManagementModalProps) {
  const [performance, setPerformance] = useState<BarberPerformance>(EMPTY_PERFORMANCE);
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [connectStatusUnknown, setConnectStatusUnknown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectBusy, setConnectBusy] = useState<'dashboard' | 'onboarding' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const load = async () => {
    try {
      setIsLoading(true);
      setConnectStatusUnknown(false);
      const [perfRes, connRes] = await Promise.allSettled([
        fetchBarberPerformance(),
        fetchBarberConnectStatus(),
      ]);
      setPerformance(perfRes.status === 'fulfilled' ? perfRes.value : EMPTY_PERFORMANCE);
      if (connRes.status === 'fulfilled') {
        setConnectStatus(connRes.value);
      } else {
        console.error(connRes.reason);
        setConnectStatus(null);
        setConnectStatusUnknown(true);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error('Could not load business analytics');
      setPerformance(EMPTY_PERFORMANCE);
      setConnectStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await load();
    setRefreshSignal((n) => n + 1);
  };

  const openStripeDashboard = async () => {
    try {
      setConnectBusy('dashboard');
      const url = await fetchBarberStripeDashboardUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not open Stripe. Try completing Connect setup first.');
    } finally {
      setConnectBusy(null);
    }
  };

  const startStripeOnboarding = async () => {
    try {
      setConnectBusy('onboarding');
      const { onboarding_url: onboardingUrl } = await createBarberConnectOnboarding();
      window.location.assign(onboardingUrl);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not start Stripe Connect');
      setConnectBusy(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      void load();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const t = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  const connected = isPayoutConnected(connectStatus);
  const hasPartialAccount = Boolean(connectStatus?.has_account && !connectStatus?.payoutsEnabled);

  return (
    <div
      className={`fixed inset-0 z-50 min-h-[100dvh] flex items-end sm:items-center justify-center transition-colors duration-200 ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-stone-50 w-full sm:max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out ${
          isAnimating
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Business Analytics"
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
        </div>

        <div className="px-4 sm:px-5 pt-1 pb-3 flex items-center justify-between border-b border-stone-200/80 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Business Analytics</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-200/60 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {connected ? (
          <BarberAnalyticsPanel
            performance={performance}
            isLoadingPerformance={isLoading}
            payoutScheduleClarity={formatPayoutScheduleClarity(connectStatus?.payoutSchedule)}
            refreshSignal={refreshSignal}
            onRefresh={handleRefresh}
          />
        ) : isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4">
            <div className="animate-spin w-8 h-8 border-2 border-stone-200 border-t-[#708d81] rounded-full mb-3" />
            <p className="text-sm text-gray-500">Loading business analytics…</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-5 py-6">
            <div className="max-w-md mx-auto text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {hasPartialAccount ? 'Finish payout setup' : 'Connect your banking data'}
              </h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                {hasPartialAccount
                  ? 'Your Stripe account exists but payouts are not active yet. Complete onboarding to unlock business analytics and receive deposits.'
                  : 'Link Stripe Connect to track earnings, view performance analytics, and receive payouts directly to your bank. OnCuts does not hold barber funds.'}
              </p>
              {connectStatusUnknown && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  Could not verify Connect status. You can still start or continue setup below.
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto min-w-[240px]"
                onClick={() => void startStripeOnboarding()}
                disabled={connectBusy !== null}
              >
                {connectBusy === 'onboarding'
                  ? 'Redirecting to Stripe…'
                  : hasPartialAccount
                    ? 'Complete Stripe Connect setup'
                    : 'Connect Stripe Connect'}
              </Button>
              {connectStatus?.has_account && (
                <button
                  type="button"
                  onClick={() => void openStripeDashboard()}
                  disabled={connectBusy !== null}
                  className="mt-4 text-sm text-[#708d81] hover:text-black font-medium"
                >
                  Open Stripe dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
