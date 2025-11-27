/**
 * Admin Page
 * 
 * Platform management dashboard for administrators
 */

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Gift
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
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
  const [activeTab, setActiveTab] = useState<'treasury' | 'fees' | 'reconciliation' | 'batches' | 'users' | 'audit'>('treasury');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [platformFees, setPlatformFees] = useState<PlatformFees | null>(null);
  const [reconciliationReports, setReconciliationReports] = useState<ReconciliationReport[]>([]);
  const [batchStats, setBatchStats] = useState<WithdrawalBatchStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [treasury, fees, reports, batches, logs] = await Promise.all([
        adminService.getTreasuryStats(),
        adminService.getPlatformFees(),
        adminService.getReconciliationReports(10),
        adminService.getWithdrawalBatches(),
        adminService.getAuditLogs(50),
      ]);

      setTreasuryStats(treasury);
      setPlatformFees(fees);
      setReconciliationReports(reports);
      setBatchStats(batches);
      setAuditLogs(logs.logs);
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
          <Button onClick={loadInitialData} variant="secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'treasury', label: 'Treasury', icon: TrendingUp },
              { key: 'fees', label: 'Platform Fees', icon: DollarSign },
              { key: 'reconciliation', label: 'Reconciliation', icon: CheckCircle },
              { key: 'batches', label: 'Withdrawals', icon: Clock },
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

export default AdminPage;
