/**
 * Payment Management — analytics, bank cash-out planning, and Sui payout address.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Wallet, BarChart3, Landmark, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import {
  fetchBarberPayoutStatus,
  fetchBarberPayoutSummary,
  type BarberPayoutStatus,
  type BarberPayoutSummary,
} from '../services/barber-payout.service';
import { persistUserSuiAddress } from '../services/zkLogin.service';
import PayoutBrowserWalletConnect from './PayoutBrowserWalletConnect';
import SignInWithGoogleZkLoginButton from './SignInWithGoogleZkLoginButton';
import { isZkLoginWalletlessEnabled } from '../config/constants';

interface PaymentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
  onStatusChange?: (payoutReady: boolean) => void;
}

const ADDR_PLACEHOLDER = '0x followed by 64 hex characters';

const SUI_USDC_OVERVIEW_URL = 'https://sui.io/usdc';
const SUI_WALLET_CHROME_URL =
  'https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil';

function formatUsd(dollars: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(dollars) ? dollars : 0
  );
}

function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export default function PaymentManagementModal({
  isOpen,
  onClose,
  preventClose = false,
  onStatusChange,
}: PaymentManagementModalProps) {
  const [status, setStatus] = useState<BarberPayoutStatus | null>(null);
  const [summary, setSummary] = useState<BarberPayoutSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inputAddress, setInputAddress] = useState('');
  const [plannedBankPayout, setPlannedBankPayout] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const [payoutData, paymentSummary] = await Promise.all([
        fetchBarberPayoutStatus(),
        fetchBarberPayoutSummary().catch(() => null),
      ]);
      setStatus(payoutData);
      setSummary(paymentSummary);
      onStatusChange?.(payoutData.payout_ready);
      if (payoutData.sui_address) {
        setInputAddress(payoutData.sui_address);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error('Could not load payment data');
      setStatus({
        payout_ready: false,
        sui_address: null,
        invalid_stored_address: false,
        stored_address_preview: null,
      });
      setSummary(null);
      onStatusChange?.(false);
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

  const handleSaveAddress = async () => {
    const trimmed = inputAddress.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      toast.error(`Enter a valid Sui address (${ADDR_PLACEHOLDER})`);
      return;
    }
    try {
      setIsSaving(true);
      await persistUserSuiAddress(trimmed);
      toast.success('Sui payout address saved');
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isVisible && !isOpen) return null;

  const payoutReady = status?.payout_ready ?? false;
  const zkLoginOn = isZkLoginWalletlessEnabled();

  const handleBackdropClick = () => {
    if (!preventClose || payoutReady) {
      onClose();
    }
  };

  const displayTotal = summary?.display_total_dollars ?? 0;
  const recent30Usd = summary ? centsToUsd(summary.recent_30d_barber_cents) : 0;
  const usesLedger = summary && summary.ledger_total_dollars > 0;

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90dvh] overflow-hidden transition-all duration-150 ease-out ${
          isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Payment Management</h2>
            <p className="text-white/80 text-sm">
              {preventClose && !payoutReady
                ? zkLoginOn
                  ? 'Link a Sui address for USDC—use Google here; no separate wallet app required'
                  : 'Set your Sui payout address to accept bookings'
                : 'USDC on Sui · Stripe checkout'}
            </p>
          </div>
          {(!preventClose || payoutReady) && (
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90dvh-80px)]">
          {preventClose && !isLoading && !payoutReady && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Payout setup required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Add your Sui address so paid bookings can settle USDC to you. Customers pay in USD via Stripe;
                    your share is settled on Sui through CampusCuts.
                    {zkLoginOn ? (
                      <>
                        {' '}
                        <strong className="font-semibold">Use Sign in with Google below</strong> to create your
                        payout address on CampusCuts—you do not need to install a wallet app first.
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading payment data…</p>
            </div>
          ) : (
            <>
              {summary?.has_barber_profile && (
                <div className="mb-6 rounded-xl border border-gray-200 bg-slate-50/90 p-4">
                  <div className="flex items-center gap-2 text-gray-900 mb-3">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                    <h3 className="text-sm font-semibold">Revenue overview</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white border border-gray-100 p-3 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">Estimated received</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">{formatUsd(displayTotal)}</p>
                      <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                        {usesLedger
                          ? 'From payment ledger records.'
                          : 'From paid bookings (~85% of service after platform fee + tips).'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white border border-gray-100 p-3 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">Paid bookings</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">
                        {summary.paid_bookings_count}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Completed checkout</p>
                    </div>
                    <div className="rounded-lg bg-white border border-gray-100 p-3 shadow-sm col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Last 30 days (estimate)</p>
                      <p className="text-base font-semibold text-primary-700 tabular-nums">
                        {formatUsd(recent30Usd)}
                      </p>
                    </div>
                  </div>
                  {usesLedger && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5">
                        Settled (ledger): {formatUsd(summary.ledger_paid_out_dollars)}
                      </span>
                      {summary.ledger_pending_dollars > 0 && (
                        <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5">
                          Pending: {formatUsd(summary.ledger_pending_dollars)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                <div className="flex items-center gap-2 text-gray-900 mb-2">
                  <Landmark className="w-5 h-5 text-primary-600" />
                  <h3 className="text-sm font-semibold">Bank transfer planning</h3>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  CampusCuts sends your share as <strong>USDC on Sui</strong> to the address below. Moving dollars to
                  your bank happens outside the app (exchange, wallet off-ramp, or bridge). Use this field to note how
                  much you intend to cash out.
                </p>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount to move to bank (USD)</label>
                <div className="flex gap-2 items-center">
                  <span className="text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={plannedBankPayout}
                    onChange={(e) => setPlannedBankPayout(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="mt-2 flex items-start gap-2 text-[11px] text-gray-500">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary-500" />
                  <span>
                    This amount is for your own planning only—it does not trigger a transfer. Withdraw USDC from your
                    Sui wallet using your preferred provider, then deposit to your bank.
                  </span>
                </div>
              </div>

              {status?.invalid_stored_address && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                  Stored address {status.stored_address_preview} is not valid. Enter a correct Sui address (0x + 64
                  hex).
                </div>
              )}

              {!zkLoginOn && (
                <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 mb-6 text-sm text-gray-800">
                  <p className="font-semibold text-gray-900 mb-2">How to accept USDC on Sui</p>
                  <ol className="list-decimal pl-5 space-y-2 text-xs text-gray-700 mb-3">
                    <li>
                      You need a <strong>Sui address</strong> (<code className="font-mono">0x</code> + 64 hex). Easiest:{' '}
                      <strong>paste an address you already have</strong> from any Sui wallet you trust.
                    </li>
                    <li>
                      Optional: use <strong>Connect wallet</strong> if you use a browser extension (e.g. official{' '}
                      <a
                        href={SUI_WALLET_CHROME_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 font-medium underline hover:text-primary-800"
                      >
                        Sui Wallet
                      </a>
                      ).
                    </li>
                    <li>
                      Tap <strong>Save payout address</strong>. After customers pay in USD (Stripe), your share settles
                      as USDC on Sui to this address.
                    </li>
                    <li>
                      View USDC in your wallet app or explorer. Overview:{' '}
                      <a
                        href={SUI_USDC_OVERVIEW_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 font-medium underline hover:text-primary-800"
                      >
                        sui.io/usdc
                      </a>
                      .
                    </li>
                  </ol>
                </div>
              )}

              {zkLoginOn && !payoutReady && (
                <>
                  <div className="rounded-xl border-2 border-primary-400/70 bg-white p-5 mb-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-2">
                      Primary — on CampusCuts
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Create your Sui payout address with Google
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      You do <strong>not</strong> need to install a separate wallet app. Sign in with Google once;
                      CampusCuts uses zkLogin to create a Sui address for your account and USDC payouts.
                    </p>
                    <SignInWithGoogleZkLoginButton disabled={isSaving} />
                    <p className="text-xs text-gray-500 mt-3">
                      After you return from Google, we save your address when possible. If the field below is still
                      empty, paste your address from the sign-in result and tap <strong>Save payout address</strong>.
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 mb-6 text-sm text-gray-800">
                    <p className="font-semibold text-gray-900 mb-1">Receiving USDC</p>
                    <p className="text-xs text-gray-700">
                      Customers pay in USD (Stripe); your share settles as USDC on Sui to the linked address. Overview:{' '}
                      <a
                        href={SUI_USDC_OVERVIEW_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 font-medium underline hover:text-primary-800"
                      >
                        sui.io/usdc
                      </a>
                      .
                    </p>
                  </div>
                </>
              )}

              {payoutReady ? (
                <div className="text-center py-4">
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sui payout linked</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Bookings can use this address for USDC settlement after customers pay with Stripe Checkout.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 text-left">
                    <p className="text-xs text-gray-500 mb-1">Address on file</p>
                    <p className="font-mono text-xs break-all text-gray-900">{status?.sui_address}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">To change it, update the field below and save.</p>
                </div>
              ) : (
                <div className="py-2">
                  {zkLoginOn ? (
                    <>
                      <div className="flex items-center gap-2 text-gray-800 mb-2 border-t border-gray-200 pt-6">
                        <Wallet className="w-5 h-5 text-primary-600 flex-shrink-0" />
                        <h3 className="text-base font-semibold text-gray-900">Optional: use a different Sui address</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Only if you want USDC sent somewhere other than the address from{' '}
                        <strong>Sign in with Google</strong> above—for example a hardware wallet or an address you
                        already use elsewhere.
                      </p>
                      <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 mb-4">
                        <p className="text-xs text-gray-600 mb-2">
                          Optional: <strong>Connect wallet</strong> to fill this field from a browser extension.
                        </p>
                        <PayoutBrowserWalletConnect
                          disabled={isSaving}
                          onAddressChosen={(addr) => setInputAddress(addr)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-primary-600 mb-3">
                        <Wallet className="w-5 h-5" />
                        <h3 className="text-lg font-medium text-gray-900">Your Sui address</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Paste an address from any Sui wallet, or use <strong>Connect wallet</strong> if you use a browser
                        extension.
                      </p>
                      <PayoutBrowserWalletConnect
                        disabled={isSaving}
                        onAddressChosen={(addr) => setInputAddress(addr)}
                      />
                    </>
                  )}
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {zkLoginOn ? 'Sui address (optional override)' : 'Sui address'}
                  </label>
                  <textarea
                    value={inputAddress}
                    onChange={(e) => setInputAddress(e.target.value)}
                    placeholder="0x…"
                    rows={3}
                    className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">{ADDR_PLACEHOLDER}</p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mt-4"
                    onClick={() => void handleSaveAddress()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving…' : 'Save payout address'}
                  </Button>
                </div>
              )}

              {payoutReady && (
                <div className="border-t border-gray-200 mt-6 pt-6">
                  {zkLoginOn ? (
                    <div className="mb-4 space-y-2">
                      <p className="text-sm font-medium text-gray-900">Replace with another Google zkLogin address</p>
                      <SignInWithGoogleZkLoginButton disabled={isSaving} />
                    </div>
                  ) : (
                    <PayoutBrowserWalletConnect
                      disabled={isSaving}
                      onAddressChosen={(addr) => setInputAddress(addr)}
                    />
                  )}
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {zkLoginOn ? 'Replace address (or paste)' : 'Replace address'}
                  </label>
                  <textarea
                    value={inputAddress}
                    onChange={(e) => setInputAddress(e.target.value)}
                    rows={2}
                    className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <Button
                    variant="secondary"
                    className="w-full mt-3"
                    onClick={() => void handleSaveAddress()}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving…' : 'Update address'}
                  </Button>
                </div>
              )}

              <div className="border-t border-gray-200 mt-6 pt-6 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-900">How payments work</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Customer pays USD through Stripe Checkout (card / enabled methods).</li>
                  <li>CampusCuts records the booking as paid, then routes settlement to USDC on Sui.</li>
                  <li>Your share is sent to this Sui address (minus platform terms in effect).</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
