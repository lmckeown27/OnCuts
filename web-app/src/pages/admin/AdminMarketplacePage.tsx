// @ts-nocheck
/**
 * Admin Marketplace Controls
 * 
 * Manage capitalistic marketplace engine:
 * - View/edit market configs
 * - Adjust market factors
 * - View barber rankings
 * - Trigger cron jobs
 * - View cron history
 * - Enable/disable surge pricing
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Zap, BarChart3, RefreshCw } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import AdminHeader from '../../components/AdminHeader';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Market {
  marketId: string;
  name: string;
  city: string;
  state: string;
  basePrice: number;
  averagePrice: number;
  premiumPriceCeiling: number;
  demandNormalizationFactor: number;
  reviewWeightAdjustment: number;
  competitionIntensityScore: number;
  activeBarbers: number;
}

interface CronJob {
  id: string;
  job_name: string;
  executed_at: string;
  status: string;
  duration_ms: number;
  records_processed: number;
  error_message?: string;
}

export default function AdminMarketplacePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [cronHistory, setCronHistory] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [marketsRes, cronRes] = await Promise.all([
        axios.get('http://localhost:3001/api/marketplace/admin/markets'),
        axios.get('http://localhost:3001/api/marketplace/admin/cron-history?limit=20'),
      ]);

      setMarkets(marketsRes.data.markets || []);
      setCronHistory(cronRes.data.history || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch marketplace data:', error);
      setLoading(false);
    }
  };

  const triggerJob = async (jobName: string) => {
    setTriggering(jobName);
    try {
      await axios.post(`http://localhost:3001/api/marketplace/cron/${jobName}`);
      toast.success(`${jobName} triggered successfully!`);
      
      // Refresh cron history after a delay
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error(`Failed to trigger ${jobName}:`, error);
      toast.error(`Failed to trigger ${jobName}`);
    } finally {
      setTriggering(null);
    }
  };

  const handleUpdateMarket = async (marketId: string, config: any, factors: any) => {
    try {
      await axios.post('http://localhost:3001/api/marketplace/admin/markets/update', {
        market_id: marketId,
        config,
        factors,
      });

      toast.success('Market updated successfully!');
      await fetchData();
      setSelectedMarket(null);
    } catch (error) {
      console.error('Failed to update market:', error);
      toast.error('Failed to update market');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading marketplace data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="Marketplace Engine" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Control Panel */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Cron Job Controls</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={() => triggerJob('recompute_bqs')}
              disabled={triggering !== null}
              className="flex items-center justify-center"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {triggering === 'recompute_bqs' ? 'Running...' : 'Recompute BQS'}
            </Button>

            <Button
              onClick={() => triggerJob('update_prices')}
              disabled={triggering !== null}
              className="flex items-center justify-center"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              {triggering === 'update_prices' ? 'Running...' : 'Update Prices'}
            </Button>

            <Button
              onClick={() => triggerJob('refresh_rankings')}
              disabled={triggering !== null}
              className="flex items-center justify-center"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {triggering === 'refresh_rankings' ? 'Running...' : 'Refresh Rankings'}
            </Button>

            <Button
              onClick={() => triggerJob('surge_detection')}
              disabled={triggering !== null}
              className="flex items-center justify-center"
            >
              <Zap className="w-4 h-4 mr-2" />
              {triggering === 'surge_detection' ? 'Running...' : 'Surge Detection'}
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            These jobs run automatically (BQS/Pricing/Rankings: 2am daily, Surge: every 15 min). 
            Manual triggers are for testing/immediate updates.
          </p>
        </Card>

        {/* Markets */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Markets</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Market</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Base Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avg Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Premium Ceiling</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Competition</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Barbers</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {markets.map(market => (
                  <tr key={market.marketId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{market.name}</p>
                        <p className="text-xs text-gray-500">{market.city}, {market.state}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">${market.basePrice}</td>
                    <td className="px-4 py-3 text-gray-900">${market.averagePrice}</td>
                    <td className="px-4 py-3 text-gray-900">${market.premiumPriceCeiling}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        market.competitionIntensityScore >= 1.5 ? 'bg-red-100 text-red-800' :
                        market.competitionIntensityScore >= 1.0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {market.competitionIntensityScore}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{market.activeBarbers}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedMarket(market)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Cron History */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Cron Job History</h3>
            <Button size="sm" variant="secondary" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Executed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Records</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cronHistory.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{job.job_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        job.status === 'success' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(job.executed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {job.duration_ms ? `${job.duration_ms}ms` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {job.records_processed || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Market Editor Modal */}
        {selectedMarket && (
          <div 
            className="fixed inset-0 min-h-[100dvh] bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMarket(null)}
          >
            <Card 
              className="w-full max-w-2xl max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Market: {selectedMarket.name}</h3>

              <div className="space-y-6">
                {/* Pricing Config */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Pricing Configuration</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={selectedMarket.basePrice}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="basePrice"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Average Price</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={selectedMarket.averagePrice}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="averagePrice"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Premium Ceiling</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={selectedMarket.premiumPriceCeiling}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="premiumCeiling"
                      />
                    </div>
                  </div>
                </div>

                {/* Market Factors */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Market Factors</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Demand Normalization</label>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={selectedMarket.demandNormalizationFactor}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="demandFactor"
                      />
                      <p className="text-xs text-gray-500 mt-1">0.8-1.3 range</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Review Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={selectedMarket.reviewWeightAdjustment}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="reviewWeight"
                      />
                      <p className="text-xs text-gray-500 mt-1">0.9-1.2 range</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Competition Intensity</label>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={selectedMarket.competitionIntensityScore}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        id="competitionIntensity"
                      />
                      <p className="text-xs text-gray-500 mt-1">0.7-1.5 range</p>
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Market Factors:</strong> Large markets (LA) have higher competition intensity (1.3-1.5), 
                    making BQS differences more dramatic. Small markets (SLO) have lower intensity (0.7-0.8), 
                    compressing score differences.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => setSelectedMarket(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const config = {
                        basePrice: parseFloat((document.getElementById('basePrice') as HTMLInputElement).value),
                        averagePrice: parseFloat((document.getElementById('averagePrice') as HTMLInputElement).value),
                        premiumPriceCeiling: parseFloat((document.getElementById('premiumCeiling') as HTMLInputElement).value),
                      };
                      const factors = {
                        demandNormalizationFactor: parseFloat((document.getElementById('demandFactor') as HTMLInputElement).value),
                        reviewWeightAdjustment: parseFloat((document.getElementById('reviewWeight') as HTMLInputElement).value),
                        competitionIntensityScore: parseFloat((document.getElementById('competitionIntensity') as HTMLInputElement).value),
                      };
                      handleUpdateMarket(selectedMarket.marketId, config, factors);
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-gradient-to-br from-primary-50 to-primary-100">
            <h4 className="font-bold text-gray-900 mb-2">BQS Formula</h4>
            <p className="text-sm text-gray-700 font-mono">
              BQS = 0.45×R + 0.25×D + 0.15×P + 0.15×L
            </p>
            <p className="text-xs text-gray-600 mt-2">
              R=Reviews, D=Demand, P=Price Justification, L=Loyalty
            </p>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <h4 className="font-bold text-gray-900 mb-2">Pricing Multipliers</h4>
            <div className="text-xs text-gray-700 space-y-1">
              <p>BQS &lt; 60: 1.0x</p>
              <p>BQS 60-80: 1.1x</p>
              <p>BQS 80-90: 1.25x</p>
              <p>BQS 90-100: 1.5x</p>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <h4 className="font-bold text-gray-900 mb-2">Surge Pricing</h4>
            <div className="text-xs text-gray-700 space-y-1">
              <p>Ratio 2.0-3.0: 1.2x</p>
              <p>Ratio 3.0-4.0: 1.3x</p>
              <p>Ratio 4.0+: 1.4x</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

