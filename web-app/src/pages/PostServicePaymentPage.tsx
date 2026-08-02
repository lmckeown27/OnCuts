/**
 * PostServicePaymentPage - Payment page after service completion
 * 
 * This page is shown when a barber marks a service as complete.
 * - Barber sees a "waiting for payment" view
 * - Consumer sees the Stripe payment form with Apple Pay / Google Pay support
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  CreditCard, Check, Clock, DollarSign, User, Calendar,
  MapPin, ArrowLeft, AlertCircle, Loader2, Undo2, Wallet, Banknote
} from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { TivelaPlatformsLogo } from '@assets';
import toast from 'react-hot-toast';
import socketService from '../services/socket.service';
import { findService } from '../config/services';
import { STRIPE_PUBLIC_KEY } from '../config/constants';
import {
  clearDeferredPaymentTakeover,
  deferPaymentTakeover,
} from '../store/deferredPaymentBookings';
import { useFrontendConfig } from '../hooks/useFrontendConfig';
import SatisfactionRating from '../components/SatisfactionRating';

// Helper to get display name for service
const getServiceDisplayName = (serviceName?: string, serviceType?: string): string => {
  const serviceKey = serviceName || serviceType || '';
  const found = findService(serviceKey);
  return found?.name || serviceKey;
};

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY || 'pk_test_placeholder');

interface BookingDetails {
  id: string;
  status: string;
  serviceName: string;
  serviceType: string;
  priceUsdCents: number;
  tipAmountCents?: number | null;
  totalPaidCents?: number | null;
  paidAt?: string | null;
  tipRequestedAt?: string | null;
  tipDecidedAt?: string | null;
  paymentMethod?: string | null;
  scheduledTime: string;
  location?: string;
  notes?: string;
  barber: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  consumer: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
}

type PayPageMode = 'service' | 'tip';

type PaymentEntryMode = 'manual' | 'wallet' | 'cash';

// Payment Form Component (wrapped in Elements with clientSecret)
function PaymentFormInner({ 
  booking,
  tipAmount,
  totalAmount,
  paymentEntry,
  onSuccess,
  isUpdatingIntent = false,
}: { 
  booking: BookingDetails;
  tipAmount: number;
  totalAmount: number;
  paymentEntry: Exclude<PaymentEntryMode, 'cash'>;
  onSuccess: () => void;
  isUpdatingIntent?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(true);

  const finishSucceededPayment = async (paymentIntentId: string) => {
    // Parent passes tipAmount=0 for service mode; tip mode uses TipFormInner instead.
    await api.post(`/bookings-simple/${booking.id}/confirm-payment`, {
      paymentIntentId,
    });
    toast.success('Payment successful!');
    onSuccess();
  };

  const confirmWithStripe = async () => {
    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        await finishSucceededPayment(paymentIntent.id);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await confirmWithStripe();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {paymentEntry === 'manual' ? (
        <div>
          <PaymentElement
            key="manual-card"
            options={{
              layout: 'tabs',
              wallets: {
                applePay: 'never',
                googlePay: 'never',
              },
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <ExpressCheckoutElement
            key="wallet-pay"
            options={{
              paymentMethods: {
                applePay: 'always',
                googlePay: 'always',
                link: 'never',
                paypal: 'never',
                amazonPay: 'never',
                klarna: 'never',
              },
            }}
            onReady={({ availablePaymentMethods }) => {
              const hasWallet = Boolean(
                availablePaymentMethods?.applePay || availablePaymentMethods?.googlePay
              );
              setWalletAvailable(hasWallet);
            }}
            onConfirm={async () => {
              await confirmWithStripe();
            }}
          />
          {!walletAvailable && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Apple Pay / Google Pay isn’t available in this browser. Choose Manual card input instead.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {paymentEntry === 'manual' && (
        <button
          type="submit"
          disabled={!stripe || isProcessing || isUpdatingIntent}
          className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUpdatingIntent ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Updating total...
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay ${totalAmount.toFixed(2)}
            </>
          )}
        </button>
      )}

      <p className="text-center text-xs text-gray-500">
        {paymentEntry === 'manual'
          ? 'Secured by Stripe. Enter your card details to pay.'
          : 'Secured by Stripe. Use Apple Pay or Google Pay with your saved wallet cards.'}
      </p>
    </form>
  );
}

function resolvePayPageMode(booking: BookingDetails): PayPageMode | 'done' | 'invalid' {
  if (booking.tipDecidedAt) return 'done';
  if (booking.status === 'COMPLETED') return 'tip';
  if (booking.status === 'ACCEPTED' && !booking.paidAt) return 'service';
  if (booking.status === 'PAID') return 'done';
  return 'invalid';
}

// Service payment (pay-on-accept) — no tip on this charge
function ServicePaymentForm({
  booking,
  onSuccess,
}: {
  booking: BookingDetails;
  onSuccess: () => void;
}) {
  const { cashPaymentEnabled } = useFrontendConfig();
  const [paymentEntry, setPaymentEntry] = useState<PaymentEntryMode>('manual');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isProcessingCash, setIsProcessingCash] = useState(false);

  const baseAmount = booking.priceUsdCents / 100;
  const effectiveEntry =
    paymentEntry === 'cash' && !cashPaymentEnabled ? 'manual' : paymentEntry;

  const createPaymentIntent = async () => {
    setIsCreatingIntent(true);
    setIntentError(null);
    try {
      const response = await api.post<{ clientSecret: string; paymentIntentId: string }>(
        `/bookings-simple/${booking.id}/create-payment-intent`,
        {}
      );
      setClientSecret(response.clientSecret);
    } catch (err: any) {
      setIntentError(err.message || 'Failed to initialize payment');
    } finally {
      setIsCreatingIntent(false);
    }
  };

  useEffect(() => {
    if (effectiveEntry === 'cash') return;
    if (!clientSecret && !isCreatingIntent) void createPaymentIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEntry]);

  const handleCashPayment = async () => {
    setIsProcessingCash(true);
    try {
      await api.post(`/bookings-simple/${booking.id}/pay`, { paymentMethod: 'cash' });
      toast.success('Cash payment recorded!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Cash payment failed. Please try again.');
    } finally {
      setIsProcessingCash(false);
    }
  };

  if (effectiveEntry !== 'cash' && isCreatingIntent && !clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
        <p className="text-gray-600">Preparing payment...</p>
      </div>
    );
  }

  if (effectiveEntry !== 'cash' && intentError) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{intentError}</p>
        <button
          onClick={createPaymentIntent}
          className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
        Pay now to confirm your booking. Tips are requested after the service is complete.
      </div>
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Service</span>
          <span className="font-semibold">
            {getServiceDisplayName(booking.serviceName, booking.serviceType)}
          </span>
        </div>
        <div className="border-t pt-3 flex justify-between text-lg">
          <span className="font-bold">Total due</span>
          <span className="font-bold text-primary-600">${baseAmount.toFixed(2)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to pay?</label>
        <div className={`grid gap-3 ${cashPaymentEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={() => setPaymentEntry('manual')}
            className={`py-4 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
              effectiveEntry === 'manual'
                ? 'border-gray-900 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="font-semibold text-sm text-center">Manual card input</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentEntry('wallet')}
            className={`py-4 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
              effectiveEntry === 'wallet'
                ? 'border-gray-900 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <Wallet className="w-6 h-6" />
            <span className="font-semibold text-sm text-center">Apple / Google Pay</span>
          </button>
          {cashPaymentEnabled && (
            <button
              type="button"
              onClick={() => setPaymentEntry('cash')}
              className={`py-4 px-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                effectiveEntry === 'cash'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <Banknote className="w-6 h-6" />
              <span className="font-semibold text-sm text-center">Cash</span>
            </button>
          )}
        </div>
      </div>

      {effectiveEntry === 'cash' ? (
        <button
          type="button"
          onClick={handleCashPayment}
          disabled={isProcessingCash}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessingCash ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Banknote className="w-5 h-5" />
          )}
          Confirm Cash Payment ${baseAmount.toFixed(2)}
        </button>
      ) : (
        clientSecret && (
          <Elements
            key={`${booking.id}-service`}
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#059669',
                  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                },
              },
            }}
          >
            <PaymentFormInner
              booking={booking}
              tipAmount={0}
              totalAmount={baseAmount}
              paymentEntry={effectiveEntry === 'wallet' ? 'wallet' : 'manual'}
              onSuccess={onSuccess}
              isUpdatingIntent={isCreatingIntent}
            />
          </Elements>
        )
      )}
    </div>
  );
}

function TipPaymentFormInner({
  booking,
  tipAmount,
  onSuccess,
}: {
  booking: BookingDetails;
  tipAmount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmTip = async () => {
    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status === 'succeeded') {
        await api.post(`/bookings-simple/${booking.id}/confirm-tip`, {
          paymentIntentId: paymentIntent.id,
          tipAmountCents: Math.round(tipAmount * 100),
          paymentMethod: 'card',
        });
        toast.success('Tip submitted!');
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Tip payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => void confirmTip()}
        disabled={!stripe || isProcessing}
        className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl disabled:opacity-50"
      >
        {isProcessing ? 'Processing…' : `Pay tip $${tipAmount.toFixed(2)}`}
      </button>
    </div>
  );
}

// Tip decision after complete — must choose amount including $0
function TipPaymentForm({
  booking,
  onSuccess,
}: {
  booking: BookingDetails;
  onSuccess: () => void;
}) {
  const { cashPaymentEnabled } = useFrontendConfig();
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [customTipActive, setCustomTipActive] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isSubmittingZero, setIsSubmittingZero] = useState(false);
  const [isUpdatingTip, setIsUpdatingTip] = useState(false);

  const tipAmount = customTip ? parseFloat(customTip) || 0 : selectedTip ?? 0;
  const tipChosen = selectedTip !== null || customTip !== '';
  const allowCashTip = cashPaymentEnabled && booking.paymentMethod === 'cash';

  const tipOptions = [
    { label: '$4', value: 4 },
    { label: '$5', value: 5 },
    { label: '$6', value: 6 },
  ];

  const createTipIntent = async (cents: number) => {
    setIsCreatingIntent(true);
    setIntentError(null);
    try {
      const response = await api.post<{ clientSecret: string; paymentIntentId: string }>(
        `/bookings-simple/${booking.id}/create-tip-intent`,
        { tipAmountCents: cents }
      );
      setClientSecret(response.clientSecret);
      setPaymentIntentId(response.paymentIntentId);
    } catch (err: any) {
      setIntentError(err.message || 'Failed to initialize tip payment');
      setClientSecret(null);
      setPaymentIntentId(null);
    } finally {
      setIsCreatingIntent(false);
    }
  };

  useEffect(() => {
    if (!tipChosen || tipAmount <= 0 || allowCashTip) {
      setClientSecret(null);
      setPaymentIntentId(null);
      return;
    }
    if (tipAmount * 100 < 50) return;
    if (!paymentIntentId) {
      void createTipIntent(Math.round(tipAmount * 100));
      return;
    }
    const timer = setTimeout(async () => {
      setIsUpdatingTip(true);
      try {
        await api.post(`/bookings-simple/${booking.id}/update-payment-intent`, {
          paymentIntentId,
          tipAmountCents: Math.round(tipAmount * 100),
        });
      } catch (err) {
        console.error('Failed to update tip intent', err);
      } finally {
        setIsUpdatingTip(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipAmount, tipChosen, allowCashTip]);

  const submitZeroOrCashTip = async () => {
    setIsSubmittingZero(true);
    try {
      await api.post(`/bookings-simple/${booking.id}/confirm-tip`, {
        tipAmountCents: Math.round(tipAmount * 100),
        paymentMethod: tipAmount > 0 && allowCashTip ? 'cash' : 'card',
      });
      toast.success(tipAmount > 0 ? 'Tip submitted!' : 'Tip recorded ($0)');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Could not submit tip');
    } finally {
      setIsSubmittingZero(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          Consider leaving a tip that best represents the quality of service
        </p>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTip(0);
              setCustomTip('');
              setCustomTipActive(false);
            }}
            className={`w-20 shrink-0 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors ${
              selectedTip === 0 && !customTip
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-brand-300 text-brand-700 hover:border-brand-400 hover:bg-brand-50'
            }`}
          >
            $0
          </button>
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Custom tip"
              value={customTip}
              onFocus={() => {
                // Custom entry is exclusive — clear any preset tip selection
                setSelectedTip(null);
                setCustomTipActive(true);
              }}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || parseFloat(value) >= 0) {
                  setCustomTip(value);
                  setSelectedTip(null);
                  setCustomTipActive(true);
                }
              }}
              className={`w-full pl-7 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 ${
                customTip !== '' || customTipActive
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-brand-300'
              }`}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {tipOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setSelectedTip(option.value);
                setCustomTip('');
                setCustomTipActive(false);
              }}
              className={`py-3 px-2 rounded-lg border text-xl font-semibold transition-colors ${
                selectedTip === option.value && !customTip
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-brand-300 text-brand-700 hover:border-brand-400 hover:bg-brand-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!tipChosen && (
        <p className="text-sm text-gray-500 text-center">
          {customTipActive
            ? 'Enter a tip amount to complete the booking'
            : 'Pick a tip amount to complete the booking'}
        </p>
      )}

      {tipChosen && tipAmount === 0 && (
        <button
          type="button"
          onClick={() => void submitZeroOrCashTip()}
          disabled={isSubmittingZero}
          className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl disabled:opacity-50"
        >
          {isSubmittingZero ? 'Submitting…' : 'Confirm $0 tip'}
        </button>
      )}

      {tipChosen && tipAmount > 0 && allowCashTip && (
        <button
          type="button"
          onClick={() => void submitZeroOrCashTip()}
          disabled={isSubmittingZero}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl disabled:opacity-50"
        >
          {isSubmittingZero ? 'Submitting…' : `Confirm cash tip $${tipAmount.toFixed(2)}`}
        </button>
      )}

      {tipChosen && tipAmount > 0 && !allowCashTip && (
        <>
          {(isCreatingIntent || isUpdatingTip) && !clientSecret && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          )}
          {intentError && (
            <div className="text-center">
              <p className="text-red-600 mb-2">{intentError}</p>
              <button
                type="button"
                onClick={() => void createTipIntent(Math.round(tipAmount * 100))}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg"
              >
                Try again
              </button>
            </div>
          )}
          {clientSecret && (
            <Elements
              key={`${booking.id}-tip-${paymentIntentId}`}
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#059669',
                    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                  },
                },
              }}
            >
              <TipPaymentFormInner
                booking={booking}
                tipAmount={tipAmount}
                onSuccess={onSuccess}
              />
            </Elements>
          )}
        </>
      )}
    </div>
  );
}

function PaymentForm({
  booking,
  onSuccess,
  mode,
}: {
  booking: BookingDetails;
  onSuccess: () => void;
  mode: PayPageMode;
}) {
  if (mode === 'tip') {
    return <TipPaymentForm booking={booking} onSuccess={onSuccess} />;
  }
  return <ServicePaymentForm booking={booking} onSuccess={onSuccess} />;
}

// Review Form Component — satisfaction faces (not 5-star)
function ReviewForm({ 
  booking, 
  onComplete 
}: { 
  booking: BookingDetails;
  onComplete: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a satisfaction rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/bookings-simple/${booking.id}/review`, {
        rating,
        comment: comment.trim() || null,
      });
      toast.success('Thank you for your feedback!');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">How satisfied were you with {booking.barber.firstName}?</p>
      </div>

      <SatisfactionRating
        value={rating}
        onChange={setRating}
        disabled={isSubmitting}
      />

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)..."
        rows={3}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 resize-none"
      />

      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit'
          )}
        </button>
      </div>
    </div>
  );
}

// Main Page Component
export default function PostServicePaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const { user, isLoading: isAuthLoading } = useAuthStore();
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'payment' | 'review' | 'complete'>('payment');
  const [isUndoing, setIsUndoing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Redirect to login if not authenticated (security: require identity verification)
  useEffect(() => {
    if (!isAuthLoading && !user) {
      // Redirect to universal auth page - system will route user after login
      navigate('/web', { replace: true });
    }
  }, [isAuthLoading, user, navigate]);

  // Handle undo completion (for barbers who accidentally pressed complete)
  const handleUndoComplete = async () => {
    if (!bookingId || isUndoing) return;
    
    setIsUndoing(true);
    try {
      await api.put(`/bookings-simple/${bookingId}/undo-complete`);
      toast.success('Completion undone. Booking returned to active status.');
      navigate('/web/barber');
    } catch (err: any) {
      console.error('Error undoing completion:', err);
      toast.error(err.response?.data?.error || 'Failed to undo completion');
    } finally {
      setIsUndoing(false);
    }
  };

  // Check if current user is barber or consumer for this booking
  // Use ID matching - this is the most reliable way since a user can be both barber and consumer
  const isBarber = user?.id === booking?.barber?.id;
  const isConsumer = user?.id === booking?.consumer?.id;
  
  // Debug logging
  console.log('Payment page user check:', {
    userId: user?.id,
    barberId: booking?.barber?.id,
    consumerId: booking?.consumer?.id,
    isBarber,
    isConsumer,
  });

  useEffect(() => {
    if (user) {
      fetchBooking();
    }
  }, [bookingId, user?.id]);

  useEffect(() => {
    if (!booking) return;
    const mode = resolvePayPageMode(booking);
    if (mode === 'done' && step === 'payment') {
      setStep('review');
    }
  }, [booking, step]);

  // Intentional open of the payment page clears Pay Later deferral for this booking
  useEffect(() => {
    if (bookingId) {
      clearDeferredPaymentTakeover(bookingId);
    }
  }, [bookingId]);

  const handlePayLater = () => {
    if (!bookingId) return;
    deferPaymentTakeover(bookingId);
    toast.success('You can pay later from Home or Bookings');
    navigate(`${platformPrefix}/consumer`);
  };
  // Listen for payment-received WebSocket event (for barber view)
  useEffect(() => {
    if (!bookingId) return;

    // Connect to socket service
    socketService.connect();

    const handlePaymentReceived = (data: {
      bookingId: string;
      consumerId: string;
      consumerName: string;
      amountPaid: number;
      tipAmount: number;
      totalFormatted: string;
      tipFormatted?: string;
    }) => {
      console.log('📬 Payment received WebSocket event:', data);
      
      // Check if this is for the current booking
      if (data.bookingId === bookingId) {
        toast.success(`Payment received: ${data.totalFormatted}${data.tipFormatted ? ` (includes ${data.tipFormatted} tip)` : ''}`);
        setStep('review'); // Move to "Payment Confirmed" view
        // Refresh booking data
        fetchBooking();
      }
    };

    socketService.onPaymentReceived(handlePaymentReceived);

    return () => {
      socketService.offPaymentReceived(handlePaymentReceived);
    };
  }, [bookingId]);

  // Listen for booking-status-changed WebSocket event (for consumer view - when barber undoes completion)
  useEffect(() => {
    if (!bookingId) return;

    const handleStatusChanged = (data: {
      bookingId: string;
      status: string;
      message?: string;
    }) => {
      console.log('📬 Booking status changed WebSocket event:', data);
      
      // Check if this is for the current booking
      if (data.bookingId === bookingId) {
        // If barber reverted completion, redirect consumer back to messages or home
        if (data.status === 'PAID' || data.status === 'ACCEPTED') {
          toast.success(
            data.status === 'PAID'
              ? 'The barber reverted completion. Tip is no longer requested.'
              : 'Booking updated.'
          );
          navigate('/web/consumer');
        } else {
          fetchBooking();
        }
      }
    };

    socketService.onBookingStatusChanged(handleStatusChanged);

    return () => {
      socketService.offBookingStatusChanged(handleStatusChanged);
    };
  }, [bookingId, navigate]);

  const fetchBooking = async () => {
    if (!bookingId) {
      setError('Invalid booking');
      setIsLoading(false);
      return;
    }

    // Don't fetch if not authenticated yet
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get(`/bookings-simple/${bookingId}`);
      const b = (response.booking || response) as BookingDetails;
      setBooking(b);
      setAccessDenied(false);

      // Tip decided → review; otherwise stay on payment for service or tip mode
      if (b.tipDecidedAt) {
        setStep('review');
      } else {
        setStep('payment');
      }
    } catch (err: any) {
      console.error('Failed to fetch booking:', err);
      // Check if this is a 404 (access denied or not found)
      if (err.response?.status === 404 || err.response?.status === 403) {
        setAccessDenied(true);
        setError('You don\'t have access to this booking. Please log in with the account that made this booking.');
      } else {
        setError(err.message || 'Failed to load booking details');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Service pay → stay done for now (appointment upcoming). Tip pay → review.
    if (booking && resolvePayPageMode(booking) === 'tip') {
      setStep('review');
    } else {
      toast.success('Booking confirmed — see you at your appointment!');
      navigate('/web/consumer');
    }
  };

  const handleComplete = () => {
    setStep('complete');
    // Navigate back after short delay
    setTimeout(() => {
      if (isBarber) {
        navigate('/web/barber');
      } else {
        navigate('/web/consumer');
      }
    }, 2000);
  };

  // Wait for auth to finish loading before rendering
  // This check is placed after all hooks to comply with React's Rules of Hooks
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    const handleLogoutAndLogin = async () => {
      // Clear current session and redirect to login
      const { logout } = useAuthStore.getState();
      await logout();
      navigate('/web', { replace: true });
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {accessDenied ? 'Access Denied' : 'Error'}
          </h2>
          <p className="text-gray-600 mb-6">{error || 'Booking not found'}</p>
          
          {accessDenied ? (
            <div className="space-y-3">
              <button
                onClick={handleLogoutAndLogin}
                className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
              >
                Log in with a different account
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Go Back
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Barber View - waiting for service pay / tip, or confirmed
  if (isBarber) {
    const awaitingServicePay = booking.status === 'ACCEPTED' && !booking.paidAt;
    const servicePaid = booking.status === 'PAID' || !!booking.paidAt;
    const awaitingTip = booking.status === 'COMPLETED' && !booking.tipDecidedAt;
    const tipDone = !!booking.tipDecidedAt;

    if (!awaitingServicePay && !servicePaid && !awaitingTip && !tipDone) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Nothing to show yet</h2>
            <p className="text-gray-600 mb-6">
              Accept the booking so the customer can pay, then mark complete after the service for a tip.
            </p>
            <button
              onClick={() => navigate('/web/barber')}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <button 
              onClick={() => navigate('/web/barber')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src={TivelaPlatformsLogo} alt="OnCuts" className="h-8" />
            <div className="w-9" /> {/* Spacer */}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            {tipDone || (servicePaid && !awaitingTip) ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {tipDone ? 'All set!' : 'Service Payment Confirmed!'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {tipDone
                    ? `${booking.consumer.firstName} finished the tip step.`
                    : `${booking.consumer.firstName} paid for the service. Mark complete after the appointment to request a tip.`}
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-primary-500 animate-pulse" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {awaitingTip ? 'Waiting for Tip' : 'Waiting for Payment'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {awaitingTip
                    ? `${booking.consumer.firstName} was asked to choose a tip (including $0).`
                    : `${booking.consumer.firstName} needs to pay for the service to confirm this booking.`}
                </p>
              </>
            )}

            {/* Booking Summary */}
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer</span>
                <span className="font-semibold">{booking.consumer.firstName} {booking.consumer.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-semibold">{getServiceDisplayName(booking.serviceName, booking.serviceType)}</span>
              </div>
              {/* Price breakdown */}
              {(() => {
                const serviceCents = booking.priceUsdCents || 0;
                // Derive tip from totalPaidCents if tipAmountCents is missing (only when total reflects service+tip)
                const tipAmount =
                  booking.tipAmountCents ??
                  (booking.totalPaidCents != null &&
                  booking.totalPaidCents > serviceCents
                    ? booking.totalPaidCents - serviceCents
                    : 0);
                // Unpaid bookings often send totalPaidCents: 0 — ?? would keep 0 and show $0.00 Total.
                // Use recorded total only when > 0; otherwise show amount due (service + tip).
                const displayTotalCents =
                  booking.totalPaidCents != null && booking.totalPaidCents > 0
                    ? booking.totalPaidCents
                    : serviceCents + tipAmount;

                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Price</span>
                      <span className="font-medium">${(serviceCents / 100).toFixed(2)}</span>
                    </div>
                    {tipAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tip</span>
                        <span className="font-medium text-green-600">+${(tipAmount / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600 font-semibold">Total</span>
                      <span className="font-bold text-green-600">${(displayTotalCents / 100).toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
              {(servicePaid || tipDone) && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Status</span>
                  <span className="font-semibold text-green-600 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    {tipDone ? 'Tip submitted' : 'Service paid'}
                  </span>
                </div>
              )}
            </div>

            {awaitingTip ? (
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/web/barber')}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Return to Dashboard
                </button>
                <button
                  onClick={handleUndoComplete}
                  disabled={isUndoing}
                  className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUndoing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Undo2 className="w-5 h-5" />
                  )}
                  {isUndoing ? 'Reverting...' : 'Undo Completion'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/web/barber')}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const consumerMode = resolvePayPageMode(booking);
  if (consumerMode === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payment not available</h2>
          <p className="text-gray-600 mb-6">This booking is not ready for payment or tipping.</p>
          <button
            onClick={() => navigate('/web/consumer')}
            className="px-6 py-3 bg-brand-500 text-white rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Consumer View - Payment Form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <img src={TivelaPlatformsLogo} alt="OnCuts" className="h-8" />
          <div className="w-9" /> {/* Spacer */}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {step === 'complete' ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All Done!</h2>
            <p className="text-gray-600">Thank you for using OnCuts.</p>
          </div>
        ) : step === 'review' ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <ReviewForm booking={booking} onComplete={handleComplete} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Booking Header */}
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-6 text-white">
              <h1
                className={
                  consumerMode === 'tip'
                    ? 'text-3xl font-bold text-center'
                    : 'text-xl font-bold mb-1'
                }
              >
                {consumerMode === 'tip' ? 'Consider a Tip' : 'Pay to Confirm Booking'}
              </h1>
              {consumerMode !== 'tip' && (
                <p className="text-white/80">
                  If using Apple Pay or Google Pay, confirm with Face ID / biometrics before payment completes.
                </p>
              )}
            </div>

            {/* Barber Info */}
            <div className="p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                  {booking.barber.profileImageUrl ? (
                    <img 
                      src={booking.barber.profileImageUrl} 
                      alt={booking.barber.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-primary-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{booking.barber.firstName} {booking.barber.lastName}</h3>
                  <p className="text-sm text-gray-600">{getServiceDisplayName(booking.serviceName, booking.serviceType)}</p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="p-6">
              <PaymentForm
                booking={booking}
                onSuccess={handlePaymentSuccess}
                mode={consumerMode === 'tip' ? 'tip' : 'service'}
              />
              {step === 'payment' && consumerMode === 'service' && (
                <button
                  type="button"
                  onClick={handlePayLater}
                  className="w-full mt-4 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Pay Later
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
