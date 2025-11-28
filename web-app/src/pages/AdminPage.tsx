/**
 * Admin Page
 * 
 * Platform management dashboard for administrators
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Gift,
  ArrowLeft
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import LiveTransactionFeed from '../components/LiveTransactionFeed';
import adminService from '../services/admin.service';
import toast from 'react-hot-toast';
import type { 
  PlatformFees, 
  ReconciliationReport, 
  WithdrawalBatchStats,
  TreasuryStats,
  AuditLog 
} from '../services/admin.service';
import { CampusCutsLogo } from '@assets';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'treasury' | 'fees' | 'reconciliation' | 'batches' | 'wallet' | 'users' | 'audit'>('treasury');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [platformFees, setPlatformFees] = useState<PlatformFees | null>(null);
  const [reconciliationReports, setReconciliationReports] = useState<ReconciliationReport[]>([]);
  const [batchStats, setBatchStats] = useState<WithdrawalBatchStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [walletData, setWalletData] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Use mock data for demonstration (no backend required)
      const mockTreasury: TreasuryStats = {
        total_user_balances_dollars: 12500,
        total_escrow_dollars: 3450,
        total_fees_dollars: 875.50,
      };

      const mockFees: PlatformFees = {
        total_fees_dollars: 875.50,
        available_fees_dollars: 625.50,
        available_count: 78,
        withdrawn_fees_dollars: 250.00,
        withdrawn_count: 32,
        last_withdrawal_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      };

      const mockReports: ReconciliationReport[] = [
        {
          id: '1',
          period_start: new Date(Date.now() - 86400000).toISOString(),
          period_end: new Date().toISOString(),
          status: 'completed',
          discrepancies_found: 0,
          total_transactions_checked: 1523,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          period_start: new Date(Date.now() - 86400000 * 2).toISOString(),
          period_end: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed',
          discrepancies_found: 2,
          total_transactions_checked: 1456,
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      const mockBatches: WithdrawalBatchStats = {
        queued_count: 12,
        queued_total_dollars: 1450.50,
        processing_count: 2,
        processing_total_dollars: 325.00,
        completed_today: 8,
        completed_today_dollars: 2340.75,
        failed_today: 0,
        failed_today_dollars: 0,
      };

      const mockLogs: AuditLog[] = [
        {
          id: '1',
          user_id: 'user-123',
          action: 'PLATFORM_FEE_WITHDRAWAL',
          entity_type: 'platform_fee',
          entity_id: 'fee-456',
          metadata: { amount: 125.50 },
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          user_id: 'user-456',
          action: 'BOOKING_PAYMENT_SUCCESS',
          entity_type: 'booking',
          entity_id: 'booking-789',
          metadata: { amount: 35.00 },
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          user_id: 'admin-1',
          action: 'RECONCILIATION_RUN',
          entity_type: 'system',
          entity_id: 'recon-123',
          metadata: { discrepancies: 0 },
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
      ];

      // Custodial Wallet Mock Data
      const mockWallet = {
        overview: {
          total_users: 156,
          total_available_balance: 12500.50,
          total_pending_balance: 2340.75,
          total_locked_balance: 450.00,
          total_escrow: 3450.00,
          active_escrows: 23,
          platform_balance: 8750.25,
        },
        platformWallet: {
          address: '0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa',
          network: 'devnet',
          onchain_balance_apt: 145.8932,
          onchain_balance_usd: 1458.93,
          total_deposits: 1245,
          total_withdrawals: 1099,
          last_onchain_activity: new Date(Date.now() - 3600000).toISOString(),
        },
        userBalances: [
          {
            user_id: 'student-1',
            email: 'john@calpoly.edu',
            role: 'student',
            available: 125.50,
            pending: 0,
            locked: 0,
            last_transaction: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            user_id: 'barber-1',
            email: 'marcus@calpoly.edu',
            role: 'barber',
            available: 450.75,
            pending: 150.00,
            locked: 0,
            last_transaction: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            user_id: 'student-2',
            email: 'sarah@ucsb.edu',
            role: 'student',
            available: 50.00,
            pending: 35.00,
            locked: 0,
            last_transaction: new Date(Date.now() - 10800000).toISOString(),
          },
          {
            user_id: 'barber-2',
            email: 'jasmine@calpoly.edu',
            role: 'barber',
            available: 680.00,
            pending: 90.00,
            locked: 0,
            last_transaction: new Date(Date.now() - 14400000).toISOString(),
          },
        ],
        recentTransactions: [
          {
            id: 'tx-1',
            user_id: 'student-1',
            type: 'deposit',
            amount: 100.00,
            status: 'completed',
            description: 'Stripe deposit',
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'tx-2',
            user_id: 'barber-1',
            type: 'payout',
            amount: 150.00,
            status: 'completed',
            description: 'Booking payout - Service completed',
            created_at: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: 'tx-3',
            user_id: 'student-2',
            type: 'hold',
            amount: 35.00,
            status: 'pending',
            description: 'Escrow hold for booking #123',
            created_at: new Date(Date.now() - 10800000).toISOString(),
          },
          {
            id: 'tx-4',
            user_id: 'barber-2',
            type: 'withdrawal',
            amount: 250.00,
            status: 'processing',
            description: 'Bank withdrawal requested',
            created_at: new Date(Date.now() - 14400000).toISOString(),
          },
        ],
        activeEscrows: [
          {
            id: 'escrow-1',
            booking_id: 'booking-123',
            student: 'john@calpoly.edu',
            barber: 'marcus@calpoly.edu',
            amount: 35.00,
            status: 'held',
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            expires_at: new Date(Date.now() + 3600000 * 48).toISOString(),
          },
          {
            id: 'escrow-2',
            booking_id: 'booking-456',
            student: 'sarah@ucsb.edu',
            barber: 'jasmine@calpoly.edu',
            amount: 50.00,
            status: 'held',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
            expires_at: new Date(Date.now() + 3600000 * 43).toISOString(),
          },
          {
            id: 'escrow-3',
            booking_id: 'booking-789',
            student: 'mike@calpoly.edu',
            barber: 'david@ucsb.edu',
            amount: 28.00,
            status: 'held',
            created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
            expires_at: new Date(Date.now() + 3600000 * 36).toISOString(),
          },
        ],
        withdrawalQueue: [
          {
            id: 'withdraw-1',
            user_id: 'barber-1',
            email: 'marcus@calpoly.edu',
            amount: 250.00,
            destination: 'bank',
            status: 'queued',
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'withdraw-2',
            user_id: 'barber-2',
            email: 'jasmine@calpoly.edu',
            amount: 180.00,
            destination: 'onchain',
            status: 'processing',
            created_at: new Date(Date.now() - 7200000).toISOString(),
          },
        ],
      };

      setTreasuryStats(mockTreasury);
      setPlatformFees(mockFees);
      setReconciliationReports(mockReports);
      setBatchStats(mockBatches);
      setAuditLogs(mockLogs);
      setWalletData(mockWallet);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-8 w-8 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Platform management & monitoring</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/')} variant="secondary">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Roles
            </Button>
            <Button onClick={loadInitialData} variant="secondary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'treasury', label: 'Treasury', icon: TrendingUp },
              { key: 'fees', label: 'Platform Fees', icon: DollarSign },
              { key: 'reconciliation', label: 'Reconciliation', icon: CheckCircle },
              { key: 'batches', label: 'Withdrawals', icon: Clock },
              { key: 'wallet', label: 'Custodial Wallet', icon: DollarSign },
              { key: 'users', label: 'Users', icon: Users },
              { key: 'audit', label: 'Audit Logs', icon: AlertCircle },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'treasury' && <TreasurySection stats={treasuryStats} />}
        {activeTab === 'fees' && <FeesSection fees={platformFees} onRefresh={loadInitialData} />}
        {activeTab === 'reconciliation' && <ReconciliationSection reports={reconciliationReports} onRefresh={loadInitialData} />}
        {activeTab === 'batches' && <BatchesSection stats={batchStats} onRefresh={loadInitialData} />}
        {activeTab === 'wallet' && <CustodialWalletSection data={walletData} onRefresh={loadInitialData} />}
        {activeTab === 'users' && <UsersSection />}
        {activeTab === 'audit' && <AuditSection logs={auditLogs} />}
      </div>
    </div>
  );
};

// Treasury Section
const TreasurySection: React.FC<{ stats: TreasuryStats | null }> = ({ stats }) => {
  if (!stats) return <Loading />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total User Balances</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ${stats.total_user_balances_dollars.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Sum of all user wallet balances
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Escrow</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ${stats.total_escrow_dollars.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-full">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Funds held for active bookings
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Platform Fees</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ${stats.total_fees_dollars.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Unwithdrawn platform revenue
        </p>
      </Card>

      <Card className="md:col-span-3">
        <h3 className="text-lg font-semibold mb-4">Platform Health</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Assets Under Management</p>
            <p className="text-2xl font-bold text-indigo-600">
              ${(stats.total_user_balances_dollars + stats.total_escrow_dollars).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Platform Revenue (Lifetime)</p>
            <p className="text-2xl font-bold text-green-600">
              ${stats.total_fees_dollars.toFixed(2)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Fees Section
const FeesSection: React.FC<{ fees: PlatformFees | null; onRefresh: () => void }> = ({ fees, onRefresh }) => {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWithdraw = async () => {
    if (!fees || !withdrawAmount) return;

    const amount = parseFloat(withdrawAmount);
    if (amount > fees.available_fees_dollars) {
      toast.error('Insufficient fees available');
      return;
    }

    setIsProcessing(true);
    try {
      await adminService.withdrawPlatformFees(amount, 'bank', 'platform_stripe_account');
      toast.success(`Successfully withdrew $${amount.toFixed(2)}`);
      setWithdrawAmount('');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!fees) return <Loading />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-6">Fee Summary</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Available for Withdrawal</p>
              <p className="text-3xl font-bold text-green-600">
                ${fees.available_fees_dollars.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {fees.available_count} fee transactions
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-green-600" />
          </div>

          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Already Withdrawn</p>
              <p className="text-2xl font-bold text-gray-700">
                ${fees.withdrawn_fees_dollars.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {fees.withdrawn_count} fee transactions
              </p>
            </div>
            <Download className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Withdraw Fees</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              max={fees.available_fees_dollars}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Max: ${fees.available_fees_dollars.toFixed(2)}
            </p>
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={!withdrawAmount || isProcessing}
            variant="primary"
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Withdraw Fees'}
          </Button>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Fees will be transferred to the platform Stripe account instantly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Reconciliation Section
const ReconciliationSection: React.FC<{ reports: ReconciliationReport[]; onRefresh: () => void }> = ({ reports, onRefresh }) => {
  const [isRunning, setIsRunning] = useState(false);

  const runReconciliation = async () => {
    setIsRunning(true);
    try {
      const report = await adminService.runReconciliation();
      if (report.status === 'discrepancies') {
        toast.error(`Discrepancies found: $${(report.discrepancy_cents / 100).toFixed(2)}`);
      } else {
        toast.success('Reconciliation completed - no discrepancies');
      }
      onRefresh();
    } catch (error) {
      toast.error('Reconciliation failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Daily Reconciliation</h3>
          <Button onClick={runReconciliation} disabled={isRunning} variant="primary">
            {isRunning ? 'Running...' : 'Run Now'}
          </Button>
        </div>

        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-lg border-2 ${
                report.status === 'completed' ? 'border-green-200 bg-green-50' :
                report.status === 'discrepancies' ? 'border-red-200 bg-red-50' :
                'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <p className="font-medium text-gray-900">
                      {new Date(report.report_date).toLocaleDateString()}
                    </p>
                    <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${
                      report.status === 'completed' ? 'bg-green-200 text-green-800' :
                      report.status === 'discrepancies' ? 'bg-red-200 text-red-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Platform Balance</p>
                      <p className="font-semibold">${(report.total_platform_balance_cents / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">User Balances</p>
                      <p className="font-semibold">${(report.total_user_balances_cents / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Escrow</p>
                      <p className="font-semibold">${(report.total_escrow_cents / 100).toFixed(2)}</p>
                    </div>
                  </div>

                  {report.status === 'discrepancies' && (
                    <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-800">
                      <strong>Discrepancy:</strong> ${(report.discrepancy_cents / 100).toFixed(2)}
                      {report.discrepancies && (
                        <ul className="mt-1 list-disc list-inside">
                          {report.discrepancies.slice(0, 3).map((d, idx) => (
                            <li key={idx}>{d.description}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Batches Section
const BatchesSection: React.FC<{ stats: WithdrawalBatchStats | null; onRefresh: () => void }> = ({ stats, onRefresh }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = async () => {
    setIsProcessing(true);
    try {
      await adminService.processBatch('aptos');
      toast.success('Batch processing triggered');
      onRefresh();
    } catch (error) {
      toast.error('Batch processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!stats) return <Loading />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <p className="text-sm text-gray-600">Queued Withdrawals</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{stats.queued_count}</p>
        <p className="text-xs text-gray-500 mt-2">
          ${stats.queued_total_dollars.toFixed(2)} total
        </p>
      </Card>

      <Card>
        <p className="text-sm text-gray-600">Processing</p>
        <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.processing_count}</p>
        <p className="text-xs text-gray-500 mt-2">In current batch</p>
      </Card>

      <Card>
        <p className="text-sm text-gray-600">Completed Today</p>
        <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed_today}</p>
        <p className="text-xs text-gray-500 mt-2">Successfully processed</p>
      </Card>

      <Card>
        <Button
          onClick={processBatch}
          disabled={stats.queued_count === 0 || isProcessing}
          variant="primary"
          className="w-full"
        >
          {isProcessing ? 'Processing...' : 'Process Batch'}
        </Button>
        <p className="text-xs text-gray-500 mt-2">
          Manually trigger batch processing
        </p>
      </Card>
    </div>
  );
};

// Users Section
const UsersSection: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');

  const checkBalance = async () => {
    if (!userId) {
      toast.error('Please enter a user ID');
      return;
    }

    try {
      const bal = await adminService.getUserBalance(userId);
      setBalance(bal);
      toast.success('Balance loaded');
    } catch (error) {
      toast.error('User not found');
      setBalance(null);
    }
  };

  const issueCredit = async () => {
    if (!userId || !creditAmount || !creditDescription) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await adminService.issueCredit(userId, parseFloat(creditAmount), creditDescription);
      toast.success(`Issued $${creditAmount} credit`);
      setCreditAmount('');
      setCreditDescription('');
      checkBalance(); // Refresh balance
    } catch (error) {
      toast.error('Failed to issue credit');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Check User Balance</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user UUID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            />
          </div>

          <Button onClick={checkBalance} variant="secondary" className="w-full">
            Check Balance
          </Button>

          {balance && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold text-blue-600">
                ${balance.available_dollars.toFixed(2)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Pending</p>
                  <p className="font-semibold">${balance.pending_dollars.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total</p>
                  <p className="font-semibold">${balance.total_dollars.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Issue Promotional Credit</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount ($)
            </label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={creditDescription}
              onChange={(e) => setCreditDescription(e.target.value)}
              placeholder="e.g., Welcome bonus, Compensation, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <Button onClick={issueCredit} variant="primary" className="w-full">
            <Gift className="h-4 w-4 mr-2" />
            Issue Credit
          </Button>
        </div>
      </Card>
    </div>
  );
};

// Audit Section
const AuditSection: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Recent Audit Logs</h3>
      
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">{log.action}</span>
                  {log.actor_user_id && (
                    <span className="ml-2 text-xs text-gray-500">
                      by {log.actor_user_id.substring(0, 8)}...
                    </span>
                  )}
                </div>
                {log.object_type && (
                  <p className="text-sm text-gray-600 mt-1">
                    {log.object_type}: {log.object_id}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Custodial Wallet Section
const CustodialWalletSection: React.FC<{ data: any; onRefresh: () => void }> = ({ data, onRefresh }) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'overview' | 'balances' | 'transactions' | 'escrows' | 'withdrawals' | 'live-feed'>('overview');

  if (!data) return <Loading />;

  const subTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'balances', label: 'User Balances' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'escrows', label: 'Escrow Holds' },
    { key: 'withdrawals', label: 'Withdrawal Queue' },
    { key: 'live-feed', label: '🔴 Live Feed' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedSubTab(tab.key as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${selectedSubTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview */}
      {selectedSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{data.overview.total_users}</p>
            <p className="text-xs text-gray-500 mt-2">Active wallet users</p>
          </Card>

          <Card>
            <p className="text-sm text-gray-600">Available Balance</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              ${data.overview.total_available_balance.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Ready to spend</p>
          </Card>

          <Card>
            <p className="text-sm text-gray-600">Pending Balance</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              ${data.overview.total_pending_balance.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">In processing</p>
          </Card>

          <Card>
            <p className="text-sm text-gray-600">Locked Balance</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              ${data.overview.total_locked_balance.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Temporarily locked</p>
          </Card>

          <Card className="md:col-span-2">
            <p className="text-sm text-gray-600">Total Escrow</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              ${data.overview.total_escrow.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {data.overview.active_escrows} active escrow holds
            </p>
          </Card>

          <Card className="md:col-span-2">
            <p className="text-sm text-gray-600">Platform Balance</p>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              ${data.overview.platform_balance.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Platform's own funds</p>
          </Card>

          <Card className="md:col-span-4">
            <h3 className="text-lg font-semibold mb-4">Wallet Health</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Assets</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ${(data.overview.total_available_balance + data.overview.total_pending_balance + data.overview.total_escrow).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Utilization Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {((data.overview.total_escrow / (data.overview.total_available_balance + data.overview.total_escrow)) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Liquidity Available</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${data.overview.total_available_balance.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Platform Master Wallet */}
          <Card className="md:col-span-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Platform Master Wallet (Aptos)</h3>
                <p className="text-sm text-gray-600 mt-1">The custodial wallet's on-chain address</p>
              </div>
              <div className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                {data.platformWallet.network.toUpperCase()}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-2">WALLET ADDRESS</p>
                <div className="bg-white border border-gray-300 rounded-lg p-3 font-mono text-xs break-all">
                  {data.platformWallet.address}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.platformWallet.address);
                      toast.success('Address copied!');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    📋 Copy Address
                  </button>
                  <a
                    href={`https://explorer.aptoslabs.com/account/${data.platformWallet.address}?network=${data.platformWallet.network}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    🔗 View on Explorer
                  </a>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-gray-300 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-1">ON-CHAIN BALANCE</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {data.platformWallet.onchain_balance_apt.toFixed(4)} APT
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    ≈ ${data.platformWallet.onchain_balance_usd.toFixed(2)} USD
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-gray-300 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Total Deposits</p>
                    <p className="text-lg font-bold text-green-600">{data.platformWallet.total_deposits}</p>
                  </div>
                  <div className="bg-white border border-gray-300 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Total Withdrawals</p>
                    <p className="text-lg font-bold text-blue-600">{data.platformWallet.total_withdrawals}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>💡 How it works:</strong> All users share this single platform wallet on Aptos. 
                When users deposit APT, it goes to this address and their internal balance is credited. 
                When they withdraw, APT is sent from this wallet to their external address.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* User Balances */}
      {selectedSubTab === 'balances' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">User Balances</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Available
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Locked
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.userBalances.map((user: any) => (
                  <tr key={user.user_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'barber' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      ${user.available.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-yellow-600">
                      ${user.pending.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      ${user.locked.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.last_transaction).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transactions */}
      {selectedSubTab === 'transactions' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {data.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      tx.type === 'deposit' ? 'bg-green-100 text-green-800' :
                      tx.type === 'payout' ? 'bg-blue-100 text-blue-800' :
                      tx.type === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {tx.type}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mt-2">{tx.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tx.user_id} • {new Date(tx.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    tx.type === 'deposit' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{tx.id}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Escrow Holds */}
      {selectedSubTab === 'escrows' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Active Escrow Holds</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking ID
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Barber
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.activeEscrows.map((escrow: any) => (
                  <tr key={escrow.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {escrow.booking_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {escrow.student}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {escrow.barber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                      ${escrow.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {escrow.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(escrow.expires_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Withdrawal Queue */}
      {selectedSubTab === 'withdrawals' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Withdrawal Queue</h3>
          <div className="space-y-3">
            {data.withdrawalQueue.map((withdrawal: any) => (
              <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{withdrawal.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      withdrawal.destination === 'bank' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {withdrawal.destination}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      withdrawal.status === 'queued' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {withdrawal.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Requested: {new Date(withdrawal.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${withdrawal.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{withdrawal.id}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Live Feed */}
      {selectedSubTab === 'live-feed' && (
        <LiveTransactionFeed />
      )}
    </div>
  );
};

export default AdminPage;
