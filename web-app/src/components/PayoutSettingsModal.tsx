/**
 * Path B — Payout Settings
 *
 * Barbers link a Sui address (USDC settlement). No Stripe Connect.
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './Button';
import { fetchPathBPayoutStatus, type PathBPayoutStatus } from '../services/path-b-payout.service';
import { persistUserSuiAddress } from '../services/zkLogin.service';
import PayoutBrowserWalletConnect from './PayoutBrowserWalletConnect';

interface PayoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preventClose?: boolean;
  onStatusChange?: (payoutReady: boolean) => void;
}

const ADDR_PLACEHOLDER = '0x followed by 64 hex characters';

export default function PayoutSettingsModal({
  isOpen,
  onClose,
  preventClose = false,
  onStatusChange,
}: PayoutSettingsModalProps) {
  const [status, setStatus] = useState<PathBPayoutStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inputAddress, setInputAddress] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPathBPayoutStatus();
      setStatus(data);
      onStatusChange?.(data.payout_ready);
      if (data.sui_address) {
        setInputAddress(data.sui_address);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error('Could not load payout status');
      setStatus({
        payout_ready: false,
        sui_address: null,
        invalid_stored_address: false,
        stored_address_preview: null,
      });
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

  const handleBackdropClick = () => {
    if (!preventClose || payoutReady) {
      onClose();
    }
  };

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
            <h2 className="text-xl font-bold text-white">Payout Settings</h2>
            <p className="text-white/80 text-sm">
              {preventClose && !payoutReady ? 'Link Sui wallet to accept bookings' : 'Path B — USDC on Sui'}
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
                    Add your Sui address so paid bookings can settle USDC to you. Customers pay in USD via
                    Stripe; you receive on-chain per CampusCuts Path B.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Checking payout status…</p>
            </div>
          ) : (
            <>
              {status?.invalid_stored_address && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                  Stored address {status.stored_address_preview} is not valid. Enter a correct Sui address
                  (0x + 64 hex).
                </div>
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
                  <p className="text-xs text-gray-500 mt-4">
                    To change it, update the field below and save.
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  <div className="flex items-center gap-2 text-primary-600 mb-3">
                    <Wallet className="w-5 h-5" />
                    <h3 className="text-lg font-medium text-gray-900">Your Sui address</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Connect a browser extension or paste an address. Same format as zkLogin-linked addresses.
                  </p>
                  <PayoutBrowserWalletConnect
                    disabled={isSaving}
                    onAddressChosen={(addr) => setInputAddress(addr)}
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sui address</label>
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
                  <PayoutBrowserWalletConnect
                    disabled={isSaving}
                    onAddressChosen={(addr) => setInputAddress(addr)}
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-2">Replace address</label>
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
                <p className="font-medium text-gray-900">How Path B works</p>
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
