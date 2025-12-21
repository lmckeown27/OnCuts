/**
 * Barber Stripe Connect Onboarding Page
 * 
 * Allows barbers to set up their Stripe Connect account
 * to receive payouts from completed bookings
 * 
 * Flow:
 * 1. Barber clicks "Set up payouts"
 * 2. Backend creates Stripe Connect account
 * 3. Redirect to Stripe onboarding
 * 4. Barber completes verification (legal name, SSN, bank account)
 * 5. Stripe redirects back to CampusCuts
 * 6. Barber can now receive payouts
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { API_BASE_URL } from '../config/constants';

interface ConnectStatus {
  has_account: boolean;
  account_id?: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export const BarberConnectOnboarding = () => {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  /**
   * Check if barber has Stripe Connect account
   */
  const checkConnectStatus = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('campuscuts_access_token');

      const response = await axios.get(`${API_BASE_URL}/barber/connect/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStatus(response.data.data);
    } catch (error: any) {
      toast.error('Failed to check payout status');
      console.error('Connect status error:', error);
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
      const token = localStorage.getItem('campuscuts_access_token');

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

      // Redirect to Stripe onboarding
      window.location.href = onboarding_url;
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
      const token = localStorage.getItem('campuscuts_access_token');

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
      window.location.href = onboarding_url;
    } catch (error: any) {
      toast.error('Failed to refresh onboarding link');
      console.error('Refresh error:', error);
      setIsCreatingAccount(false);
    }
  };

  useEffect(() => {
    checkConnectStatus();
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payout Settings
        </h1>
        <p className="text-gray-600">
          Set up your payout account to receive earnings from completed bookings
        </p>
      </div>

      <Card className="p-6">
        {!status?.has_account && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Set Up Your Payout Account
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              Connect with Stripe to receive instant payouts when you complete bookings.
              You'll need to provide your legal name, SSN, and bank account details.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSetupPayouts}
              disabled={isCreatingAccount}
            >
              {isCreatingAccount ? 'Redirecting to Stripe...' : 'Set Up Payouts'}
            </Button>
            <p className="text-xs text-gray-500 mt-4">
              Powered by Stripe Connect | Secure & PCI Compliant
            </p>
          </div>
        )}

        {status?.has_account && !status.detailsSubmitted && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
              <svg
                className="h-8 w-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
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
              {isCreatingAccount ? 'Redirecting...' : 'Continue Setup'}
            </Button>
          </div>
        )}

        {status?.has_account && status.detailsSubmitted && !status.payoutsEnabled && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
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

        {status?.has_account && status.detailsSubmitted && status.payoutsEnabled && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Payouts Enabled!
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Your payout account is fully set up. You'll receive instant payouts
              when you complete bookings.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="text-sm text-green-800 space-y-1">
                <p><strong>Account ID:</strong> {status.account_id}</p>
                <p><strong>Status:</strong> Verified & Active</p>
                <p><strong>Payout Method:</strong> Instant Transfer (1-2 business days)</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              You can update your payout settings anytime in your Stripe Dashboard
            </p>
          </div>
        )}
      </Card>

      {/* Information Section */}
      <Card className="p-6 mt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          How Payouts Work
        </h4>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start">
            <div className="flex-shrink-0 h-5 w-5 text-blue-600 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3">
              When a student pays for a completed booking, you receive 95% of the payment
              (CampusCuts takes a 5% platform fee)
            </p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-5 w-5 text-blue-600 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="ml-3">
              Payouts are transferred instantly to your bank account
              (typically arrives within 1-2 business days)
            </p>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 h-5 w-5 text-blue-600 mt-0.5">
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
      </Card>
    </div>
  );
};

export default BarberConnectOnboarding;

