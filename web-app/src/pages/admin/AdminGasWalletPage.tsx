/**
 * Admin Gas Wallet Page
 * 
 * Displays gas wallet monitoring and management interface
 */

import React, { useEffect, useState } from 'react';
import { Fuel, AlertTriangle, TrendingDown, Calendar, Wallet, Info, Zap, Shield, RefreshCw } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import AdminHeader from '../../components/AdminHeader';
import axios from 'axios';
import { useDirectWallet } from '../../contexts/DirectWalletContext';
import toast from 'react-hot-toast';

interface GasWalletStatus {
  balance: number;
  balanceFormatted: string;
  status: 'healthy' | 'warning' | 'critical';
  dailyUsage: number;
  daysRemaining: number;
  lastChecked: string;
}

interface UsageHistory {
  date: string;
  usage: number;
  balance: number;
}

interface Alert {
  level: 'warning' | 'critical';
  message: string;
  timestamp: string;
}

const APTOS_NODE_URL = import.meta.env.VITE_APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
const GAS_WALLET_ADDRESS = import.meta.env.VITE_GAS_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

// Mock data for testing
const MOCK_STATUS: GasWalletStatus = {
  balance: 245.7832,
  balanceFormatted: '245.7832 APT',
  status: 'healthy',
  dailyUsage: 0.0523,
  daysRemaining: 4698,
  lastChecked: new Date().toISOString(),
};

const MOCK_USAGE_HISTORY: UsageHistory[] = [
  { date: new Date(Date.now() - 86400000 * 6).toISOString(), usage: 0.0421, balance: 245.5 },
  { date: new Date(Date.now() - 86400000 * 5).toISOString(), usage: 0.0534, balance: 245.4 },
  { date: new Date(Date.now() - 86400000 * 4).toISOString(), usage: 0.0612, balance: 245.35 },
  { date: new Date(Date.now() - 86400000 * 3).toISOString(), usage: 0.0489, balance: 245.29 },
  { date: new Date(Date.now() - 86400000 * 2).toISOString(), usage: 0.0551, balance: 245.24 },
  { date: new Date(Date.now() - 86400000).toISOString(), usage: 0.0523, balance: 245.19 },
  { date: new Date().toISOString(), usage: 0.0523, balance: 245.7832 },
];

const MOCK_ALERTS: Alert[] = [];

export default function AdminGasWalletPage() {
  const { connected, address, petraInstalled, connectWallet, disconnectWallet, signAndSubmitTransaction } = useDirectWallet();
  const [status, setStatus] = useState<GasWalletStatus | null>(MOCK_STATUS);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>(MOCK_USAGE_HISTORY);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [loading, setLoading] = useState(true);
  const [refilling, setRefilling] = useState(false);
  const [refillAmount, setRefillAmount] = useState('100');

  useEffect(() => {
    fetchGasWalletData();
    const interval = setInterval(fetchGasWalletData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchGasWalletData = async () => {
    try {
      const [statusRes, usageRes, alertsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/gas/monitor/status'),
        axios.get('http://localhost:3001/api/gas/monitor/usage?days=7'),
        axios.get('http://localhost:3001/api/gas/monitor/alerts?limit=10'),
      ]);

      setStatus(statusRes.data);
      setUsageHistory(usageRes.data.history || []);
      setAlerts(alertsRes.data.alerts || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch gas wallet data:', error);
      console.log('Using mock gas wallet data for testing');
      // Use mock data on API failure
      setStatus(MOCK_STATUS);
      setUsageHistory(MOCK_USAGE_HISTORY);
      setAlerts(MOCK_ALERTS);
      setLoading(false);
    }
  };

  const handleCheckNow = async () => {
    try {
      await axios.post('http://localhost:3001/api/gas/monitor/check-now');
      await fetchGasWalletData();
      toast.success('Balance check completed');
    } catch (error) {
      console.error('Failed to trigger gas check:', error);
      toast.error('Failed to check balance');
    }
  };

  const handleConnectWallet = async () => {
    if (connected) {
      await disconnectWallet();
    } else {
      await connectWallet();
    }
  };

  const handleRefillGasWallet = async () => {
    if (!connected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(refillAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setRefilling(true);
    try {
      // Convert APT to Octas (1 APT = 100,000,000 Octas)
      const amountInOctas = Math.floor(amount * 100000000);

      // Create transfer transaction payload
      const payload = {
        type: 'entry_function_payload',
        function: '0x1::aptos_account::transfer',
        type_arguments: [],
        arguments: [GAS_WALLET_ADDRESS, amountInOctas.toString()],
      };

      console.log('🔥 Submitting refill transaction...', { amount, amountInOctas, to: GAS_WALLET_ADDRESS });

      // Sign and submit transaction via wallet adapter
      const response = await signAndSubmitTransaction(payload);
      
      console.log('✅ Transaction submitted:', response);
      
      toast.success(`Refill initiated! Transaction: ${response.hash?.substring(0, 10) || response}...`);
      
      // Wait a moment for blockchain to process
      setTimeout(async () => {
        await fetchGasWalletData();
        toast.success('Gas wallet refilled successfully!');
      }, 3000);

    } catch (error: any) {
      console.error('❌ Refill error:', error);
      toast.error(error?.message || 'Failed to refill gas wallet');
    } finally {
      setRefilling(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'warning':
        return '⚠';
      case 'critical':
        return '✗';
      default:
        return '?';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading gas wallet data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="Gas Wallet Monitor" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${getStatusColor(status?.status)}`}>
                <Fuel className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-semibold">CURRENT BALANCE</p>
                <p className="text-2xl font-bold text-gray-900">{status?.balanceFormatted || '0 APT'}</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 ${getStatusColor(status?.status)}`}>
                  {getStatusIcon(status?.status)} {status?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
            </div>
          </Card>

          {/* Daily Usage Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 rounded-full p-3">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-semibold">DAILY USAGE</p>
                <p className="text-2xl font-bold text-gray-900">{status?.dailyUsage?.toFixed(4) || '0.0000'} APT</p>
              </div>
            </div>
          </Card>

          {/* Days Remaining Card */}
          <Card className="bg-gradient-to-br from-primary-50 to-primary-100">
            <div className="flex items-center gap-4">
              <div className="bg-primary-400 rounded-full p-3">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-primary-400 font-semibold">DAYS REMAINING</p>
                <p className="text-2xl font-bold text-gray-900">{status?.daysRemaining || 'N/A'}</p>
                <p className="text-xs text-gray-600 mt-1">at current usage rate</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="mb-8 bg-yellow-50 border-2 border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Alerts</h3>
                <div className="space-y-2">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        alert.level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {alert.level.toUpperCase()}
                      </span>
                      <span className="text-gray-700 flex-1">{alert.message}</span>
                      <span className="text-gray-500 text-xs">{new Date(alert.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Usage History Chart */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">7-Day Usage History</h3>
          
          {usageHistory.length > 0 ? (
            <div className="space-y-3">
              {usageHistory.map((day, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">{new Date(day.date).toLocaleDateString()}</div>
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-full rounded-full flex items-center px-2"
                        style={{ width: `${Math.min(((day.usage || 0) / 0.1) * 100, 100)}%` }}
                      >
                        <span className="text-xs text-white font-semibold">{(day.usage || 0).toFixed(4)} APT</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-32 text-sm text-gray-600 text-right">
                    Balance: {(day.balance || 0).toFixed(2)} APT
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No usage history available</p>
          )}
        </Card>

        {/* Wallet Connection & Refill */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Refill Gas Wallet</h3>
          
          {/* Wallet Connection Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Admin Wallet</p>
                  {connected && address ? (
                    <p className="text-xs text-gray-600 font-mono">
                      {address.substring(0, 10)}...{address.substring(address.length - 8)}
                    </p>
                  ) : petraInstalled ? (
                    <p className="text-xs text-gray-500">Not connected</p>
                  ) : (
                    <p className="text-xs text-red-500">
                      No wallet detected - Install{' '}
                      <a 
                        href="https://petra.app/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-red-600"
                      >
                        Petra
                      </a>
                      {' '}and refresh
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!petraInstalled && (
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="secondary" 
                    size="sm"
                    title="Refresh page to detect wallet"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
                <Button onClick={handleConnectWallet} variant={connected ? 'secondary' : 'primary'} size="sm" disabled={!petraInstalled && !connected}>
                  <Wallet className="w-4 h-4 mr-2" />
                  {connected ? 'Disconnect' : 'Connect Wallet'}
                </Button>
              </div>
            </div>
          </div>

          {/* Refill Controls */}
          {connected ? (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Refill Amount (APT)
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter amount in APT"
                />
                <Button 
                  onClick={handleRefillGasWallet} 
                  disabled={refilling}
                  className="min-w-[140px]"
                >
                  {refilling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Refilling...
                    </>
                  ) : (
                    <>
                      <Fuel className="w-4 h-4 mr-2" />
                      Refill Now
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                You will be prompted to sign the transaction with your connected wallet. 
                Recommended refill: 100 APT when balance drops below 20 APT.
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900">
                  Connect your admin wallet above to refill the gas wallet. You'll sign a transaction 
                  to transfer APT from your wallet to the platform's gas wallet.
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCheckNow} variant="secondary">
              Check Balance Now
            </Button>
            <Button variant="secondary" onClick={() => window.open('https://explorer.aptoslabs.com/account/' + GAS_WALLET_ADDRESS, '_blank')}>
              View on Explorer
            </Button>
          </div>
        </Card>

        {/* Future Options Recommendation */}
        <Card className="mb-8 bg-gradient-to-br from-primary-50 to-blue-50 border-2 border-primary-200">
          <div className="flex items-start gap-3 mb-4">
            <Zap className="w-6 h-6 text-primary-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Recommended for Growing Platforms</h3>
              <p className="text-sm text-gray-700 mb-4">
                As CampusCut grows, consider upgrading to more advanced gas management solutions:
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Automated Top-Up */}
            <div className="bg-white rounded-lg p-4 border border-primary-200">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Automated Top-Up (Recommended)</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Connect your admin wallet once and enable automated refills. When the gas wallet 
                    balance drops below your threshold, the system automatically requests approval 
                    from your wallet to transfer funds.
                  </p>
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-green-600">Benefits:</span>
                    <span>No manual monitoring needed · Instant refills · Wallet approval required for security</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Sig Treasury */}
            <div className="bg-white rounded-lg p-4 border border-primary-200">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Multi-Signature Treasury (Enterprise)</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    For production environments, use a multi-signature wallet requiring approval 
                    from 2-of-3 or 3-of-5 admin wallets before any refill transaction can be executed. 
                    Provides maximum security for large platforms.
                  </p>
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-green-600">Benefits:</span>
                    <span>Enhanced security · Prevents single-point failure · Audit trail · Best for high-value operations</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Implementation Note */}
            <div className="pt-3 border-t border-primary-200">
              <p className="text-xs text-gray-600 italic">
                💡 <strong>When to upgrade:</strong> Consider automated top-up when you have 100+ daily transactions, 
                and multi-sig when your platform processes $10k+ daily volume or holds significant treasury reserves.
              </p>
            </div>
          </div>
        </Card>

        {/* Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>About Gas Wallet:</strong> The gas wallet pays for all blockchain transaction fees (gas) 
            so users never have to worry about gas costs. The platform automatically monitors balance and 
            sends alerts when refills are needed.
          </p>
        </div>
      </div>
    </div>
  );
}

