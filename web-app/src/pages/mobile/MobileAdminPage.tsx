/**
 * Mobile Admin Page
 * 
 * Touch-optimized mobile interface for platform administrators.
 * Features:
 * - Swipeable transaction cards
 * - Bottom navigation
 * - Quick action buttons
 * - Pull-to-refresh
 * - Mobile-optimized metrics
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Home,
  BarChart2,
  Settings,
  Bell,
  Shield,
  Activity,
  Eye,
  CheckCircle,
  Clock,
  CreditCard,
  Percent
} from 'lucide-react';

interface Transaction {
  id: string;
  type: 'booking' | 'payment' | 'payout' | 'refund';
  customer: string;
  barber: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  time: string;
  campus: string;
}

interface Metric {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'pi_1234',
    type: 'payment',
    customer: 'John Davis',
    barber: 'Marcus Johnson',
    amount: 35,
    status: 'completed',
    time: '2 min ago',
    campus: 'Cal Poly SLO'
  },
  {
    id: 'po_5678',
    type: 'payout',
    customer: '',
    barber: 'Jordan Smith',
    amount: 156.75,
    status: 'processing',
    time: '15 min ago',
    campus: 'Cal Poly SLO'
  },
  {
    id: 'pi_9012',
    type: 'payment',
    customer: 'Sarah Williams',
    barber: 'Alex Rivera',
    amount: 45,
    status: 'completed',
    time: '32 min ago',
    campus: 'Cal Poly SLO'
  },
  {
    id: 'rf_3456',
    type: 'refund',
    customer: 'Michael Chen',
    barber: 'Tyler M.',
    amount: 28,
    status: 'completed',
    time: '1 hour ago',
    campus: 'Cal Poly SLO'
  }
];

export default function MobileAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'alerts' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);

  const metrics: Metric[] = [
    {
      label: 'Active Users',
      value: '1,234',
      change: '+12.5%',
      trend: 'up',
      icon: <Users className="w-5 h-5" />,
      color: 'blue'
    },
    {
      label: 'Total Revenue',
      value: '$42,891',
      change: '+8.2%',
      trend: 'up',
      icon: <DollarSign className="w-5 h-5" />,
      color: 'green'
    },
    {
      label: 'Platform Fees',
      value: '$2,145',
      change: '5%',
      trend: 'neutral',
      icon: <Percent className="w-5 h-5" />,
      color: 'primary'
    },
    {
      label: 'Pending Payouts',
      value: '$1,890',
      change: 'via Stripe',
      trend: 'neutral',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'blue'
    }
  ];

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <Activity className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-inset-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/src/assets/logos/Logo1.png" alt="CampusCut" className="h-8" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Platform Management</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Overview</h2>
              <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={`bg-white rounded-xl p-4 border border-gray-200 active:scale-98 transition-transform`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                      metric.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                      metric.color === 'green' ? 'bg-green-100 text-green-600' :
                      metric.color === 'primary' ? 'bg-primary-100 text-primary-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {metric.icon}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                    <div className="text-xs text-gray-500 mb-1">{metric.label}</div>
                    <div className={`text-xs font-medium flex items-center gap-1 ${
                      metric.trend === 'up' ? 'text-green-600' :
                      metric.trend === 'down' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      <TrendingUp className={`w-3 h-3 ${metric.trend === 'down' ? 'rotate-180' : ''}`} />
                      <span>{metric.change}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/app/admin/payments"
                  className="bg-primary-400 text-white rounded-xl p-4 text-left active:scale-98 transition-transform shadow-lg"
                >
                  <CreditCard className="w-6 h-6 mb-2" />
                  <div className="font-semibold">Payments</div>
                  <div className="text-xs opacity-90">& Payouts</div>
                </Link>
                
                <Link
                  to="/app/admin/system-health"
                  className="bg-green-500 text-white rounded-xl p-4 text-left active:scale-98 transition-transform shadow-lg"
                >
                  <Activity className="w-6 h-6 mb-2" />
                  <div className="font-semibold">System</div>
                  <div className="text-xs opacity-90">Health</div>
                </Link>
                
                <Link
                  to="/app/admin/fraud"
                  className="bg-red-500 text-white rounded-xl p-4 text-left active:scale-98 transition-transform shadow-lg"
                >
                  <AlertTriangle className="w-6 h-6 mb-2" />
                  <div className="font-semibold">Fraud</div>
                  <div className="text-xs opacity-90">Detection</div>
                </Link>
                
                <Link
                  to="/app/admin/marketplace"
                  className="bg-blue-500 text-white rounded-xl p-4 text-left active:scale-98 transition-transform shadow-lg"
                >
                  <BarChart2 className="w-6 h-6 mb-2" />
                  <div className="font-semibold">Market</div>
                  <div className="text-xs opacity-90">Analytics</div>
                </Link>
              </div>
            </div>

            {/* Live Transactions */}
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
                <Link to="/app/admin/payments" className="text-primary-600 text-sm font-medium">View All</Link>
              </div>
              
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-white rounded-xl p-4 border border-gray-200 active:scale-98 transition-transform"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {transaction.type === 'payout' ? (
                            `Payout to ${transaction.barber}`
                          ) : transaction.type === 'refund' ? (
                            `Refund to ${transaction.customer}`
                          ) : (
                            `${transaction.customer} → ${transaction.barber}`
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className={`capitalize ${
                            transaction.type === 'payment' ? 'text-green-600' :
                            transaction.type === 'payout' ? 'text-blue-600' :
                            transaction.type === 'refund' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {transaction.type}
                          </span>
                          <span>•</span>
                          <span>{transaction.campus}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${transaction.type === 'refund' ? 'text-red-600' : 'text-gray-900'}`}>
                          {transaction.type === 'refund' ? '-' : ''}${transaction.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">{transaction.time}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(transaction.status)}`}>
                        {getStatusIcon(transaction.status)}
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                      <button className="text-primary-600 text-sm font-medium flex items-center gap-1">
                        View
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Payment Analytics</h2>
            
            <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl p-6 text-white">
              <div className="text-sm opacity-90 mb-1">Total Platform Revenue</div>
              <div className="text-4xl font-bold mb-4">$42,891</div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>+8.2% from last month</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Platform Fees (5%)</div>
                <div className="text-xl font-bold text-primary-600">$2,145</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Pending Payouts</div>
                <div className="text-xl font-bold text-blue-600">$1,890</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Campus Performance</h3>
              <div className="space-y-3">
                {[
                  { name: 'Cal Poly SLO', revenue: '$18,234', users: 456, growth: '+12%' },
                  { name: 'UCLA', revenue: '$15,892', users: 389, growth: '+8%' },
                  { name: 'USC', revenue: '$8,765', users: 234, growth: '+15%' }
                ].map((campus) => (
                  <div key={campus.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-medium text-gray-900">{campus.name}</div>
                      <div className="text-xs text-gray-500">{campus.users} active users</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{campus.revenue}</div>
                      <div className="text-xs text-green-600">{campus.growth}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stripe Info */}
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span className="font-semibold text-indigo-900">Payment Provider</span>
              </div>
              <p className="text-sm text-indigo-700">
                All payments processed via Stripe with PCI-DSS compliance. Barbers receive payouts through Stripe Connect.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-4 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">Alerts & Issues</h2>
            
            {[
              { type: 'warning', title: 'High dispute rate', description: 'Cal Poly SLO showing 5% dispute rate', time: '10 min ago' },
              { type: 'info', title: 'System update available', description: 'New features ready to deploy', time: '1 hour ago' },
              { type: 'success', title: 'Fraud case resolved', description: 'User account reinstated', time: '2 hours ago' }
            ].map((alert, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 border border-gray-200 active:scale-98 transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    alert.type === 'warning' ? 'bg-yellow-100' :
                    alert.type === 'info' ? 'bg-blue-100' :
                    'bg-green-100'
                  }`}>
                    {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                    {alert.type === 'info' && <Bell className="w-5 h-5 text-blue-600" />}
                    {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                    <div className="text-xs text-gray-500">{alert.time}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Settings</h2>
            
            <div className="space-y-2">
              <button className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Campus Management</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              
              <button className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Security</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              
              <button className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Notifications</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
              
              <button className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">System Health</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <button
              onClick={() => navigate('/web')}
              className="w-full py-3 text-primary-600 font-medium"
            >
              Switch to Desktop View
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 px-2 py-2 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'dashboard' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'analytics' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <BarChart2 className="w-6 h-6" />
            <span className="text-xs font-medium">Analytics</span>
          </button>
          
          <button
            onClick={() => setActiveTab('alerts')}
            className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'alerts' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
            <Bell className="w-6 h-6" />
            <span className="text-xs font-medium">Alerts</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'settings' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

