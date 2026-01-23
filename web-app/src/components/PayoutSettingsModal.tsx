/**
 * Payout Settings Modal
 * 
 * Modal for barbers to set up their Stripe Connect account
 * to receive payouts from completed bookings
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Button from './Button';
import { API_BASE_URL } from '../config/constants';

interface PayoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConnectStatus {
  has_account: boolean;
  account_id?: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export default function PayoutSettingsModal({ isOpen, onClose }: PayoutSettingsModalProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation handling
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      checkConnectStatus();
    } else {
      const timer = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /**
   * Check if barber has Stripe Connect account
   */
  const checkConnectStatus = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.get(`${API_BASE_URL}/barber/connect/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStatus(response.data.data);
    } catch (error: any) {
      // If 401, the user might not be a barber - show the setup screen anyway
      if (error.response?.status === 401) {
        setStatus({ has_account: false, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false });
      } else {
        toast.error('Failed to check payout status');
        console.error('Connect status error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create Stripe Connect account and redirect to onboarding
   */
  const handleSetupPayouts = async () => {
    try {
      setIsCreatingAccount(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.post(
        `${API_BASE_URL}/barber/connect/create`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { onboarding_url } = response.data.data;

      // Open Stripe onboarding in new tab
      window.open(onboarding_url, '_blank');
    } catch (error: any) {
      toast.error('Failed to create payout account');
      console.error('Connect creation error:', error);
      setIsCreatingAccount(false);
    }
  };

  /**
   * Refresh onboarding link if user needs to complete setup
   */
  const handleContinueOnboarding = async () => {
    try {
      setIsCreatingAccount(true);
      const token = localStorage.getItem('accessToken');

      const response = await axios.post(
        `${API_BASE_URL}/barber/connect/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { onboarding_url } = response.data.data;
      window.open(onboarding_url, '_blank');
    } catch (error: any) {
      toast.error('Failed to refresh onboarding link');
      console.error('Refresh error:', error);
      setIsCreatingAccount(false);
    }
  };

  if (!isVisible && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isOpen ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90dvh] overflow-hidden transition-all duration-150 ease-out ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Payout Settings</h2>
            <p className="text-white/80 text-sm">Set up your payout account</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90dvh-80px)]">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Checking payout status...</p>
            </div>
          ) : (
            <>
              {/* No Account - Setup */}
              {!status?.has_account && (
                <div className="text-center py-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Set Up Your Payout Account
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Connect with Stripe to receive instant payouts when you complete bookings.
                    You'll need to provide your legal name, SSN, and bank account details.
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSetupPayouts}
                    disabled={isCreatingAccount}
                  >
                    {isCreatingAccount ? 'Opening Stripe...' : 'Set Up Payouts'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-4">
                    Powered by Stripe Connect | Secure & PCI Compliant
                  </p>
                </div>
              )}

              {/* Incomplete Onboarding */}
              {status?.has_account && !status.detailsSubmitted && (
                <div className="text-center py-6">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Complete Your Onboarding
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    You started setting up payouts but didn't finish. Click below to continue.
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleContinueOnboarding}
                    disabled={isCreatingAccount}
                  >
                    {isCreatingAccount ? 'Opening Stripe...' : 'Continue Setup'}
                  </Button>
                </div>
              )}

              {/* Verification In Progress */}
              {status?.has_account && status.detailsSubmitted && !status.payoutsEnabled && (
                <div className="text-center py-6">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                    <Clock className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Verification In Progress
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Stripe is verifying your account details. This usually takes a few minutes to a few hours.
                    You'll be notified once verification is complete.
                  </p>
                  <Button variant="secondary" onClick={checkConnectStatus}>
                    Refresh Status
                  </Button>
                </div>
              )}

              {/* Fully Enabled */}
              {status?.has_account && status.detailsSubmitted && status.payoutsEnabled && (
                <div className="text-center py-6">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Payouts Enabled!
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Your payout account is fully set up. You'll receive instant payouts
                    when you complete bookings.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-left">
                    <div className="text-sm text-green-800 space-y-1">
                      <p><strong>Account ID:</strong> {status.account_id?.slice(0, 12)}...</p>
                      <p><strong>Status:</strong> Verified & Active</p>
                      <p><strong>Payout Method:</strong> Instant Transfer (1-2 business days)</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    You can update your payout settings anytime in your Stripe Dashboard
                  </p>
                </div>
              )}

              {/* How Payouts Work - Always visible */}
              <div className="border-t border-gray-200 mt-6 pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">How Payouts Work</h4>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-5 w-5 text-primary-600 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <p className="ml-3">
                      When a student pays for a completed booking, funds are securely transferred to your connected Stripe account
                    </p>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-5 w-5 text-primary-600 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <p className="ml-3">
                      Payouts are transferred to your bank account (typically arrives within 1-2 business days)
                    </p>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-5 w-5 text-primary-600 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <p className="ml-3">
                      All payments are processed securely by Stripe
                    </p>
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}

