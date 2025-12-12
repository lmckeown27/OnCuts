/**
 * Admin Gas Wallet Page
 * 
 * Displays gas wallet monitoring and management interface
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fuel, AlertTriangle, TrendingDown, Calendar } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { CampusCutsLogo } from '@assets';
import axios from 'axios';

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

export default function AdminGasWalletPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GasWalletStatus | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
  };

  const handleCheckNow = async () => {
    try {
      await axios.post('http://localhost:3001/api/gas/monitor/check-now');
      await fetchGasWalletData();
    } catch (error) {
      console.error('Failed to trigger gas check:', error);
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
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Gas Wallet Monitor</h1>
            </div>
            <Button onClick={() => navigate('/admin')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

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
                <p className="text-2xl font-bold text-gray-900">{status?.dailyUsage.toFixed(4) || '0'} APT</p>
              </div>
            </div>
          </Card>

          {/* Days Remaining Card */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center gap-4">
              <div className="bg-purple-600 rounded-full p-3">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600 font-semibold">DAYS REMAINING</p>
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
                        style={{ width: `${Math.min((day.usage / 0.1) * 100, 100)}%` }}
                      >
                        <span className="text-xs text-white font-semibold">{day.usage.toFixed(4)} APT</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-32 text-sm text-gray-600 text-right">
                    Balance: {day.balance.toFixed(2)} APT
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No usage history available</p>
          )}
        </Card>

        {/* Actions */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCheckNow}>
              Check Balance Now
            </Button>
            <Button variant="secondary" onClick={() => window.open('https://explorer.aptoslabs.com/account/' + process.env.VITE_GAS_WALLET_ADDRESS, '_blank')}>
              View on Explorer
            </Button>
          </div>
        </Card>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
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

