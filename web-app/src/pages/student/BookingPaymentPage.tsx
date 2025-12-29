/**
 * Booking Payment Page
 * 
 * Complete booking flow with Stripe payment integration
 * 
 * Payment Flow:
 * 1. Student selects service and reviews price
 * 2. Student adds optional tip (TODO: IMPLEMENT TIPPING SYSTEM)
 * 3. Payment processed via Stripe
 * 4. Funds held in platform escrow
 * 5. After service completion, barber receives payout via Stripe Connect
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  CheckCircle, 
  ArrowLeft, 
  AlertCircle, 
  CreditCard, 
  DollarSign,
  Lock,
  Shield,
  Clock,
  AlertTriangle,
  Info,
  Heart,
  Percent,
  MessageCircle
} from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';

interface BookingDetails {
  barberId: string;
  barberUserId?: string; // User ID for messaging
  barberName: string;
  serviceName: string;
  servicePrice: number;
  scheduledAt: string;
  duration: number;
  location?: string;
  locationDetails?: string;
  notes?: string;
}

/**
 * ============================================================================
 * TODO: IMPLEMENT TIPPING SYSTEM
 * ============================================================================
 * 
 * The tipping system needs to be implemented to allow students to add
 * optional tips to their service payments. This should include:
 * 
 * 1. TIP SELECTION UI:
 *    - Pre-set tip percentages (15%, 20%, 25%, 30%)
 *    - Custom tip amount input
 *    - "No Tip" option
 *    - Visual feedback showing tip amount in dollars
 * 
 * 2. TIP CALCULATION:
 *    - Calculate tip based on service price (not including platform fee)
 *    - Update total in real-time as tip selection changes
 *    - Validate custom tip amounts (min $0, max reasonable limit)
 * 
 * 3. BACKEND INTEGRATION:
 *    - Include tip_amount in payment intent creation
 *    - Store tip_amount separately from service_price in booking record
 *    - Ensure 100% of tip goes to barber (no platform fee on tips)
 *    - Update escrow release to include tip amount
 * 
 * 4. BARBER PAYOUT:
 *    - Tip should be included in barber's Stripe Connect payout
 *    - Show tip breakdown in barber earnings dashboard
 *    - Display tip as separate line item in transaction history
 * 
 * 5. ANALYTICS:
 *    - Track average tip percentage per barber
 *    - Show tipping trends in admin dashboard
 *    - Include tip totals in barber performance metrics
 * 
 * Reference files:
 *    - backend/src/services/stripe-payment.service.ts (add tip handling)
 *    - backend/src/services/escrow.service.ts (include tips in release)
 *    - backend/src/controllers/booking.controller.ts (accept tip_amount)
 * 
 * ============================================================================
 */

// Placeholder for tip selection state
interface TipSelection {
  type: 'percentage' | 'custom' | 'none';
  percentage?: number;
  customAmount?: number;
}

const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% platform fee

// Pre-defined tip percentages
const TIP_PERCENTAGES = [
  { value: 0, label: 'No Tip' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
  { value: 30, label: '30%' },
];

export default function BookingPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingDetails = location.state as BookingDetails;

  const [step, setStep] = useState<'payment-timing' | 'payment' | 'processing' | 'success' | 'error'>('payment-timing');
  const [paymentTiming, setPaymentTiming] = useState<'now' | 'later' | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Card input state (mock - would be replaced with Stripe Elements)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [saveCard, setSaveCard] = useState(false);

  // ============================================================================
  // TODO: IMPLEMENT TIP STATE AND HANDLERS
  // ============================================================================
  const [tipSelection, setTipSelection] = useState<TipSelection>({
    type: 'percentage',
    percentage: 20, // Default to 20% tip
  });
  const [customTipInput, setCustomTipInput] = useState('');

  // Handle "Pay Later" booking confirmation
  const handlePayLater = () => {
    setStep('processing');
    // Simulate booking confirmation without payment
    setTimeout(() => {
      setPaymentIntentId(`booking-pending-${Date.now()}`);
      setStep('success');
    }, 1500);
  };
  // ============================================================================

  // Mock booking ID for demo
  const bookingId = `booking-${Date.now()}`;

  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Booking Details</h2>
          <p className="text-gray-600 mb-4">
            Please start from the barber selection page
          </p>
          <Button onClick={() => navigate('/web/consumer')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // TODO: IMPLEMENT TIP CALCULATION
  // ============================================================================
  const calculateTipAmount = (): number => {
    if (tipSelection.type === 'none') return 0;
    if (tipSelection.type === 'custom' && tipSelection.customAmount) {
      return tipSelection.customAmount;
    }
    if (tipSelection.type === 'percentage' && tipSelection.percentage) {
      return (bookingDetails.servicePrice * tipSelection.percentage) / 100;
    }
    return 0;
  };

  const tipAmount = calculateTipAmount();
  const subtotal = bookingDetails.servicePrice + tipAmount;
  const platformFee = bookingDetails.servicePrice * PLATFORM_FEE_PERCENTAGE;
  const barberEarnings = bookingDetails.servicePrice - platformFee + tipAmount;
  const totalCharge = subtotal;
  // ============================================================================

  const handleTipSelect = (percentage: number) => {
    if (percentage === 0) {
      setTipSelection({ type: 'none' });
    } else {
      setTipSelection({ type: 'percentage', percentage });
    }
    setCustomTipInput('');
  };

  const handleCustomTip = () => {
    const amount = parseFloat(customTipInput);
    if (!isNaN(amount) && amount >= 0) {
      setTipSelection({ type: 'custom', customAmount: amount });
    }
  };

  const handlePayment = async () => {
    // Basic validation
    if (!cardNumber || !cardExpiry || !cardCvc || !cardholderName) {
      setErrorMessage('Please fill in all card details');
      setStep('error');
      return;
    }

    setStep('processing');

    // Simulate payment processing
    // TODO: Replace with actual Stripe payment intent creation
    setTimeout(() => {
      // Mock successful payment
      setPaymentIntentId(`pi_${Date.now()}_mock`);
      setStep('success');
    }, 2500);
  };

  const handlePaymentError = (error: string) => {
    setErrorMessage(error);
    setStep('error');
  };

  // Success Screen
  if (step === 'success') {
    const isPaidNow = paymentTiming === 'now';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            {isPaidNow ? (
              <>Your payment of ${totalCharge.toFixed(2)} has been received and held in escrow. Funds will be released to {bookingDetails.barberName} upon service completion.</>
            ) : (
              <>Your appointment with {bookingDetails.barberName} is confirmed. You'll pay ${bookingDetails.servicePrice.toFixed(2)} after your service is completed.</>
            )}
          </p>

          <div className="text-left bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Booking Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Barber:</span>
                <span className="font-medium">{bookingDetails.barberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{bookingDetails.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Scheduled:</span>
                <span className="font-medium">
                  {new Date(bookingDetails.scheduledAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service Price:</span>
                <span className="font-medium">${bookingDetails.servicePrice.toFixed(2)}</span>
              </div>
              {isPaidNow && tipAmount > 0 && (
                <div className="flex justify-between text-primary-600">
                  <span>Tip:</span>
                  <span className="font-medium">${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2">
                <span>{isPaidNow ? 'Total Paid:' : 'Amount Due After Service:'}</span>
                <span>${isPaidNow ? totalCharge.toFixed(2) : bookingDetails.servicePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Status:</span>
                <span className={`font-medium ${isPaidNow ? 'text-green-600' : 'text-amber-600'}`}>
                  {isPaidNow ? 'Paid' : 'Pay After Service'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Booking ID:</span>
                <span className="font-mono">{paymentIntentId}</span>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-lg mb-6 text-sm ${isPaidNow ? 'bg-primary-50 border border-primary-200' : 'bg-amber-50 border border-amber-200'}`}>
            {isPaidNow ? (
              <>
                <p className="text-primary-700 font-medium mb-1">Payment Secured</p>
                <p className="text-primary-600">
                  Your payment is held securely in escrow until your service is completed.
                </p>
              </>
            ) : (
              <>
                <p className="text-amber-700 font-medium mb-1">Payment Due After Service</p>
                <p className="text-amber-600">
                  Please be ready to pay when your service is complete. You can pay via card or other methods.
                </p>
              </>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => {
                // Navigate to CONSUMER messages and start BOOKING-CENTRIC conversation with barber
                // Pass full service context for CampusCuts messaging
                navigate('/web/consumer/messages', { 
                  state: { 
                    startConversation: true,
                    otherUserId: bookingDetails.barberUserId || bookingDetails.barberId,
                    bookingId: paymentIntentId,
                    // Full booking context for service-centric messaging
                    serviceName: bookingDetails.serviceName,
                    servicePrice: bookingDetails.servicePrice,
                    scheduledAt: bookingDetails.scheduledAt,
                    location: bookingDetails.location,
                    locationDetails: bookingDetails.locationDetails,
                    notes: bookingDetails.notes,
                    barberName: bookingDetails.barberName,
                  }
                });
              }} 
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Message {bookingDetails.barberName?.split(' ')[0] || 'Barber'}
            </Button>
            <Button onClick={() => navigate('/web/consumer')} className="w-full">
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Error Screen
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <div className="space-y-2">
            <Button onClick={() => setStep('payment')} className="w-full">
              Try Again
            </Button>
            <Button onClick={() => navigate(-1)} variant="secondary" className="w-full">
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Processing Screen
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {paymentTiming === 'now' ? 'Processing Payment...' : 'Confirming Booking...'}
          </h2>
          <p className="text-gray-600">
            {paymentTiming === 'now' ? 'Securely processing your payment via Stripe.' : 'Setting up your appointment.'}
          </p>
        </Card>
      </div>
    );
  }

  // Payment Timing Selection Screen
  if (step === 'payment-timing') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Button 
              onClick={() => {
                // Parse the scheduled date and time from scheduledAt
                const scheduledDate = new Date(bookingDetails.scheduledAt);
                const date = scheduledDate.toISOString().split('T')[0];
                const time = scheduledDate.toTimeString().slice(0, 5);
                
                navigate(`/web/consumer/book/${bookingDetails.barberId}`, {
                  state: {
                    preservedFormData: {
                      barberId: bookingDetails.barberId,
                      serviceType: bookingDetails.serviceName,
                      date: date,
                      time: time,
                      location: bookingDetails.location || '',
                      locationDetails: bookingDetails.locationDetails || '',
                      notes: bookingDetails.notes || '',
                    }
                  }
                });
              }} 
              variant="secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Choose Payment Option</h1>
              <p className="text-gray-600 mt-1">When would you like to pay?</p>
            </div>
          </div>

          {/* Booking Summary */}
          <Card className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Booking Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Barber:</span>
                <span className="font-medium">{bookingDetails.barberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{bookingDetails.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Scheduled:</span>
                <span className="font-medium">
                  {new Date(bookingDetails.scheduledAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 mt-2">
                <span>Total:</span>
                <span className="text-primary-600">${bookingDetails.servicePrice.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Payment Options */}
          <div className="space-y-4">
            {/* Pay Now Option */}
            <Card 
              className={`cursor-pointer transition-all border-2 ${
                paymentTiming === 'now' 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-200 hover:border-primary-300'
              }`}
              onClick={() => setPaymentTiming('now')}
            >
              <div className="flex items-start gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                  paymentTiming === 'now' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                }`}>
                  {paymentTiming === 'now' && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-bold text-gray-900">Pay Now</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    Pay securely with your card. Your payment is held in escrow and released to the barber after your service.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 text-green-600">
                      <Shield className="w-3 h-3" /> Protected by escrow
                    </span>
                    <span className="flex items-center gap-1 text-green-600">
                      <Lock className="w-3 h-3" /> Secure payment
                    </span>
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" /> Easy refunds
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Pay Later Option */}
            <Card 
              className={`cursor-pointer transition-all border-2 ${
                paymentTiming === 'later' 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-200 hover:border-primary-300'
              }`}
              onClick={() => setPaymentTiming('later')}
            >
              <div className="flex items-start gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                  paymentTiming === 'later' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                }`}>
                  {paymentTiming === 'later' && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <h3 className="text-lg font-bold text-gray-900">Pay After Service</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">
                    Book now and pay after your haircut is complete. You can pay by card, cash, or other methods.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="w-3 h-3" /> Pay when satisfied
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <DollarSign className="w-3 h-3" /> Multiple payment options
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Continue Button */}
          <div className="mt-8">
            <Button 
              onClick={() => {
                if (paymentTiming === 'now') {
                  setStep('payment');
                } else if (paymentTiming === 'later') {
                  handlePayLater();
                }
              }}
              disabled={!paymentTiming}
              className="w-full py-4 text-lg"
            >
              {paymentTiming === 'now' ? 'Continue to Payment' : paymentTiming === 'later' ? 'Confirm Booking' : 'Select an Option'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Payment Form Screen
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button onClick={() => navigate(-1)} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
            <p className="text-gray-600 mt-1">Review your booking and pay securely</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ============================================================ */}
            {/* TODO: TIPPING SECTION - IMPLEMENT FULL FUNCTIONALITY */}
            {/* ============================================================ */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Heart className="w-5 h-5 text-pink-500" />
                <h3 className="text-lg font-bold text-gray-900">Add a Tip</h3>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                  TODO: IMPLEMENT
                </span>
              </div>
              
              {/* TODO Implementation Notice */}
              <div className="bg-amber-50 border-2 border-amber-300 border-dashed rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 mb-1">Tipping System Not Yet Implemented</p>
                    <p className="text-sm text-amber-700">
                      This UI is a placeholder. The following needs to be built:
                    </p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Backend: Add tip_amount to payment intent & booking</li>
                      <li>Backend: Ensure 100% of tip goes to barber (no platform fee)</li>
                      <li>Frontend: Connect tip selection to payment flow</li>
                      <li>Barber Dashboard: Show tip earnings separately</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Show your appreciation! 100% of your tip goes directly to {bookingDetails.barberName}.
              </p>
              
              {/* Tip Selection Buttons */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {TIP_PERCENTAGES.map((tip) => (
                  <button
                    key={tip.value}
                    onClick={() => handleTipSelect(tip.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      (tipSelection.type === 'none' && tip.value === 0) ||
                      (tipSelection.type === 'percentage' && tipSelection.percentage === tip.value)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="font-bold">{tip.label}</div>
                    {tip.value > 0 && (
                      <div className="text-xs text-gray-500">
                        ${((bookingDetails.servicePrice * tip.value) / 100).toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Tip Input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Custom amount"
                    value={customTipInput}
                    onChange={(e) => setCustomTipInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <Button 
                  variant="secondary" 
                  onClick={handleCustomTip}
                  disabled={!customTipInput}
                >
                  Apply
                </Button>
              </div>

              {tipAmount > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <Heart className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    You're adding a <strong>${tipAmount.toFixed(2)}</strong> tip. Thank you for supporting your barber!
                  </span>
                </div>
              )}
            </Card>
            {/* ============================================================ */}
            {/* END TIPPING SECTION */}
            {/* ============================================================ */}

            {/* Payment Method */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-bold text-gray-900">Payment Method</h3>
              </div>

              <div className="space-y-4">
                {/* Cardholder Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name on Card
                  </label>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Card Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                      <img src="https://img.icons8.com/color/32/visa.png" alt="Visa" className="h-6" />
                      <img src="https://img.icons8.com/color/32/mastercard.png" alt="Mastercard" className="h-6" />
                    </div>
                  </div>
                </div>

                {/* Expiry & CVC */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Save Card */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Save card for future payments</span>
                </label>
              </div>

              {/* Security Notice */}
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <Lock className="w-4 h-4" />
                <span>Your payment is secured with 256-bit SSL encryption</span>
              </div>
            </Card>

            {/* Pay Button */}
            <Button onClick={handlePayment} className="w-full py-4 text-lg">
              <Lock className="w-5 h-5 mr-2" />
              Pay ${totalCharge.toFixed(2)}
            </Button>

            {/* Terms */}
            <p className="text-xs text-gray-500 text-center">
              By completing this payment, you agree to our{' '}
              <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
            </p>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            {/* Booking Summary */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Barber</p>
                  <p className="font-semibold text-gray-900">{bookingDetails.barberName}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Service</p>
                  <p className="font-semibold text-gray-900">{bookingDetails.serviceName}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Date & Time</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(bookingDetails.scheduledAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-600">
                    {new Date(bookingDetails.scheduledAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Duration</p>
                  <p className="font-semibold text-gray-900">{bookingDetails.duration} minutes</p>
                </div>
              </div>
            </Card>

            {/* Price Breakdown */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Price Breakdown</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Price</span>
                  <span className="font-medium">${bookingDetails.servicePrice.toFixed(2)}</span>
                </div>
                
                {tipAmount > 0 && (
                  <div className="flex justify-between text-primary-600">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      Tip
                    </span>
                    <span className="font-medium">${tipAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">${totalCharge.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </Card>

            {/* How Payment Works */}
            <Card className="bg-primary-50 border-2 border-primary-200">
              <h3 className="text-sm font-bold text-primary-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                How Payment Works
              </h3>
              <ul className="text-xs text-primary-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold bg-primary-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">1</span>
                  <span>Payment is securely processed via Stripe</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold bg-primary-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">2</span>
                  <span>Funds held in escrow until service complete</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold bg-primary-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">3</span>
                  <span>Barber receives payment via Stripe Connect</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold bg-primary-200 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">4</span>
                  <span>Full refund if service not completed</span>
                </li>
              </ul>
            </Card>

            {/* Stripe Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Lock className="w-3 h-3" />
              <span>Powered by</span>
              <span className="font-bold text-indigo-600">Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
