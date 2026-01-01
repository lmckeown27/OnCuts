import { useState, useEffect, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, DollarSign, User, Scissors, CreditCard, Banknote, CheckCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import { SERVICE_TYPES, findService } from '../config/services';
import api from '../services/api.service';
import toast from 'react-hot-toast';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface WalkInPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberName: string;
  barberSpecialties?: string[]; // Barber's selected services
}

type PaymentMethod = 'digital' | 'cash' | null;
type Step = 'details' | 'method' | 'digital-payment' | 'processing' | 'success';

// Card Payment Form Component
function CardPaymentForm({
  amount,
  customerName,
  serviceName,
  onSuccess,
  onError,
}: {
  amount: number;
  customerName: string;
  serviceName: string;
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [walkInId, setWalkInId] = useState<string | null>(null);

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await api.post<{
          walkInId: string;
          clientSecret: string;
          paymentIntentId: string;
          amount: number;
        }>('/bookings-simple/walk-in/create-payment', {
          customerName,
          serviceName,
          priceUsdCents: Math.round(amount * 100),
        });

        setClientSecret(response.clientSecret);
        setWalkInId(response.walkInId);
      } catch (err: any) {
        console.error('Failed to create payment intent:', err);
        setError(err.message || 'Failed to initialize payment');
        onError(err.message || 'Failed to initialize payment');
      }
    };

    createPaymentIntent();
  }, [amount, customerName, serviceName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
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
        // Confirm on backend
        await api.post('/bookings-simple/walk-in/confirm-payment', {
          paymentIntentId: paymentIntent.id,
          walkInId,
        });

        onSuccess(paymentIntent.id);
      } else {
        throw new Error('Payment was not completed');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
        <p className="text-gray-600">Preparing payment...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Display */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-600">Amount Due</p>
        <p className="text-4xl font-bold text-green-600">${amount.toFixed(2)}</p>
        <p className="text-gray-500">{serviceName} for {customerName}</p>
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
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 text-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            Charge ${amount.toFixed(2)}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-gray-500">
        Secured by Stripe. Payment information is encrypted.
      </p>
    </form>
  );
}

export default function WalkInPaymentModal({ isOpen, onClose, barberName, barberSpecialties = [] }: WalkInPaymentModalProps) {
  // Build services list from barber's specialties + custom option
  const SERVICES = useMemo(() => {
    // If barber has no specialties, show all services as fallback
    if (barberSpecialties.length === 0) {
      return [
        ...SERVICE_TYPES.map(s => ({ id: s.id, name: s.name, price: s.basePrice || 25 })),
        { id: 'custom', name: 'Custom Amount', price: 0 },
      ];
    }
    
    // Map barber's specialties to services with prices
    const barberServices = barberSpecialties
      .map(specialty => {
        const service = findService(specialty);
        if (service) {
          return { id: service.id, name: service.name, price: service.basePrice || 25 };
        }
        // If specialty doesn't match a known service, use it as-is with default price
        return { id: specialty.toLowerCase().replace(/\s+/g, '-'), name: specialty, price: 25 };
      })
      .sort((a, b) => a.price - b.price); // Sort by price
    
    // Always add custom option at the end
    return [...barberServices, { id: 'custom', name: 'Custom Amount', price: 0 }];
  }, [barberSpecialties]);

  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  // Form state
  const [step, setStep] = useState<Step>('details');
  const [customerName, setCustomerName] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isRecordingCash, setIsRecordingCash] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        // Reset form
        setStep('details');
        setCustomerName('');
        setSelectedService(null);
        setCustomPrice('');
        setPaymentMethod(null);
        setTransactionId(null);
        setIsRecordingCash(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const getServicePrice = (): number => {
    if (selectedService === 'custom') {
      return parseFloat(customPrice) || 0;
    }
    const service = SERVICES.find(s => s.id === selectedService);
    return service?.price || 0;
  };

  const getServiceName = (): string => {
    if (selectedService === 'custom') {
      return 'Custom Service';
    }
    const service = SERVICES.find(s => s.id === selectedService);
    return service?.name || '';
  };

  const price = getServicePrice();
  const isDetailsValid = customerName.trim() && selectedService && price > 0;

  const handleCashPayment = async () => {
    setIsRecordingCash(true);
    try {
      const response = await api.post<{
        transactionId: string;
        amountPaid: number;
      }>('/bookings-simple/walk-in/record-cash', {
        customerName: customerName.trim(),
        serviceName: getServiceName(),
        priceUsdCents: Math.round(price * 100),
      });

      setTransactionId(response.transactionId);
      setPaymentMethod('cash');
      setStep('success');
      toast.success('Cash payment recorded!');
    } catch (error: any) {
      console.error('Failed to record cash payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setIsRecordingCash(false);
    }
  };

  const handleDigitalPayment = () => {
    setPaymentMethod('digital');
    setStep('digital-payment');
  };

  const handlePaymentSuccess = (txId: string) => {
    setTransactionId(txId);
    setStep('success');
    toast.success('Payment successful!');
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-primary-500 text-white px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Walk-in Payment</h2>
              <p className="text-white/80 text-sm">Quick payment for {barberName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* Step 1: Service Details */}
          {step === 'details' && (
            <div className="space-y-6">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scissors className="w-4 h-4 inline mr-2" />
                  Select Service
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {SERVICES.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        selectedService === service.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm">{service.name}</p>
                      {service.price > 0 && (
                        <p className="text-green-600 font-semibold">${service.price}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Price Input */}
              {selectedService === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Enter Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-2xl font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Summary */}
              {isDetailsValid && (
                <Card className="bg-gray-50 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-3xl font-bold text-green-600">${price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Customer</p>
                      <p className="font-semibold text-gray-900">{customerName}</p>
                      <p className="text-sm text-gray-500">{getServiceName()}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Continue Button */}
              <Button
                onClick={() => setStep('method')}
                disabled={!isDetailsValid}
                className="w-full py-4 text-lg"
              >
                Continue to Payment
              </Button>
            </div>
          )}

          {/* Step 2: Payment Method */}
          {step === 'method' && (
            <div className="space-y-6">
              {/* Summary Card */}
              <Card className="bg-gradient-to-r from-green-50 to-primary-50 p-4 border-2 border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Charging {customerName}</p>
                    <p className="text-3xl font-bold text-green-600">${price.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">{getServiceName()}</p>
                  </div>
                </div>
              </Card>

              <h3 className="text-lg font-semibold text-gray-900">How will they pay?</h3>

              {/* Digital Payment */}
              <Card 
                className="p-4 cursor-pointer border-2 border-gray-200 hover:border-primary-300 transition-all"
                onClick={handleDigitalPayment}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 rounded-full p-3">
                    <CreditCard className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Card Payment</h4>
                    <p className="text-sm text-gray-600">Customer pays with credit/debit card</p>
                  </div>
                </div>
              </Card>

              {/* Cash Payment */}
              <Card 
                className={`p-4 cursor-pointer border-2 border-gray-200 hover:border-green-300 transition-all ${
                  isRecordingCash ? 'opacity-50 pointer-events-none' : ''
                }`}
                onClick={handleCashPayment}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-3">
                    {isRecordingCash ? (
                      <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                    ) : (
                      <Banknote className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Cash Payment</h4>
                    <p className="text-sm text-gray-600">Record cash payment for your records</p>
                  </div>
                </div>
              </Card>

              {/* Back Button */}
              <Button
                onClick={() => setStep('details')}
                variant="secondary"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}

          {/* Step 3: Digital Payment with Stripe */}
          {step === 'digital-payment' && (
            <div className="space-y-6">
              <Elements stripe={stripePromise}>
                <CardPaymentForm
                  amount={price}
                  customerName={customerName}
                  serviceName={getServiceName()}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>

              {/* Back Button */}
              <Button
                onClick={() => setStep('method')}
                variant="secondary"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-6">
              <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Complete!</h3>
                <p className="text-gray-600">
                  {paymentMethod === 'cash' 
                    ? 'Cash payment recorded successfully.'
                    : 'Card payment processed successfully.'}
                </p>
              </div>

              <Card className="bg-gray-50 p-4 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-medium">{getServiceName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{paymentMethod === 'cash' ? 'Cash' : 'Card'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 mt-2">
                    <span>Total:</span>
                    <span className="text-green-600">${price.toFixed(2)}</span>
                  </div>
                  {transactionId && (
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>Transaction ID:</span>
                      <span className="font-mono truncate max-w-[150px]">{transactionId}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Button onClick={onClose} className="w-full py-4 text-lg">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
