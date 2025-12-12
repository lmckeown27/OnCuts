/**
 * Barber Earnings Page
 * 
 * Manage earnings, withdrawals, and Stripe Connect
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import Card from '../../components/Card';
import BarberWithdrawal from '../../components/BarberWithdrawal';

export default function BarberEarningsPage() {
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 5460,
  });

  // Mock barber data
  const barberId = 'barber-demo-123';
  const stripeAccountId = ''; // Set to actual Stripe account ID when onboarded

  // Mock recent earnings
  const recentEarnings = [
    { date: '2024-12-11', amount: 105, bookings: 3 },
    { date: '2024-12-10', amount: 140, bookings: 4 },
    { date: '2024-12-09', amount: 70, bookings: 2 },
    { date: '2024-12-08', amount: 175, bookings: 5 },
    { date: '2024-12-07', amount: 35, bookings: 1 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button onClick={() => navigate('/barber')} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Earnings & Payouts</h1>
            <p className="text-gray-600 mt-1">Manage your earnings and withdraw funds</p>
          </div>
        </div>

        {/* Earnings Summary */}
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
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.thisWeek.toFixed(0)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.thisMonth.toFixed(0)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">All Time</p>
                <p className="text-2xl font-bold text-gray-900">${earnings.total.toFixed(0)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Withdrawal Component */}
        <BarberWithdrawal barberId={barberId} stripeAccountId={stripeAccountId} />

        {/* Recent Earnings */}
        <Card className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Earnings</h3>
          <div className="space-y-2">
            {recentEarnings.map((earning, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
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
                <p className="text-xl font-bold text-green-600">
                  +${earning.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* How Payouts Work */}
        <Card className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">How Payouts Work</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="font-semibold text-gray-900">Complete Booking</p>
                <p className="text-gray-600">Student confirms haircut completion</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="font-semibold text-gray-900">Escrow Release</p>
                <p className="text-gray-600">Blockchain automatically releases 95% to you</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="font-semibold text-gray-900">Available Balance</p>
                <p className="text-gray-600">Funds appear in your available balance</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <p className="font-semibold text-gray-900">Withdraw Anytime</p>
                <p className="text-gray-600">Transfer to your bank account (1-2 business days)</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-indigo-200">
            <p className="text-xs text-indigo-700">
              Platform absorbs all blockchain gas fees. You receive 95% of every transaction.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
