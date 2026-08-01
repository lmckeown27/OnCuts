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
  MapPin, ArrowLeft, Star, AlertCircle, Loader2, Undo2, Wallet, Banknote
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
    await api.post(`/bookings-simple/${booking.id}/confirm-payment`, {
      paymentIntentId,
      tipAmountCents: Math.round(tipAmount * 100),
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

// Wrapper component that handles tip selection and payment intent creation
function PaymentForm({ 
  booking, 
  onSuccess 
}: { 
  booking: BookingDetails;
  onSuccess: () => void;
}) {
  const { cashPaymentEnabled } = useFrontendConfig();
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [customTip, setCustomTip] = useState('');
  const [paymentEntry, setPaymentEntry] = useState<PaymentEntryMode>('manual');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [isProcessingCash, setIsProcessingCash] = useState(false);

  const baseAmount = booking.priceUsdCents / 100;
  const tipAmount = customTip ? parseFloat(customTip) || 0 : selectedTip;
  const totalAmount = baseAmount + tipAmount;
  const effectiveEntry =
    paymentEntry === 'cash' && !cashPaymentEnabled ? 'manual' : paymentEntry;

  const tipOptions = [
    { label: '15%', value: Math.round(baseAmount * 0.15 * 100) / 100 },
    { label: '20%', value: Math.round(baseAmount * 0.20 * 100) / 100 },
    { label: '25%', value: Math.round(baseAmount * 0.25 * 100) / 100 },
  ];

  const createPaymentIntent = async () => {
    setIsCreatingIntent(true);
    setIntentError(null);
    
    try {
      const response = await api.post<{ clientSecret: string; paymentIntentId: string }>(
        `/bookings-simple/${booking.id}/create-payment-intent`,
        { tipAmountCents: Math.round(tipAmount * 100) }
      );
      setClientSecret(response.clientSecret);
      setPaymentIntentId(response.paymentIntentId);
    } catch (err: any) {
      console.error('Failed to create payment intent:', err);
      setIntentError(err.message || 'Failed to initialize payment');
    } finally {
      setIsCreatingIntent(false);
    }
  };

  // Create initial payment intent once (card paths only)
  useEffect(() => {
    if (effectiveEntry === 'cash') return;
    if (!clientSecret && !isCreatingIntent) {
      void createPaymentIntent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap when leaving cash
  }, [effectiveEntry]);

  // Update payment intent when tip changes (debounced)
  // Avoid recreating the intent so Elements / wallets don't remount unexpectedly
  const [isUpdatingTip, setIsUpdatingTip] = useState(false);
  
  useEffect(() => {
    if (!paymentIntentId || effectiveEntry === 'cash') return;
    
    const timer = setTimeout(async () => {
      setIsUpdatingTip(true);
      try {
        await api.post(`/bookings-simple/${booking.id}/update-payment-intent`, {
          paymentIntentId,
          tipAmountCents: Math.round(tipAmount * 100),
        });
      } catch (err) {
        console.error('Failed to update payment intent:', err);
      } finally {
        setIsUpdatingTip(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [tipAmount, paymentIntentId, booking.id, effectiveEntry]);

  const handleCashPayment = async () => {
    setIsProcessingCash(true);
    try {
      await api.post(`/bookings-simple/${booking.id}/pay`, {
        tipAmountCents: Math.round(tipAmount * 100),
        paymentMethod: 'cash',
      });
      toast.success('Cash payment recorded!');
      onSuccess();
    } catch (err: any) {
      console.error('Cash payment failed:', err);
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
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Service</span>
          <span className="font-semibold">{getServiceDisplayName(booking.serviceName, booking.serviceType)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Base Price</span>
          <span className="font-semibold">${baseAmount.toFixed(2)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Tip</span>
            <span className="font-semibold">+${tipAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-3 flex justify-between text-lg">
          <span className="font-bold">Total</span>
          <span className="font-bold text-primary-600">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Method Selection */}
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
        {cashPaymentEnabled && effectiveEntry === 'cash' && (
          <p className="mt-2 text-sm text-green-600 text-center">
            Please give cash directly to {booking.barber.firstName}
          </p>
        )}
      </div>

      {/* Tip Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add a tip (optional)</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {tipOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                // Toggle: if already selected, deselect (set to 0)
                if (selectedTip === option.value && !customTip) {
                  setSelectedTip(0);
                } else {
                  setSelectedTip(option.value);
                  setCustomTip('');
                }
              }}
              className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedTip === option.value && !customTip
                  ? 'border-gray-900 bg-primary-50 text-primary-600'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Custom tip amount"
            value={customTip}
            onChange={(e) => {
              // Prevent negative values
              const value = e.target.value;
              if (value === '' || parseFloat(value) >= 0) {
                setCustomTip(value);
                setSelectedTip(0);
              }
            }}
            className={`w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 ${
              customTip ? 'border-gray-900 bg-primary-50' : 'border-gray-300'
            }`}
          />
        </div>
      </div>

      {effectiveEntry === 'cash' ? (
        <button
          type="button"
          onClick={handleCashPayment}
          disabled={isProcessingCash}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessingCash ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Banknote className="w-5 h-5" />
              Confirm Cash Payment ${totalAmount.toFixed(2)}
            </>
          )}
        </button>
      ) : (
        clientSecret && (
          <Elements 
            key={booking.id} // Stable key so Elements doesn't remount when tip changes
            stripe={stripePromise} 
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#059669', // primary-600
                  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                },
              },
            }}
          >
            <PaymentFormInner 
              booking={booking} 
              tipAmount={tipAmount}
              totalAmount={totalAmount}
              paymentEntry={effectiveEntry === 'wallet' ? 'wallet' : 'manual'}
              onSuccess={onSuccess}
              isUpdatingIntent={isCreatingIntent || isUpdatingTip}
            />
          </Elements>
        )
      )}
    </div>
  );
}

// Review Form Component
function ReviewForm({ 
  booking, 
  onComplete 
}: { 
  booking: BookingDetails;
  onComplete: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/bookings-simple/${booking.id}/review`, {
        rating,
        comment: comment.trim() || null,
      });
      toast.success('Thank you for your review!');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
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
        <p className="text-gray-600">How was your experience with {booking.barber.firstName}?</p>
      </div>

      {/* Star Rating */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`w-10 h-10 transition-colors ${
                star <= (hoveredStar || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>

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
          disabled={isSubmitting}
          className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Review'
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
        if (data.status === 'ACCEPTED') {
          toast.success('The barber has reverted the service completion. Please wait for them to mark it complete when finished.');
          navigate('/web/consumer');
        } else {
          // For other status changes, just refresh the booking
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
      setBooking(response.booking || response);
      setAccessDenied(false);
      
      // If already paid, go to review step
      if (response.booking?.paidAt || response.paidAt) {
        setStep('review');
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
    setStep('review');
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

  // Barber View - Waiting for Payment OR Payment Confirmed
  if (isBarber) {
    const isPaid = step === 'review' || step === 'complete' || booking.status === 'PAID';
    const isCompleted = booking.status === 'COMPLETED';
    
    // If booking is not COMPLETED or PAID, barber shouldn't be on this page
    if (!isPaid && !isCompleted) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Service Not Yet Complete</h2>
            <p className="text-gray-600 mb-6">
              This booking hasn't been marked as complete yet. Mark it as complete after finishing the service.
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
            {isPaid ? (
              <>
                {/* Payment Confirmed View */}
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Confirmed!</h2>
                <p className="text-gray-600 mb-6">
                  {booking.consumer.firstName} has successfully completed payment for this service.
                </p>
              </>
            ) : (
              <>
                {/* Waiting for Payment View */}
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-primary-500 animate-pulse" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Payment</h2>
                <p className="text-gray-600 mb-6">
                  A payment request has been sent to {booking.consumer.firstName}.
                  You'll be notified once payment is complete.
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
              {isPaid && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Status</span>
                  <span className="font-semibold text-green-600 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Paid
                  </span>
                </div>
              )}
            </div>

            {isPaid ? (
              <button
                onClick={() => navigate('/web/barber')}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors"
              >
                Return to Dashboard
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Didn't mean to mark this service as complete?
                </p>
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
            )}
          </div>
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
            <div className="bg-gradient-to-r from-primary-600 to-primary-500 p-6 text-white">
              <h1 className="text-xl font-bold mb-1">Complete Payment</h1>
              <p className="text-white/80">If selecting Apple Pay or Google Pay, must tap "Pay" to confirm with Face ID before payment</p>
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
              <PaymentForm booking={booking} onSuccess={handlePaymentSuccess} />
              {step === 'payment' && (
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
