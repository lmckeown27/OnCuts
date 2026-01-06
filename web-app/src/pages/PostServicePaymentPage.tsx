/**
 * PostServicePaymentPage - Payment page after service completion
 * 
 * This page is shown when a barber marks a service as complete.
 * - Barber sees a "waiting for payment" view
 * - Consumer sees the Stripe payment form to pay
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  CreditCard, Check, Clock, DollarSign, User, Calendar,
  MapPin, ArrowLeft, Star, AlertCircle, Loader2
} from 'lucide-react';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';
import { CampusCutLogo } from '@assets';
import toast from 'react-hot-toast';

// Load Stripe - use your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface BookingDetails {
  id: string;
  status: string;
  serviceName: string;
  serviceType: string;
  priceUsdCents: number;
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

// Payment Form Component (wrapped in Elements)
function PaymentForm({ 
  booking, 
  onSuccess 
}: { 
  booking: BookingDetails;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [customTip, setCustomTip] = useState('');

  const baseAmount = booking.priceUsdCents / 100;
  const tipAmount = customTip ? parseFloat(customTip) || 0 : selectedTip;
  const totalAmount = baseAmount + tipAmount;

  const tipOptions = [
    { label: '15%', value: Math.round(baseAmount * 0.15 * 100) / 100 },
    { label: '20%', value: Math.round(baseAmount * 0.20 * 100) / 100 },
    { label: '25%', value: Math.round(baseAmount * 0.25 * 100) / 100 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Create payment intent on backend
      const { clientSecret } = await api.post<{ clientSecret: string; paymentIntentId: string }>(
        `/bookings-simple/${booking.id}/create-payment-intent`,
        { tipAmountCents: Math.round(tipAmount * 100) }
      );

      // 2. Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        // 3. Confirm payment on backend
        await api.post(`/bookings-simple/${booking.id}/confirm-payment`, {
          paymentIntentId: paymentIntent.id,
          tipAmountCents: Math.round(tipAmount * 100),
        });

        toast.success('Payment successful!');
        onSuccess();
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Service</span>
          <span className="font-semibold">{booking.serviceName || booking.serviceType}</span>
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

      {/* Tip Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add a tip (optional)</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {tipOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setSelectedTip(option.value);
                setCustomTip('');
              }}
              className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedTip === option.value && !customTip
                  ? 'border-primary-500 bg-primary-50 text-primary-600'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          placeholder="Custom tip amount"
          value={customTip}
          onChange={(e) => {
            setCustomTip(e.target.value);
            setSelectedTip(0);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
      </div>

      {/* Card Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#ef4444' },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
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

      <p className="text-center text-xs text-gray-500">
        Secured by Stripe. Your payment information is encrypted.
      </p>
    </form>
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
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
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
          className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
  const { user } = useAuthStore();
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'payment' | 'review' | 'complete'>('payment');

  // Check if current user is barber or consumer
  // Use BOTH user_type AND ID matching for safety
  // This prevents issues if localStorage has stale role data
  const isBarberByRole = user?.user_type === 'barber' || user?.user_type === 'campus_manager';
  const isBarberById = user?.id === booking?.barber?.id;
  const isConsumerById = user?.id === booking?.consumer?.id;
  
  // User must BOTH have barber role AND match the booking's barber ID
  // OR if checking consumer, must match the consumer ID
  const isBarber = isBarberByRole && isBarberById;
  const isConsumer = isConsumerById;
  
  // Debug logging
  console.log('Payment page user check:', {
    userId: user?.id,
    barberId: booking?.barber?.id,
    consumerId: booking?.consumer?.id,
    userType: user?.user_type,
    isBarberByRole,
    isBarberById,
    isConsumerById,
    finalIsBarber: isBarber,
    finalIsConsumer: isConsumer,
  });

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    if (!bookingId) {
      setError('Invalid booking');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get(`/bookings-simple/${bookingId}`);
      setBooking(response.booking || response);
      
      // If already paid, go to review step
      if (response.booking?.paidAt || response.paidAt) {
        setStep('review');
      }
    } catch (err: any) {
      console.error('Failed to fetch booking:', err);
      setError(err.message || 'Failed to load booking details');
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Booking not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Barber View - Waiting for Payment OR Payment Confirmed
  if (isBarber) {
    const isPaid = step === 'review' || step === 'complete' || booking.status === 'PAID';
    
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
            <img src={CampusCutLogo} alt="CampusCut" className="h-8" />
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
                <span className="font-semibold">{booking.serviceName || booking.serviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-bold text-green-600">${(booking.priceUsdCents / 100).toFixed(2)}</span>
              </div>
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

            <button
              onClick={() => navigate('/web/barber')}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
            >
              Return to Dashboard
            </button>
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
          <img src={CampusCutLogo} alt="CampusCut" className="h-8" />
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
            <p className="text-gray-600">Thank you for using CampusCut.</p>
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
              <p className="text-white/80">Pay for your haircut service</p>
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
                  <p className="text-sm text-gray-600">{booking.serviceName || booking.serviceType}</p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="p-6">
              <Elements stripe={stripePromise}>
                <PaymentForm booking={booking} onSuccess={handlePaymentSuccess} />
              </Elements>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

