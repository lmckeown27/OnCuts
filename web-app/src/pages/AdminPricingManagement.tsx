import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Settings,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import { CampusCutsLogo } from '@assets';

type TabType = 'overview' | 'anomalies' | 'config';

export default function AdminPricingManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<any>(null);

  const handleRecompute = async (scope: 'all' | 'campus') => {
    setIsRecomputing(true);
    setRecomputeResult(null);

    // Simulate API call
    setTimeout(() => {
      setRecomputeResult({
        barbersProcessed: scope === 'all' ? 50 : 12,
        pricesUpdated: scope === 'all' ? 200 : 48,
        errorsCount: 0,
        durationMs: 3500,
      });
      setIsRecomputing(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Dynamic Pricing Management</h1>
            </div>
            <Button onClick={() => navigate('/admin')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Overview & Metrics
              </button>
              <button
                onClick={() => setActiveTab('anomalies')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'anomalies'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Anomalies
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'config'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Configuration
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && <OverviewTab onRecompute={handleRecompute} isRecomputing={isRecomputing} recomputeResult={recomputeResult} />}
        {activeTab === 'anomalies' && <AnomaliesTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ onRecompute, isRecomputing, recomputeResult }: any) {
  return (
    <div className="space-y-6">
      {/* Campus Market Metrics */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Campus Market Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              campus: 'Cal Poly SLO',
              msi: 0.72,
              mdi: 0.58,
              activeBarbers: 12,
              avgPrice: 32.50,
            },
            {
              campus: 'UC Santa Barbara',
              msi: 0.78,
              mdi: 0.65,
              activeBarbers: 15,
              avgPrice: 35.20,
            },
            {
              campus: 'UCLA',
              msi: 0.91,
              mdi: 0.72,
              activeBarbers: 28,
              avgPrice: 38.75,
            },
          ].map((campus, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{campus.campus}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">MSI (Market Size):</span>
                  <span className="font-semibold">{campus.msi.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MDI (Demand):</span>
                  <span className="font-semibold">{campus.mdi.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Barbers:</span>
                  <span className="font-semibold">{campus.activeBarbers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Price:</span>
                  <span className="font-semibold text-green-600">${campus.avgPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recompute Actions */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing Recompute</h2>
        <p className="text-sm text-gray-600 mb-4">
          Trigger a manual pricing recompute for all barbers or a specific campus.
          Prices are automatically recomputed daily at 2 AM.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onRecompute('all')}
            disabled={isRecomputing}
            className="flex items-center justify-center gap-2 p-4 border-2 border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 text-indigo-600 ${isRecomputing ? 'animate-spin' : ''}`} />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Recompute All Barbers</p>
              <p className="text-xs text-gray-600">~50 barbers across all campuses</p>
            </div>
          </button>

          <button
            onClick={() => onRecompute('campus')}
            disabled={isRecomputing}
            className="flex items-center justify-center gap-2 p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isRecomputing ? 'animate-spin' : ''}`} />
            <div className="text-left">
              <p className="font-semibold text-gray-900">Recompute Single Campus</p>
              <p className="text-xs text-gray-600">Select a campus to recompute</p>
            </div>
          </button>
        </div>

        {/* Recompute Result */}
        {isRecomputing && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">Recomputing prices...</p>
                <p className="text-sm text-blue-700">This may take a few seconds.</p>
              </div>
            </div>
          </div>
        )}

        {recomputeResult && !isRecomputing && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900 mb-2">Recompute completed successfully!</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-green-700">Barbers Processed</p>
                    <p className="font-bold text-green-900">{recomputeResult.barbersProcessed}</p>
                  </div>
                  <div>
                    <p className="text-green-700">Prices Updated</p>
                    <p className="font-bold text-green-900">{recomputeResult.pricesUpdated}</p>
                  </div>
                  <div>
                    <p className="text-green-700">Errors</p>
                    <p className="font-bold text-green-900">{recomputeResult.errorsCount}</p>
                  </div>
                  <div>
                    <p className="text-green-700">Duration</p>
                    <p className="font-bold text-green-900">{(recomputeResult.durationMs / 1000).toFixed(1)}s</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">Avg Performance</p>
              <p className="text-2xl font-bold text-gray-900">85.2</p>
            </div>
          </div>
          <p className="text-xs text-green-600">+2.3 points from last week</p>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Avg Price</p>
              <p className="text-2xl font-bold text-gray-900">$35.48</p>
            </div>
          </div>
          <p className="text-xs text-green-600">+$1.20 from last month</p>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Last Recompute</p>
              <p className="text-sm font-bold text-gray-900">2 hours ago</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">Daily at 2:00 AM</p>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Open Anomalies</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
          </div>
          <p className="text-xs text-red-600">Requires review</p>
        </Card>
      </div>
    </div>
  );
}

// Anomalies Tab
function AnomaliesTab() {
  const anomalies = [
    {
      id: 1,
      barberId: 'barber-1',
      barberName: 'Marcus Thompson',
      campus: 'Cal Poly SLO',
      service: 'Haircut',
      anomalyType: 'large_increase',
      severity: 'medium',
      oldPrice: 30.00,
      newPrice: 36.50,
      priceChangePct: 21.7,
      description: 'Price increased by 21.7%',
      status: 'open',
      createdAt: '2024-11-27',
    },
    {
      id: 2,
      barberId: 'barber-3',
      barberName: 'Alex Chen',
      campus: 'Cal Poly SLO',
      service: 'Haircut & Fade',
      anomalyType: 'shock_cap_hit',
      severity: 'high',
      oldPrice: 25.00,
      newPrice: 32.50,
      priceChangePct: 30.0,
      description: 'Price change capped at shock_protection_increase',
      status: 'open',
      createdAt: '2024-11-27',
    },
    {
      id: 3,
      barberId: 'barber-5',
      barberName: 'Sarah Johnson',
      campus: 'UC Santa Barbara',
      service: 'Haircut',
      anomalyType: 'large_decrease',
      severity: 'low',
      oldPrice: 38.00,
      newPrice: 32.00,
      priceChangePct: -15.8,
      description: 'Price decreased by 15.8%',
      status: 'open',
      createdAt: '2024-11-26',
    },
  ];

  const getSeverityBadge = (severity: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Price Anomalies</h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
              {anomalies.filter(a => a.severity === 'high').length} High
            </span>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
              {anomalies.filter(a => a.severity === 'medium').length} Medium
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {anomalies.filter(a => a.severity === 'low').length} Low
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Anomalies are automatically detected when prices change significantly or hit shock protection caps.
          Review and resolve these to ensure pricing is functioning correctly.
        </p>

        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <div key={anomaly.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{anomaly.barberName}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityBadge(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{anomaly.campus} · {anomaly.service}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Price Change</p>
                  <p className={`text-xl font-bold ${anomaly.priceChangePct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {anomaly.priceChangePct > 0 ? '+' : ''}{anomaly.priceChangePct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-600">Old Price</p>
                  <p className="font-semibold text-gray-900">${anomaly.oldPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">New Price</p>
                  <p className="font-semibold text-gray-900">${anomaly.newPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Change</p>
                  <p className={`font-semibold ${anomaly.priceChangePct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(anomaly.newPrice - anomaly.oldPrice).toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-3">{anomaly.description}</p>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Detected on {anomaly.createdAt}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary">Review</Button>
                  <Button size="sm">Resolve</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Config Tab
function ConfigTab() {
  const [config, setConfig] = useState({
    qualityWeight: 0.70,
    reliabilityWeight: 0.20,
    demandWeight: 0.10,
    maxDailyPriceChangePct: 30.00,
    minPriceChangeThresholdPct: 1.00,
    newBarberBookingThreshold: 5,
  });

  const handleSave = () => {
    alert('Configuration saved! (Mock mode - no actual changes)');
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Pricing Configuration</h2>
        <p className="text-sm text-gray-600 mb-6">
          Adjust the weights and parameters that control how performance scores are calculated and how prices are adjusted.
        </p>

        <div className="space-y-6">
          {/* Score Weights */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Performance Score Weights</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Weight ({(config.qualityWeight * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.qualityWeight * 100}
                  onChange={(e) => setConfig({ ...config, qualityWeight: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Based on average rating and repeat customer rate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reliability Weight ({(config.reliabilityWeight * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.reliabilityWeight * 100}
                  onChange={(e) => setConfig({ ...config, reliabilityWeight: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Based on on-time percentage and no-show rate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Demand Weight ({(config.demandWeight * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.demandWeight * 100}
                  onChange={(e) => setConfig({ ...config, demandWeight: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Based on booking volume relative to campus peers</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium text-gray-900 mb-1">Total: {((config.qualityWeight + config.reliabilityWeight + config.demandWeight) * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-600">Weights must sum to 100%</p>
              </div>
            </div>
          </div>

          {/* Shock Protection */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Shock Protection</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Daily Price Change: {config.maxDailyPriceChangePct.toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={config.maxDailyPriceChangePct}
                  onChange={(e) => setConfig({ ...config, maxDailyPriceChangePct: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum price change allowed in a single day</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Price Change Threshold: {config.minPriceChangeThresholdPct.toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={config.minPriceChangeThresholdPct}
                  onChange={(e) => setConfig({ ...config, minPriceChangeThresholdPct: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Ignore changes smaller than this to prevent noise</p>
              </div>
            </div>
          </div>

          {/* New Barber Policy */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">New Barber Policy</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking Threshold: {config.newBarberBookingThreshold} bookings
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={config.newBarberBookingThreshold}
                onChange={(e) => setConfig({ ...config, newBarberBookingThreshold: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Barbers with fewer bookings are considered "new" and receive base pricing</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

