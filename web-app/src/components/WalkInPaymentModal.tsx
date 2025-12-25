import { useState, useEffect } from 'react';
import { X, DollarSign, User, Scissors, CreditCard, Banknote, QrCode, CheckCircle, Copy } from 'lucide-react';
import Button from './Button';
import Card from './Card';

interface WalkInPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberName: string;
}

type PaymentMethod = 'digital' | 'cash' | null;
type Step = 'details' | 'method' | 'digital-payment' | 'success';

// Available services with prices
const SERVICES = [
  { id: 'buzzcut', name: 'Buzz Cut', price: 15 },
  { id: 'lineup', name: 'Line Up', price: 15 },
  { id: 'beardtrim', name: 'Beard Trim', price: 20 },
  { id: 'haircut', name: 'Haircut', price: 25 },
  { id: 'taper', name: 'Taper', price: 25 },
  { id: 'hotshave', name: 'Hot Shave', price: 25 },
  { id: 'fade', name: 'Fade', price: 30 },
  { id: 'haircutfade', name: 'Haircut & Fade', price: 35 },
  { id: 'designart', name: 'Design/Art', price: 40 },
  { id: 'womenscut', name: "Women's Cut", price: 35 },
  { id: 'perm', name: 'Perm', price: 50 },
  { id: 'colortreatment', name: 'Color Treatment', price: 60 },
  { id: 'custom', name: 'Custom Amount', price: 0 },
];

export default function WalkInPaymentModal({ isOpen, onClose, barberName }: WalkInPaymentModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
  // Form state
  const [step, setStep] = useState<Step>('details');
  const [customerName, setCustomerName] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [customPrice, setCustomPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  
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
        setPaymentLinkCopied(false);
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

  // Mock payment link
  const paymentLink = `https://campuscut.pay/${Date.now().toString(36)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setPaymentLinkCopied(true);
    setTimeout(() => setPaymentLinkCopied(false), 2000);
  };

  const handleCashPayment = () => {
    setPaymentMethod('cash');
    setStep('success');
  };

  const handleDigitalPayment = () => {
    setPaymentMethod('digital');
    setStep('digital-payment');
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
                    <h4 className="font-semibold text-gray-900">Card / Digital Payment</h4>
                    <p className="text-sm text-gray-600">Send payment link via text or show QR code</p>
                  </div>
                </div>
              </Card>

              {/* Cash Payment */}
              <Card 
                className="p-4 cursor-pointer border-2 border-gray-200 hover:border-green-300 transition-all"
                onClick={handleCashPayment}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-3">
                    <Banknote className="w-6 h-6 text-green-600" />
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
                Back
              </Button>
            </div>
          )}

          {/* Step 3: Digital Payment */}
          {step === 'digital-payment' && (
            <div className="space-y-6">
              {/* Amount Display */}
              <div className="text-center py-4">
                <p className="text-sm text-gray-600">Amount Due</p>
                <p className="text-4xl font-bold text-green-600">${price.toFixed(2)}</p>
                <p className="text-gray-500">{getServiceName()} for {customerName}</p>
              </div>

              {/* QR Code (Mock) */}
              <Card className="p-6 text-center">
                <div className="bg-gray-100 rounded-xl p-8 mb-4 flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-gray-800" />
                </div>
                <p className="text-sm text-gray-600 mb-2">Customer can scan to pay</p>
                <p className="text-xs text-gray-400 font-mono break-all">{paymentLink}</p>
              </Card>

              {/* Copy Link */}
              <Button
                onClick={handleCopyLink}
                variant="secondary"
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                {paymentLinkCopied ? 'Copied!' : 'Copy Payment Link'}
              </Button>

              {/* Back Button */}
              <Button
                onClick={() => setStep('method')}
                variant="secondary"
                className="w-full"
              >
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
                    : 'Payment received successfully.'}
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
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>Transaction ID:</span>
                    <span className="font-mono">WI-{Date.now().toString(36).toUpperCase()}</span>
                  </div>
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

