/**
 * Stripe Connect hub — onboarding, Express dashboard, and payout account management.
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Button from './Button';
import {
  fetchBarberConnectStatus,
  createBarberConnectOnboarding,
  refreshBarberConnectOnboarding,
  fetchBarberStripeDashboardUrl,
  type BarberConnectStatus,
} from '../services/barber-connect.service';

interface StripeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function StripeHubModal({ isOpen, onClose }: StripeHubModalProps) {
  const [connectStatus, setConnectStatus] = useState<BarberConnectStatus | null>(null);
  const [connectStatusUnknown, setConnectStatusUnknown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<'dashboard' | 'onboarding' | 'refresh' | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      setConnectStatusUnknown(false);
      const status = await fetchBarberConnectStatus();
      setConnectStatus(status);
    } catch (e) {
      console.error(e);
      setConnectStatus(null);
      setConnectStatusUnknown(true);
      toast.error('Could not load Stripe status');
    } finally {
      setIsLoading(false);
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

  const openStripeDashboard = async () => {
    try {
      setBusy('dashboard');
      const url = await fetchBarberStripeDashboardUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not open Stripe. Complete Connect setup first.');
    } finally {
      setBusy(null);
    }
  };

  const startStripeOnboarding = async () => {
    try {
      setBusy('onboarding');
      const { onboarding_url: onboardingUrl } = await createBarberConnectOnboarding();
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not start Stripe Connect');
    } finally {
      setBusy(null);
    }
  };

  const refreshStripeOnboarding = async () => {
    try {
      setBusy('refresh');
      const { onboarding_url: onboardingUrl } = await refreshBarberConnectOnboarding();
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not refresh Stripe setup link');
    } finally {
      setBusy(null);
    }
  };

  if (!isVisible && !isOpen) return null;

  const hasAccount = Boolean(connectStatus?.has_account);
  const detailsSubmitted = Boolean(connectStatus?.detailsSubmitted);
  const chargesEnabled = Boolean(connectStatus?.chargesEnabled);
  const payoutsEnabled = Boolean(connectStatus?.payoutsEnabled);
  const fullyConnected = hasAccount && payoutsEnabled;
  const needsSetup = !hasAccount || !payoutsEnabled || !detailsSubmitted;

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Stripe</h2>
            <p className="text-white/80 text-sm">Payments, payouts, and bank account</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading Stripe status…</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">
                PismoPlatforms uses <strong>Stripe Connect</strong> so customer payments go to your linked bank
                account. Stripe handles identity verification, card processing, payout schedules, balances, and tax
                forms—not a PismoPlatforms balance.
              </p>

              {connectStatusUnknown && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Could not verify Stripe status. You can still try connecting below.
                </p>
              )}

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Setup checklist</p>
                <StatusRow label="Stripe account linked" done={hasAccount} />
                <StatusRow label="Identity & business details" done={detailsSubmitted} />
                <StatusRow label="Accept card payments" done={chargesEnabled} />
                <StatusRow label="Bank account & payouts" done={payoutsEnabled} />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">In Stripe Express you can</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Connect or update your bank account</li>
                  <li>View balance, payouts, and transfer history</li>
                  <li>Manage payout schedule and debit card</li>
                  <li>Download tax forms and account documents</li>
                  <li>Update business and personal details</li>
                </ul>
              </div>

              <div className="space-y-3 pt-1">
                {needsSetup ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void startStripeOnboarding()}
                    disabled={busy !== null}
                  >
                    {busy === 'onboarding'
                      ? 'Redirecting to Stripe…'
                      : hasAccount
                        ? 'Complete setup in Stripe'
                        : 'Connect with Stripe'}
                  </Button>
                ) : (
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
                )}

                {hasAccount && (
                  <button
                    type="button"
                    onClick={() => void (fullyConnected ? openStripeDashboard() : refreshStripeOnboarding())}
                    disabled={busy !== null}
                    className="w-full text-sm text-primary-600 hover:text-black font-medium py-2 disabled:opacity-60"
                  >
                    {busy === 'dashboard' || busy === 'refresh'
                      ? 'Redirecting…'
                      : fullyConnected
                        ? 'Manage bank account & payouts in Stripe'
                        : 'Update account details in Stripe'}
                  </button>
                )}
              </div>

              {fullyConnected && (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Stripe is connected — payouts flow directly to your bank.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
