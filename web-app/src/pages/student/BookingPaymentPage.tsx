/**
 * Booking Payment Page
 * 
 * Complete booking flow with payment
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import PaymentForm from '../../components/PaymentForm';
import Button from '../../components/Button';
import Card from '../../components/Card';

interface BookingDetails {
  barberId: string;
  barberName: string;
  serviceName: string;
  servicePrice: number;
  scheduledAt: string;
  duration: number;
}

export default function BookingPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingDetails = location.state as BookingDetails;

  const [step, setStep] = useState<'payment' | 'processing' | 'success' | 'error'>('payment');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Mock booking ID for demo
  const bookingId = `booking-${Date.now()}`;
  const studentId = 'student-demo-123';

  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Booking Details</h2>
          <p className="text-gray-600 mb-4">
            Please start from the barber selection page
          </p>
          <Button onClick={() => navigate('/student')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const handlePaymentSuccess = (paymentId: string) => {
    setPaymentIntentId(paymentId);
    setStep('processing');

    // Simulate blockchain escrow lock
    setTimeout(() => {
      setStep('success');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setErrorMessage(error);
    setStep('error');
  };

  // Success Screen
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="text-center max-w-md">
          <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            Your payment of ${bookingDetails.servicePrice.toFixed(2)} has been received and
            locked in escrow. Funds will be released to {bookingDetails.barberName} upon completion.
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
                <span className="text-gray-600">Booking ID:</span>
                <span className="font-mono text-xs">{bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment ID:</span>
                <span className="font-mono text-xs">{paymentIntentId}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg mb-6 text-sm">
            <p className="text-primary-700 font-medium mb-1">Funds Secured in Escrow</p>
            <p className="text-primary-500">
              Your payment is held safely on the Aptos blockchain until service completion.
            </p>
          </div>

          <Button onClick={() => navigate('/student/bookings')} className="w-full">
            View My Bookings
          </Button>
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
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-400 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment...</h2>
          <p className="text-gray-600">
            Securing your funds on the blockchain. This may take a moment.
          </p>
        </Card>
      </div>
    );
  }

  // Payment Form Screen
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button onClick={() => navigate(-1)} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Complete Booking</h1>
            <p className="text-gray-600 mt-1">Review and pay for your appointment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Booking Summary */}
          <div>
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

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-400">${bookingDetails.servicePrice.toFixed(2)}</span>
                </div>
              </div>
            </Card>

            {/* How Escrow Works */}
            <Card className="mt-4 bg-primary-50 border-2 border-primary-200">
              <h3 className="text-sm font-bold text-primary-700 mb-2">How Payment Works</h3>
              <ul className="text-xs text-primary-500 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Payment held in blockchain escrow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Barber completes your haircut</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Funds automatically released</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Full refund if service not completed</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <PaymentForm
              amount={bookingDetails.servicePrice}
              bookingId={bookingId}
              barberId={bookingDetails.barberId}
              studentId={studentId}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

