/**
 * Admin Dashboard
 * 
 * Central hub for platform administration:
 * - Stripe payment monitoring
 * - Platform statistics
 * - Dispute resolution
 * - Fee management
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  Percent,
  Shield
} from 'lucide-react';

interface PlatformStats {
  total_users: number;
  total_barbers: number;
  total_students: number;
  total_bookings: number;
  total_completed: number;
  total_pending: number;
  total_volume_usd: number;
  platform_fees_accumulated: number;
  pending_payouts: number;
  active_escrow: number;
}

interface RecentTransaction {
  id: string;
  type: 'payment' | 'payout' | 'refund';
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  description: string;
  timestamp: string;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      
      // Mock stats with USD values
      setStats({
        total_users: data.stats?.total_users || 156,
        total_barbers: Math.floor((data.stats?.total_users || 156) * 0.3),
        total_students: Math.floor((data.stats?.total_users || 156) * 0.7),
        total_bookings: data.stats?.total_bookings || 847,
        total_completed: Math.floor((data.stats?.total_bookings || 847) * 0.85),
        total_pending: Math.floor((data.stats?.total_bookings || 847) * 0.15),
        total_volume_usd: 28945.00,
        platform_fees_accumulated: 1447.25,
        pending_payouts: 2156.80,
        active_escrow: 845.00,
      });

      // Mock recent transactions
      setRecentTransactions([
        { id: 'pi_1234', type: 'payment', amount: 35.00, status: 'completed', description: 'Fade haircut - Marcus T.', timestamp: '2 min ago' },
        { id: 'po_5678', type: 'payout', amount: 156.75, status: 'processing', description: 'Weekly payout - Jordan W.', timestamp: '15 min ago' },
        { id: 'pi_9012', type: 'payment', amount: 45.00, status: 'completed', description: 'Cut + Beard - Alex C.', timestamp: '32 min ago' },
        { id: 'rf_3456', type: 'refund', amount: 28.00, status: 'completed', description: 'Cancelled booking refund', timestamp: '1 hour ago' },
        { id: 'pi_7890', type: 'payment', amount: 30.00, status: 'pending', description: 'Basic cut - Tyler M.', timestamp: '1 hour ago' },
      ]);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      // Set mock data on error
      setStats({
        total_users: 156,
        total_barbers: 47,
        total_students: 109,
        total_bookings: 847,
        total_completed: 720,
        total_pending: 127,
        total_volume_usd: 28945.00,
        platform_fees_accumulated: 1447.25,
        pending_payouts: 2156.80,
        active_escrow: 845.00,
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'payout': return <DollarSign className="w-4 h-4 text-blue-600" />;
      case 'refund': return <ArrowUpRight className="w-4 h-4 text-red-600 rotate-180" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Completed</span>;
      case 'processing': return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Processing</span>;
      case 'pending': return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Pending</span>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Monitor platform payments, manage disputes, and track revenue
          </p>
        </div>

        {/* Platform Stats */}
        {!loading && stats && (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Total Users</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stats.total_barbers} barbers · {stats.total_students} students
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-3">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Total Bookings</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_bookings.toLocaleString()}</div>
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {stats.total_completed} completed ({Math.round((stats.total_completed / stats.total_bookings) * 100)}%)
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 rounded-full p-3">
                    <DollarSign className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Total Volume</div>
                    <div className="text-2xl font-bold text-gray-900">${stats.total_volume_usd.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      All-time revenue processed
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 rounded-full p-3">
                    <Percent className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Platform Fees (5%)</div>
                    <div className="text-2xl font-bold text-emerald-600">${stats.platform_fees_accumulated.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Accumulated earnings
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <CreditCard className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Stripe</span>
                </div>
                <div className="text-3xl font-bold mb-1">${stats.pending_payouts.toLocaleString()}</div>
                <div className="text-sm opacity-90">Pending Barber Payouts</div>
                <div className="text-xs opacity-75 mt-2">Processing within 2 business days</div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Escrow</span>
                </div>
                <div className="text-3xl font-bold mb-1">${stats.active_escrow.toLocaleString()}</div>
                <div className="text-sm opacity-90">Active in Escrow</div>
                <div className="text-xs opacity-75 mt-2">{stats.total_pending} bookings awaiting completion</div>
              </div>

              <div className="bg-gradient-to-br from-primary-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Growth</span>
                </div>
                <div className="text-3xl font-bold mb-1">+12.5%</div>
                <div className="text-sm opacity-90">This Month</div>
                <div className="text-xs opacity-75 mt-2">vs. previous month</div>
              </div>
            </div>
          </>
        )}

        {/* Recent Transactions & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <Link to="/web/admin/payments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === 'payment' ? 'bg-green-100' : 
                      tx.type === 'payout' ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{tx.description}</div>
                      <div className="text-xs text-gray-500">{tx.timestamp}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      tx.type === 'refund' ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {tx.type === 'refund' ? '-' : ''}${tx.amount.toFixed(2)}
                    </div>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Pending Disputes
              </h3>
              <p className="text-gray-600 text-sm mb-4">Review and resolve booking disputes</p>
              <button className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors font-medium">
                View Disputes (0)
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                Campus Management
              </h3>
              <p className="text-gray-600 text-sm mb-4">Manage campuses, barbers, and students</p>
              <Link 
                to="/web/admin" 
                className="block w-full px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium text-center"
              >
                View Campuses
              </Link>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Fraud Detection
              </h3>
              <p className="text-gray-600 text-sm mb-4">Monitor suspicious activity</p>
              <Link 
                to="/web/admin/fraud" 
                className="block w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-center"
              >
                View Alerts
              </Link>
            </div>
          </div>
        </div>

        {/* Payment Infrastructure Info */}
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-600" />
            Payment Infrastructure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1">Stripe Payments</div>
              <div className="text-sm text-gray-600">PCI-compliant card processing</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1">Stripe Connect</div>
              <div className="text-sm text-gray-600">Automated barber payouts</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1">Escrow System</div>
              <div className="text-sm text-gray-600">Secure fund holding until completion</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1">5% Platform Fee</div>
              <div className="text-sm text-gray-600">Automatic fee collection</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

