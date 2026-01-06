import { useState } from 'react';
import { X, DollarSign, Star, CreditCard, Check, MessageSquare } from 'lucide-react';
import api from '../services/api.service';
import toast from 'react-hot-toast';

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  barberName: string;
  serviceName: string;
  amount: number; // in cents
  onPaymentComplete?: () => void;
}

export default function PaymentRequestModal({
  isOpen,
  onClose,
  bookingId,
  barberName,
  serviceName,
  amount,
  onPaymentComplete,
}: PaymentRequestModalProps) {
  const [step, setStep] = useState<'payment' | 'tip' | 'review' | 'complete'>('payment');
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  if (!isOpen) return null;

  const baseAmountDollars = amount / 100;
  const tipAmount = customTip ? parseFloat(customTip) || 0 : selectedTip;
  const totalAmount = baseAmountDollars + tipAmount;

  const tipOptions = [
    { label: '15%', value: Math.round(baseAmountDollars * 0.15 * 100) / 100 },
    { label: '20%', value: Math.round(baseAmountDollars * 0.20 * 100) / 100 },
    { label: '25%', value: Math.round(baseAmountDollars * 0.25 * 100) / 100 },
  ];

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // Process payment (in a real app, this would integrate with Stripe/payment provider)
      await api.post(`/bookings-simple/${bookingId}/pay`, {
        tipAmountCents: Math.round(tipAmount * 100),
      });
      
      toast.success('Payment successful!');
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
      toast.error('Please select a rating');
      return;
    }

    setIsProcessing(true);
    try {
      await api.post(`/bookings-simple/${bookingId}/review`, {
        rating,
        comment: reviewComment.trim() || null,
      });
      
      toast.success('Thank you for your review!');
      setStep('complete');
      
      // Auto-close after success
      setTimeout(() => {
        onPaymentComplete?.();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Review submission failed:', error);
      toast.error(error.message || 'Failed to submit review');
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
        <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 'payment' && 'Complete Payment'}
              {step === 'tip' && 'Add a Tip'}
              {step === 'review' && 'Leave a Review'}
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

              {/* Tip Selection */}
              <div>
                <p className="font-semibold text-gray-900 mb-3">Add a tip for {barberName}?</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tipOptions.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        setSelectedTip(option.value);
                        setCustomTip('');
                      }}
                      className={`py-3 px-3 sm:px-4 rounded-lg border-2 transition-all font-semibold text-sm sm:text-base ${
                        selectedTip === option.value && !customTip
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                
                {/* Custom tip input */}
                <div className="mt-3 relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    placeholder="Custom tip amount"
                    value={customTip}
                    onChange={(e) => {
                      setCustomTip(e.target.value);
                      setSelectedTip(0);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-4 border-t border-gray-200">
                <span className="text-lg font-semibold text-gray-700">Total</span>
                <span className="text-2xl font-bold text-green-600">${totalAmount.toFixed(2)}</span>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
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
                    <CreditCard className="w-5 h-5" />
                    Pay ${totalAmount.toFixed(2)}
                  </>
                )}
              </button>
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
                <p className="text-gray-600">How was your experience with {barberName}?</p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-1 sm:gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                        star <= (hoveredStar || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {rating > 0 && (
                <p className="text-center text-lg font-medium text-gray-700">
                  {rating === 5 && '🔥 Amazing!'}
                  {rating === 4 && '👍 Great!'}
                  {rating === 3 && '😊 Good'}
                  {rating === 2 && '😐 Could be better'}
                  {rating === 1 && '😞 Poor experience'}
                </p>
              )}

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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
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
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Star className="w-5 h-5" />
                      Submit Review
                    </>
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
              <p className="text-gray-600">Your payment and review have been submitted.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

