/**
 * Business Analytics & Core Operations — Stripe Connect payouts and barber performance metrics.
 */

import { useState, useEffect } from 'react';
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
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 text-white px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Business Analytics &amp; Operations</h2>
            <p className="text-white/80 text-sm">Performance insights · Stripe Connect payouts</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading business analytics…</p>
            </div>
          ) : connected ? (
            <BarberAnalyticsPanel
              performance={performance}
              isLoadingPerformance={false}
            />
          ) : (
            <div className="py-6 sm:py-10">
              <div className="max-w-md mx-auto text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {hasPartialAccount ? 'Finish payout setup' : 'Connect your banking data'}
                </h3>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  {hasPartialAccount
                    ? 'Your Stripe account exists but payouts are not active yet. Complete onboarding to unlock business analytics and receive deposits.'
                    : 'Link Stripe Connect to track earnings, view performance analytics, and receive payouts directly to your bank. CampusCuts does not hold barber funds.'}
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
                    className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Open Stripe dashboard
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
