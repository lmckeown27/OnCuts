import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, CreditCard, Check, MessageSquare, Banknote } from 'lucide-react';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import SatisfactionRating from './SatisfactionRating';

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  barberName: string;
  serviceName: string;
  amount: number; // in cents
  onPaymentComplete?: () => void;
  /** Client-only: dismiss takeover and skip auto-pop until reopen */
  onPayLater?: () => void;
}

export default function PaymentRequestModal({
  isOpen,
  onClose,
  bookingId,
  barberName,
  serviceName,
  amount,
  onPaymentComplete,
  onPayLater,
}: PaymentRequestModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const [step, setStep] = useState<'payment' | 'tip' | 'review' | 'complete'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  /** Admin↔admin only when Controls cash toggle is on (from booking API). */
  const [cashAllowed, setCashAllowed] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setCashAllowed(false);
      setPaymentMethod('card');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get<{
          booking?: { cashPaymentAllowed?: boolean };
          cashPaymentAllowed?: boolean;
        }>(`/bookings-simple/${bookingId}`);
        const booking = response?.booking || response;
        if (!cancelled) {
          setCashAllowed(booking?.cashPaymentAllowed === true);
        }
      } catch {
        if (!cancelled) setCashAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const baseAmountDollars = amount / 100;
  const effectiveMethod = cashAllowed ? paymentMethod : 'card';

  const handlePayLater = () => {
    onPayLater?.();
    onClose();
  };

  // Handle card payment - redirect to full Stripe payment page with Apple Pay, Google Pay, and card support
  const handleCardPayment = () => {
    onClose(); // Close modal first
    navigate(`${platformPrefix}/payment/${bookingId}`);
  };

  // Handle cash payment - process in modal
  const handleCashPayment = async () => {
    setIsProcessing(true);
    try {
      await api.post(`/bookings-simple/${bookingId}/pay`, {
        tipAmountCents: 0,
        paymentMethod: 'cash',
      });
      
      toast.success('Cash payment recorded!');
      setStep('review');
    } catch (error: any) {
      console.error('Payment failed:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      toast.error('Please select a satisfaction rating');
      return;
    }

    setIsProcessing(true);
    try {
      await api.post(`/bookings-simple/${bookingId}/review`, {
        rating,
        comment: reviewComment.trim() || null,
      });
      
      toast.success('Thank you for your feedback!');
      setStep('complete');
      
      // Auto-close after success
      setTimeout(() => {
        onPaymentComplete?.();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Review submission failed:', error);
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipReview = () => {
    setStep('complete');
    setTimeout(() => {
      onPaymentComplete?.();
      onClose();
    }, 1500);
  };

  return (
    <div 
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85dvh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 'payment' && 'Complete Payment'}
              {step === 'tip' && 'Add a Tip'}
              {step === 'review' && 'Rate Your Experience'}
              {step === 'complete' && 'All Done!'}
            </h2>
            <p className="text-white/80 text-sm">{barberName} • {serviceName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Payment Step */}
          {step === 'payment' && (
            <div className="space-y-6">
              {/* Amount Display */}
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-2">Service Total</p>
                <p className="text-4xl font-bold text-gray-900">${baseAmountDollars.toFixed(2)}</p>
              </div>

              {/* Payment Method Selection */}
              <div>
                <p className="font-semibold text-gray-900 mb-3">How would you like to pay?</p>
                <div className={`grid gap-3 ${cashAllowed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`py-4 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      effectiveMethod === 'card'
                        ? 'border-gray-900 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="font-semibold">Pay with Card</span>
                  </button>
                  {cashAllowed && (
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-4 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        effectiveMethod === 'cash'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <Banknote className="w-6 h-6" />
                      <span className="font-semibold">Pay with Cash</span>
                    </button>
                  )}
                </div>
                {cashAllowed && effectiveMethod === 'cash' && (
                  <p className="mt-2 text-sm text-green-600 text-center">
                    Please give cash directly to {barberName.split(' ')[0]}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-700">Service Total</span>
                  <span
                    className={`text-2xl font-bold ${
                      effectiveMethod === 'cash' ? 'text-green-600' : 'text-primary-600'
                    }`}
                  >
                    ${baseAmountDollars.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Pay Button */}
              {cashAllowed && effectiveMethod === 'cash' ? (
                <button
                  onClick={handleCashPayment}
                  disabled={isProcessing}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Banknote className="w-5 h-5" />
                      Confirm Cash Payment ${baseAmountDollars.toFixed(2)}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCardPayment}
                  className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Continue to Pay ${baseAmountDollars.toFixed(2)}
                </button>
              )}

              <button
                type="button"
                onClick={handlePayLater}
                className="w-full py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Pay Later
              </button>
              
              {effectiveMethod === 'card' && (
                <p className="text-center text-sm text-gray-500">
                  Supports Apple Pay, Google Pay, and card payments
                </p>
              )}
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Complete!</h3>
                <p className="text-gray-600">How satisfied were you with {barberName}?</p>
              </div>

              <SatisfactionRating
                value={rating}
                onChange={setRating}
                disabled={isProcessing}
              />

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Add a comment (optional)
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSkipReview}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={rating === 0 || isProcessing}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600">Your payment and feedback have been submitted.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

