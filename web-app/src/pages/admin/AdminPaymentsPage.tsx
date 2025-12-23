/**
 * Admin Payments Page
 * 
 * Displays payment monitoring, Stripe integration status, and transaction management
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Building2,
  Users,
  Calendar,
  Filter,
  Download,
  Search
} from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import AdminHeader from '../../components/AdminHeader';

interface PaymentStats {
  totalVolume: number;
  platformFees: number;
  pendingPayouts: number;
  activeEscrow: number;
  successRate: number;
  avgTransactionValue: number;
  todayVolume: number;
  weeklyGrowth: number;
}

interface Transaction {
  id: string;
  type: 'payment' | 'payout' | 'refund' | 'fee';
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  description: string;
  customer?: string;
  barber?: string;
  campus: string;
  timestamp: string;
  stripeId?: string;
}

interface PayoutSummary {
  barberId: string;
  barberName: string;
  campus: string;
  pendingAmount: number;
  completedBookings: number;
  nextPayoutDate: string;
  stripeConnected: boolean;
}

// Mock data
const MOCK_STATS: PaymentStats = {
  totalVolume: 28945.00,
  platformFees: 1447.25,
  pendingPayouts: 2156.80,
  activeEscrow: 845.00,
  successRate: 98.7,
  avgTransactionValue: 34.18,
  todayVolume: 892.50,
  weeklyGrowth: 12.5,
};

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'pi_1N7abc123', type: 'payment', amount: 35.00, status: 'completed', description: 'Fade haircut', customer: 'John D.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '2 min ago', stripeId: 'pi_1N7abc123' },
  { id: 'po_2M8def456', type: 'payout', amount: 475.25, status: 'processing', description: 'Weekly payout', barber: 'Jordan W.', campus: 'Cal Poly SLO', timestamp: '15 min ago', stripeId: 'po_2M8def456' },
  { id: 'pi_3L9ghi789', type: 'payment', amount: 45.00, status: 'completed', description: 'Cut + Beard trim', customer: 'Mike S.', barber: 'Alex C.', campus: 'UCSB', timestamp: '32 min ago', stripeId: 'pi_3L9ghi789' },
  { id: 'fee_4K0jkl012', type: 'fee', amount: 2.25, status: 'completed', description: 'Platform fee (5%)', barber: 'Alex C.', campus: 'UCSB', timestamp: '32 min ago' },
  { id: 'rf_5J1mno345', type: 'refund', amount: 28.00, status: 'completed', description: 'Cancelled booking', customer: 'Sarah L.', barber: 'Tyler M.', campus: 'UCLA', timestamp: '1 hour ago', stripeId: 'rf_5J1mno345' },
  { id: 'pi_6I2pqr678', type: 'payment', amount: 30.00, status: 'pending', description: 'Basic cut', customer: 'Emily R.', barber: 'Carlos R.', campus: 'UCLA', timestamp: '1 hour ago', stripeId: 'pi_6I2pqr678' },
  { id: 'pi_7H3stu901', type: 'payment', amount: 55.00, status: 'failed', description: 'Premium service', customer: 'David K.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '2 hours ago', stripeId: 'pi_7H3stu901' },
];

const MOCK_PAYOUTS: PayoutSummary[] = [
  { barberId: 'b1', barberName: 'Marcus Thompson', campus: 'Cal Poly SLO', pendingAmount: 523.75, completedBookings: 15, nextPayoutDate: 'Dec 24, 2025', stripeConnected: true },
  { barberId: 'b2', barberName: 'Jordan Williams', campus: 'Cal Poly SLO', pendingAmount: 312.50, completedBookings: 9, nextPayoutDate: 'Dec 24, 2025', stripeConnected: true },
  { barberId: 'b3', barberName: 'Alex Chen', campus: 'UCSB', pendingAmount: 187.25, completedBookings: 5, nextPayoutDate: 'Dec 24, 2025', stripeConnected: true },
  { barberId: 'b4', barberName: 'Tyler Martinez', campus: 'UCSB', pendingAmount: 445.00, completedBookings: 12, nextPayoutDate: 'Dec 24, 2025', stripeConnected: false },
];

export default function AdminPaymentsPage() {
  const [stats, setStats] = useState<PaymentStats>(MOCK_STATS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [payouts, setPayouts] = useState<PayoutSummary[]>(MOCK_PAYOUTS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'payouts' | 'escrow'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment': return 'text-green-600';
      case 'payout': return 'text-blue-600';
      case 'refund': return 'text-red-600';
      case 'fee': return 'text-primary-600';
      default: return 'text-gray-600';
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.barber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || tx.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Payments & Transactions" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-semibold">TOTAL VOLUME</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalVolume.toLocaleString()}</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  +{stats.weeklyGrowth}% this week
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-primary-50 to-emerald-50 border-primary-200">
            <div className="flex items-center gap-4">
              <div className="bg-primary-100 rounded-full p-3">
                <CreditCard className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-primary-600 font-semibold">PLATFORM FEES (5%)</p>
                <p className="text-2xl font-bold text-gray-900">${stats.platformFees.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Accumulated earnings</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-full p-3">
                <ArrowUpRight className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-semibold">PENDING PAYOUTS</p>
                <p className="text-2xl font-bold text-gray-900">${stats.pendingPayouts.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">To barbers via Stripe Connect</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-center gap-4">
              <div className="bg-amber-100 rounded-full p-3">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-600 font-semibold">ACTIVE ESCROW</p>
                <p className="text-2xl font-bold text-gray-900">${stats.activeEscrow.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting service completion</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Volume</p>
                <p className="text-xl font-bold text-gray-900">${stats.todayVolume.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-xl font-bold text-green-600">{stats.successRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Transaction</p>
                <p className="text-xl font-bold text-gray-900">${stats.avgTransactionValue.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'transactions' 
                ? 'bg-primary-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'payouts' 
                ? 'bg-primary-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Barber Payouts
          </button>
          <button
            onClick={() => setActiveTab('escrow')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'escrow' 
                ? 'bg-primary-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Escrow Holdings
          </button>
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
              
              <div className="flex gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Types</option>
                  <option value="payment">Payments</option>
                  <option value="payout">Payouts</option>
                  <option value="refund">Refunds</option>
                  <option value="fee">Fees</option>
                </select>

                <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>

                <Button variant="secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Transaction</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Parties</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Campus</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{tx.description}</div>
                          <div className="text-xs text-gray-500 font-mono">{tx.id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-medium capitalize ${getTypeColor(tx.type)}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          {tx.customer && <div className="text-gray-700">Customer: {tx.customer}</div>}
                          {tx.barber && <div className="text-gray-600">Barber: {tx.barber}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">{tx.campus}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-semibold ${
                          tx.type === 'refund' ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {tx.type === 'refund' ? '-' : ''}${tx.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-sm text-gray-600">{tx.timestamp}</div>
                        {tx.stripeId && (
                          <a 
                            href={`https://dashboard.stripe.com/payments/${tx.stripeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:underline flex items-center gap-1 justify-end"
                          >
                            Stripe <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Payouts Tab */}
        {activeTab === 'payouts' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Pending Barber Payouts</h3>
              <Button>
                Process All Payouts
              </Button>
            </div>

            <div className="space-y-4">
              {payouts.map((payout) => (
                <div key={payout.barberId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{payout.barberName}</div>
                      <div className="text-sm text-gray-600">{payout.campus}</div>
                      <div className="text-xs text-gray-500">{payout.completedBookings} completed bookings</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">${payout.pendingAmount.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Next payout: {payout.nextPayoutDate}</div>
                    {payout.stripeConnected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        Stripe Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                        <AlertTriangle className="w-3 h-3" />
                        Stripe Not Connected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Escrow Tab */}
        {activeTab === 'escrow' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Active Escrow Holdings</h3>
              <div className="text-2xl font-bold text-amber-600">${stats.activeEscrow.toLocaleString()}</div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900">How Escrow Works</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    When a student books a haircut, their payment is held in escrow until the service is completed.
                    Once the barber marks the booking as complete, 95% is released to the barber (5% platform fee is deducted),
                    and the funds are queued for their next payout via Stripe Connect.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center text-gray-500 py-8">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Detailed escrow breakdown coming soon</p>
              <p className="text-sm">Currently tracking {stats.activeEscrow > 0 ? Math.round(stats.activeEscrow / 35) : 0} pending bookings</p>
            </div>
          </Card>
        )}

        {/* Stripe Integration Info */}
        <Card className="mt-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200">
          <div className="flex items-start gap-4">
            <div className="bg-indigo-100 rounded-full p-3 flex-shrink-0">
              <CreditCard className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stripe Integration</h3>
              <p className="text-sm text-gray-700 mb-4">
                CampusCut uses Stripe for secure payment processing and barber payouts.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-indigo-100">
                  <h4 className="font-semibold text-gray-900 mb-2">Student Payments</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Credit/debit cards via Stripe Elements</li>
                    <li>• Apple Pay & Google Pay support</li>
                    <li>• PCI-DSS Level 1 compliant</li>
                    <li>• 3D Secure authentication</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border border-indigo-100">
                  <h4 className="font-semibold text-gray-900 mb-2">Barber Payouts</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Stripe Connect Express accounts</li>
                    <li>• Automatic weekly payouts</li>
                    <li>• Direct bank deposit (2 business days)</li>
                    <li>• Tax reporting (1099-K)</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <a 
                  href="https://dashboard.stripe.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Open Stripe Dashboard
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a 
                  href="https://dashboard.stripe.com/connect/accounts/overview" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium"
                >
                  Manage Connect Accounts
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

