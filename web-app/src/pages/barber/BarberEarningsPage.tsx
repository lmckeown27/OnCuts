/**
 * Barber Earnings Page — Path B (USDC on Sui; Stripe for customer USD only)
 */

import { useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import Card from '../../components/Card';
import WithdrawalOptions from '../../components/WithdrawalOptions';
import BarberHeader from '../../components/BarberHeader';

export default function BarberEarningsPage() {
  const navigate = useNavigate();
  const [earnings] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 5460,
  });

  const recentEarnings = [
    { date: '2024-12-11', amount: 105, bookings: 3 },
    { date: '2024-12-10', amount: 140, bookings: 4 },
    { date: '2024-12-09', amount: 70, bookings: 2 },
    { date: '2024-12-08', amount: 175, bookings: 5 },
    { date: '2024-12-07', amount: 35, bookings: 1 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <BarberHeader title="Earnings & payouts" showBookingRequests={false} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button variant="outline" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="mb-8 border-primary-200 bg-primary-50/50">
          <div className="flex items-start gap-3">
            <Wallet className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-semibold text-gray-900">Path B payouts</h2>
              <p className="text-sm text-gray-600 mt-1">
                Customer payments run through <strong>Stripe Checkout (USD)</strong>. Your share settles as{' '}
                <strong>USDC on Sui</strong> to the address in{' '}
                <button
                  type="button"
                  className="text-primary-600 font-medium underline"
                  onClick={() => navigate('/web/barber?showPayoutSettings=true')}
                >
                  Payout Settings
                </button>
                . This page is for any <em>separate</em> custodial balance withdrawals to Sui.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-full p-3">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.today.toFixed(0)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-green-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This week</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.thisWeek.toFixed(0)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This month</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.thisMonth.toFixed(0)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600">All time</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.total.toFixed(0)}</p>
              </div>
            </div>
          </Card>
        </div>

        <WithdrawalOptions availableBalance={earnings.total} />

        <Card className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent earnings</h3>
          <div className="space-y-2">
            {recentEarnings.map((earning, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(earning.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-500">{earning.bookings} bookings completed</p>
                </div>
                <p className="text-xl font-bold text-green-600">+${earning.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-8 bg-gradient-to-br from-primary-50 to-primary-50 border-2 border-primary-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">How Path B works</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="font-semibold text-gray-900">Customer pays (USD)</p>
                <p className="text-gray-600">Stripe Checkout on the platform account.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="font-semibold text-gray-900">Booking marked paid</p>
                <p className="text-gray-600">Webhook + ledger; then USDC settlement on Sui to your linked address.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-400 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="font-semibold text-gray-900">You hold USDC</p>
                <p className="text-gray-600">Cash out via CEX, wallet off-ramp, or other tools—outside CampusCuts.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
