/**
 * Gas Wallet Monitor Component
 * 
 * Displays gas wallet status, usage stats, and alert history
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  Bell,
} from 'lucide-react';
import Card from './Card';
import Button from './Button';

interface GasWalletStatus {
  address: string;
  balance: number;
  status: 'critical' | 'warning' | 'healthy';
  lastChecked: string;
  estimatedDaysRemaining: number;
}

interface Alert {
  level: 'critical' | 'warning';
  balance: number;
  timestamp: string;
  alertsSent: string[];
}

interface DashboardData {
  gasWallet: GasWalletStatus;
  usage: {
    daily: Record<string, number>;
    total: number;
    average: number;
    daysTracked: number;
  };
  alerts: {
    recent: Alert[];
    count: number;
  };
  monitoring: {
    jobCount: number;
    running: boolean;
  };
}

export default function GasWalletMonitor() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/gas/monitor/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setData(result.dashboard);
      }
    } catch (error) {
      console.error('Error fetching gas wallet data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
          <span className="ml-2 text-gray-600">Loading gas wallet data...</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <div className="text-center p-8 text-gray-600">
          Failed to load gas wallet data
        </div>
      </Card>
    );
  }

  const { gasWallet, usage, alerts, monitoring } = data;

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary-400" />
            Gas Wallet Monitor
          </h2>
          <p className="text-gray-600 mt-1">
            Automated monitoring with alerts when balance is low
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Current Status */}
      <Card className={`border-2 ${getStatusColor(gasWallet.status)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-lg">
              {getStatusIcon(gasWallet.status)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-gray-900">Current Balance</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(gasWallet.status)}`}>
                  {gasWallet.status}
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {gasWallet.balance.toFixed(2)} APT
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Last checked: {formatDate(gasWallet.lastChecked)}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Estimated Days Remaining</p>
            <p className="text-3xl font-bold text-gray-900">
              {gasWallet.estimatedDaysRemaining}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Based on avg daily usage
            </p>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-600 mb-1">Wallet Address</p>
          <p className="font-mono text-sm text-gray-900 break-all">
            {gasWallet.address}
          </p>
        </div>

        {/* Warning Messages */}
        {gasWallet.status === 'critical' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-900">
              IMMEDIATE ACTION REQUIRED: Gas wallet nearly empty!
            </p>
            <p className="text-xs text-red-700 mt-1">
              Connect your admin wallet and transfer APT to prevent service disruption.
            </p>
          </div>
        )}
        
        {gasWallet.status === 'warning' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-semibold text-yellow-900">
              WARNING: Gas wallet running low
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Please fund the gas wallet soon to ensure uninterrupted service.
            </p>
          </div>
        )}
      </Card>

      {/* Usage Statistics */}
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-400" />
          Usage Statistics
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{usage.total.toFixed(2)}</p>
            <p className="text-xs text-gray-600 mt-1">Total Used (APT)</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{usage.average.toFixed(2)}</p>
            <p className="text-xs text-gray-600 mt-1">Daily Average (APT)</p>
          </div>
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{usage.daysTracked}</p>
            <p className="text-xs text-gray-600 mt-1">Days Tracked</p>
          </div>
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {monitoring.running ? 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-gray-600 mt-1">Monitoring Status</p>
          </div>
        </div>

        {/* Daily Usage Chart (Simple) */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">Recent Daily Usage</p>
          {Object.entries(usage.daily)
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .slice(0, 7)
            .map(([date, amount]) => {
              const percentage = usage.average > 0 ? (amount / usage.average) * 50 : 0;
              return (
                <div key={date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20">{date}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-primary-400 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {amount.toFixed(2)} APT
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Alert History */}
      {alerts.recent.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-400" />
            Recent Alerts ({alerts.count})
          </h3>
          
          <div className="space-y-3">
            {alerts.recent.map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border-2 ${
                  alert.level === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          alert.level === 'critical' ? 'text-red-600' : 'text-yellow-600'
                        }`}
                      />
                      <span className="font-semibold text-gray-900 uppercase text-sm">
                        {alert.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Balance dropped to <strong>{alert.balance.toFixed(2)} APT</strong>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDate(alert.timestamp)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 mb-1">Alerts Sent</p>
                    <div className="flex gap-1">
                      {alert.alertsSent.map(method => (
                        <span
                          key={method}
                          className="px-2 py-1 bg-white text-xs font-medium rounded border"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Monitoring Info */}
      <Card className="bg-gradient-to-br from-primary-50 to-primary-50 border-2 border-primary-200">
        <div className="flex items-start gap-4">
          <div className="bg-primary-100 rounded-full p-3">
            <CheckCircle className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Automated Monitoring Active
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>Checks balance every 15 minutes</li>
              <li>Sends email + Slack alerts when balance is low</li>
              <li>Tracks daily usage for trend analysis</li>
              <li>Estimates days remaining based on usage patterns</li>
              <li>Alert cooldown: 6 hours (prevents spam)</li>
            </ul>
            <div className="mt-3 p-2 bg-white rounded border">
              <p className="text-xs text-gray-600">
                <strong>Thresholds:</strong> Critical &lt; 10 APT | Warning &lt; 50 APT | Healthy ≥ 100 APT
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

