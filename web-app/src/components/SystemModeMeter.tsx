/**
 * System Mode Meter
 * 
 * Visual gauge showing whether system is running in:
 * - Hybrid mode (PostgreSQL + Blockchain)
 * - Blockchain-only mode (PostgreSQL down)
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SystemHealth {
  mode: 'hybrid' | 'blockchain-only' | 'unknown';
  postgres: {
    status: string;
    healthy: boolean;
  };
  blockchain: {
    status: string;
    healthy: boolean;
  };
  timestamp: string;
}

// Mock data for testing
const MOCK_HEALTH: SystemHealth = {
  mode: 'blockchain-only',
  postgres: {
    status: 'disconnected',
    healthy: false,
  },
  blockchain: {
    status: 'connected',
    healthy: true,
  },
  timestamp: new Date().toISOString(),
};

export const SystemModeMeter: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(MOCK_HEALTH);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/system/health');
      // Validate response data has required structure
      if (response.data && response.data.postgres && response.data.blockchain) {
        setHealth(response.data);
      } else {
        console.warn('Invalid health response, using mock data');
        setHealth(MOCK_HEALTH);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      console.log('Using mock system health data for testing');
      // Use mock data on API failure
      setHealth(MOCK_HEALTH);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Mode</h3>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Safety check - ensure health has valid data
  if (!health || !health.postgres || !health.blockchain) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Mode</h3>
        <div className="text-red-500">Unable to load system health data</div>
      </div>
    );
  }

  const isHybrid = health.mode === 'hybrid';
  const meterPosition = isHybrid ? '10%' : '90%'; // Left for hybrid, right for blockchain-only

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
        <span>System Mode</span>
        <span
          className={`text-sm font-normal px-3 py-1 rounded-full ${
            isHybrid
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {isHybrid ? 'Hybrid Mode' : 'Blockchain Only'}
        </span>
      </h3>

      {/* Meter Container */}
      <div className="relative">
        {/* Meter Track */}
        <div className="h-12 bg-gradient-to-r from-green-100 via-yellow-100 to-orange-100 rounded-lg relative overflow-hidden">
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-medium">
            <span className="text-green-800">Hybrid</span>
            <span className="text-orange-800">Blockchain Only</span>
          </div>

          {/* Meter Indicator */}
          <div
            className="absolute top-0 h-full w-2 bg-gray-800 shadow-lg transition-all duration-500"
            style={{ left: meterPosition }}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gray-800 rounded-full" />
          </div>
        </div>

        {/* Status Details */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* PostgreSQL Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                health.postgres.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <div>
              <div className="text-sm font-medium">PostgreSQL</div>
              <div className="text-xs text-gray-500">
                {health.postgres.healthy ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>

          {/* Blockchain Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                health.blockchain.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <div>
              <div className="text-sm font-medium">Blockchain</div>
              <div className="text-xs text-gray-500">
                {health.blockchain.healthy ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Info */}
        <div
          className={`mt-4 p-3 rounded-lg ${
            isHybrid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <div className="flex items-start space-x-2">
            <svg
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                isHybrid ? 'text-green-600' : 'text-yellow-600'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isHybrid ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              )}
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {isHybrid ? 'Optimal Performance' : 'Degraded Performance'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {isHybrid
                  ? 'Fast queries using PostgreSQL cache with blockchain as source of truth'
                  : 'Using blockchain fallback - queries may be slower. Consider fixing PostgreSQL for better performance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-3 text-xs text-gray-400 text-right">
          Last checked: {new Date(health.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default SystemModeMeter;

