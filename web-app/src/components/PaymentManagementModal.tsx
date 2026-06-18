/**
 * Business Analytics & Core Operations — Stripe Connect payouts and barber performance metrics.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { X, ExternalLink, Landmark, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import {
  fetchBarberPayoutSummary,
  type BarberPayoutSummary,
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

function formatUsd(dollars: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(dollars) ? dollars : 0
  );
}

function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function isPayoutConnected(status: BarberConnectStatus | null): boolean {
  return Boolean(status?.has_account && status?.payoutsEnabled);
}

function MetricBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
      {children}
    </div>
  );
}

function OperationalMetricCard({
  label,
  value,
  description,
  badge,
}: {
  label: string;
  value: string;
  description: string;
  badge: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex gap-3">
      <MetricBadge>{badge}</MetricBadge>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
        <p className="text-xs text-gray-500 mt-1 leading-snug">{description}</p>
      </div>
    </div>
  );
}

function FinanceLedgerCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex-shrink-0 min-w-[140px] flex-1 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

export default function PaymentManagementModal({ isOpen, onClose }: PaymentManagementModalProps) {
  const [summary, setSummary] = useState<BarberPayoutSummary | null>(null);
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
      const [sumRes, connRes] = await Promise.allSettled([
        fetchBarberPayoutSummary(),
        fetchBarberConnectStatus(),
      ]);
      setSummary(sumRes.status === 'fulfilled' ? sumRes.value : null);
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
      setSummary(null);
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
  const displayTotal = summary?.display_total_dollars ?? 0;
  const recent30Usd = summary ? centsToUsd(summary.recent_30d_barber_cents) : 0;
  const grossVolumeUsd = summary ? centsToUsd(summary.gross_volume_cents ?? 0) : 0;
  const avgTakeHomeUsd = summary ? centsToUsd(summary.avg_take_home_cents ?? 0) : 0;
  const tipsUsd = summary ? centsToUsd(summary.tips_cents ?? 0) : 0;
  const usesLedger = summary && summary.ledger_total_dollars > 0;
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
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading business analytics…</p>
            </div>
          ) : connected ? (
            <div className="space-y-6">
              {/* Financial Overview Block */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-5 h-5 text-primary-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Financial overview</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-snug">
                  Estimates from paid bookings and internal records. Payout cash flows through your{' '}
                  <strong>Stripe Connect</strong> account—not a CampusCuts balance.
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  <FinanceLedgerCell
                    label="Estimated take-home"
                    value={formatUsd(displayTotal)}
                    hint={
                      usesLedger
                        ? 'From ledger records'
                        : 'After ~15% platform fee + tips'
                    }
                  />
                  <FinanceLedgerCell
                    label="Gross volume"
                    value={formatUsd(grossVolumeUsd)}
                    hint="Customer checkout totals (paid)"
                  />
                  <FinanceLedgerCell
                    label="Last 30 days"
                    value={formatUsd(recent30Usd)}
                    hint="Estimated barber share"
                  />
                  <FinanceLedgerCell
                    label="Paid bookings"
                    value={String(summary?.paid_bookings_count ?? 0)}
                    hint="Completed checkout"
                  />
                  {usesLedger && summary && (
                    <>
                      <FinanceLedgerCell
                        label="Recorded settled"
                        value={formatUsd(summary.ledger_paid_out_dollars)}
                        hint="Ledger succeeded"
                      />
                      {summary.ledger_pending_dollars > 0 && (
                        <FinanceLedgerCell
                          label="Recorded pending"
                          value={formatUsd(summary.ledger_pending_dollars)}
                          hint="Awaiting settlement"
                        />
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Operational Performance Grid */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Operational performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <OperationalMetricCard
                    label="Completion rate"
                    value={formatPct(summary?.completion_rate_pct ?? 0)}
                    description="Share of finished appointments vs cancellations and rejections"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Unique clients"
                    value={String(summary?.unique_clients_count ?? 0)}
                    description="Distinct customers with completed or paid appointments"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Repeat client rate"
                    value={formatPct(summary?.repeat_client_pct ?? 0)}
                    description="Clients who booked two or more times with you"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" />
                        <path d="M21 3v5h-5" strokeLinecap="round" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" />
                        <path d="M3 21v-5h5" strokeLinecap="round" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Avg take-home / booking"
                    value={formatUsd(avgTakeHomeUsd)}
                    description="Average estimated barber share per paid appointment"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" x2="12" y1="2" y2="22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Pending requests"
                    value={String(summary?.pending_requests_count ?? 0)}
                    description="Booking requests awaiting your approval"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Upcoming confirmed"
                    value={String(summary?.accepted_upcoming_count ?? 0)}
                    description="Accepted appointments scheduled ahead"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Average rating"
                    value={
                      (summary?.avg_rating ?? 0) > 0
                        ? `${(summary?.avg_rating ?? 0).toFixed(1)} ★`
                        : '—'
                    }
                    description={`Based on ${summary?.total_reviews ?? 0} review${(summary?.total_reviews ?? 0) === 1 ? '' : 's'}`}
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    }
                  />
                  <OperationalMetricCard
                    label="Tip volume"
                    value={formatUsd(tipsUsd)}
                    description="Total tips collected on paid bookings"
                    badge={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                  />
                </div>
              </section>

              {/* Subdued Stripe Entry Node */}
              <footer className="bg-slate-50 border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                      Stripe connected
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    Bank transfers, balances, and tax forms live in Stripe Express.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openStripeDashboard()}
                  disabled={connectBusy !== null}
                  className="inline-flex items-center justify-center gap-2 shrink-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-60"
                >
                  Open Stripe
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </footer>
            </div>
          ) : (
            /* State B — Unconnected / missing payout details */
            <div className="py-6 sm:py-10">
              <div className="max-w-md mx-auto text-center">
                <div className="mx-auto mb-6 w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-gray-100 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-14 h-14 text-slate-400" fill="none" aria-hidden="true">
                    <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 24h48" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="32" width="20" height="4" rx="1" fill="currentColor" opacity="0.35" />
                    <rect x="14" y="40" width="14" height="4" rx="1" fill="currentColor" opacity="0.2" />
                    <circle cx="46" cy="38" r="8" stroke="currentColor" strokeWidth="2" />
                    <path d="M43 38l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
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
                  className="w-full sm:w-auto min-w-[240px] inline-flex items-center justify-center gap-2"
                  onClick={() => void startStripeOnboarding()}
                  disabled={connectBusy !== null}
                >
                  <Landmark className="w-5 h-5" />
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
                    className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    Open Stripe dashboard
                    <ExternalLink className="w-3.5 h-3.5" />
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
