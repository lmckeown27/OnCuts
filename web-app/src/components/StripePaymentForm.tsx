/**
 * Stripe Payment Form Component
 * 
 * Handles post-booking payments using Stripe Elements
 * This component is used AFTER the appointment is completed
 * 
 * Flow:
 * 1. Barber completes service
 * 2. Student is prompted to pay
 * 3. This form creates Payment Intent
 * 4. Student enters card details
 * 5. Stripe processes payment
 * 6. Webhook confirms and distributes funds
 */

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import axios from 'axios';
import toast from 'react-hot-toast';
import Button from './Button';
import Card from './Card';
import { API_BASE_URL } from '../config/constants';

interface StripePaymentFormProps {
  bookingId: string;
  amount: number; // in dollars
  serviceName: string;
  barberName: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  bookingId,
  amount,
  serviceName,
  barberName,
  onSuccess,
  onError,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  /**
   * Step 1 & 3: Create Payment Intent on backend
   */
  const createPaymentIntent = async (): Promise<{
    client_secret: string;
    payment_intent_id: string;
  }> => {
    const token = localStorage.getItem('campuscuts_access_token');

    const response = await axios.post(
      `${API_BASE_URL}/bookings/${bookingId}/payment/create`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.data;
  };

  /**
   * Step 4: Handle payment submission
   */
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Create Payment Intent
      const { client_secret } = await createPaymentIntent();

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Step 2: Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed');
      }

      if (paymentIntent.status === 'succeeded') {
        setPaymentSuccess(true);
        toast.success('Payment successful! Thank you!');

        // Clear card element
        cardElement.clear();

        // Callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(`Payment status: ${paymentIntent.status}`);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Payment failed';
      setError(errorMessage);
      toast.error(errorMessage);

      if (onError) {
        onError(err);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Payment Successful!
          </h3>
          <p className="text-sm text-gray-600">
            Your payment of ${amount.toFixed(2)} has been processed.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {barberName} has received their payout.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Complete Payment
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Service: <span className="font-medium">{serviceName}</span></p>
          <p>Barber: <span className="font-medium">{barberName}</span></p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            Amount: ${amount.toFixed(2)}
          </p>
        </div>
      </div>

      <form onSubmit={handlePayment}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className="border border-gray-300 rounded-md p-3 bg-white">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-xs text-blue-800">
            <strong>Secure Payment:</strong> Your card details are processed securely by Stripe.
            We never see or store your card information.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Protected by Stripe | PCI DSS Compliant
        </p>
      </div>
    </Card>
  );
};

export default StripePaymentForm;

