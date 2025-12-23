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
import { useViewport } from '../../hooks/useViewport';

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
  
  // Viewport detection for responsive layout
  const { isMobile, isMobilePortrait } = useViewport();

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
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Monitor platform payments, manage disputes, and track revenue
          </p>
        </div>

        {/* Platform Stats */}
        {!loading && stats && (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="bg-blue-100 rounded-full p-2 sm:p-3">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500">Total Users</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total_users.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1 hidden sm:block">
                      {stats.total_barbers} barbers · {stats.total_students} students
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="bg-green-100 rounded-full p-2 sm:p-3">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500">Bookings</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total_bookings.toLocaleString()}</div>
                    <div className="text-xs text-green-600 mt-1 items-center gap-1 hidden sm:flex">
                      <CheckCircle className="w-3 h-3" />
                      {stats.total_completed} completed
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="bg-primary-100 rounded-full p-2 sm:p-3">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500">Volume</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">${stats.total_volume_usd.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1 hidden sm:block">
                      All-time revenue
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="bg-emerald-100 rounded-full p-2 sm:p-3">
                    <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500">Fees (5%)</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">${stats.platform_fees_accumulated.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1 hidden sm:block">
                      Accumulated
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Stripe</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">${stats.pending_payouts.toLocaleString()}</div>
                <div className="text-sm opacity-90">Pending Payouts</div>
                <div className="text-xs opacity-75 mt-1 sm:mt-2 hidden sm:block">Processing within 2 business days</div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Escrow</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">${stats.active_escrow.toLocaleString()}</div>
                <div className="text-sm opacity-90">Active in Escrow</div>
                <div className="text-xs opacity-75 mt-1 sm:mt-2 hidden sm:block">{stats.total_pending} bookings awaiting</div>
              </div>

              <div className="bg-gradient-to-br from-primary-500 to-green-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Growth</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">+12.5%</div>
                <div className="text-sm opacity-90">This Month</div>
                <div className="text-xs opacity-75 mt-1 sm:mt-2 hidden sm:block">vs. previous month</div>
              </div>
            </div>
          </>
        )}

        {/* Recent Transactions & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <Link to="/web/admin/payments" className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 font-medium">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'payment' ? 'bg-green-100' : 
                      tx.type === 'payout' ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{tx.description}</div>
                      <div className="text-xs text-gray-500">{tx.timestamp}</div>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <div className={`font-semibold text-sm sm:text-base ${
                      tx.type === 'refund' ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {tx.type === 'refund' ? '-' : ''}${tx.amount.toFixed(2)}
                    </div>
                    <div className="hidden sm:block">{getStatusBadge(tx.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                Disputes
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 hidden sm:block">Review and resolve booking disputes</p>
              <button className="w-full px-3 sm:px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors font-medium text-sm">
                View (0)
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                Campuses
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 hidden sm:block">Manage campuses, barbers, and students</p>
              <Link 
                to="/web/admin" 
                className="block w-full px-3 sm:px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium text-center text-sm"
              >
                Manage
              </Link>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                Fraud
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 hidden sm:block">Monitor suspicious activity</p>
              <Link 
                to="/web/admin/fraud" 
                className="block w-full px-3 sm:px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-center text-sm"
              >
                Alerts
              </Link>
            </div>
          </div>
        </div>

        {/* Payment Infrastructure Info */}
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
            Payment Infrastructure
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Stripe</div>
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">PCI-compliant processing</div>
            </div>
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Connect</div>
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">Automated payouts</div>
            </div>
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Escrow</div>
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">Secure holding</div>
            </div>
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-primary-100">
              <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">5% Fee</div>
              <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">Auto collection</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

