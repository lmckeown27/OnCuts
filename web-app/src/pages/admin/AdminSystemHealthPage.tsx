/**
 * Admin System Health Page
 * 
 * Displays system health meter and detailed status information
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/Button';
import SystemModeMeter from '../../components/SystemModeMeter';
import { CampusCutsLogo } from '@assets';

export default function AdminSystemHealthPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
            </div>
            <Button onClick={() => navigate('/admin')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Infrastructure Status</h2>
          <p className="text-gray-600">
            Monitor system operational mode and database connectivity
          </p>
        </div>

        {/* System Mode Meter */}
        <div className="mb-8">
          <SystemModeMeter />
        </div>

        {/* Architecture Explanation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Architecture Overview</h3>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Hybrid Mode (Optimal)</h4>
              <p className="mb-2">When PostgreSQL is connected, the system operates in hybrid mode:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
                <li>PostgreSQL acts as a performance cache</li>
                <li>Fast queries (~5ms response time)</li>
                <li>Blockchain remains the source of truth</li>
                <li>Data synced hourly from blockchain to PostgreSQL</li>
                <li>Analytics and reporting are fast</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Blockchain-Only Mode (Fallback)</h4>
              <p className="mb-2">When PostgreSQL is unavailable, the system automatically falls back:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
                <li>All queries go directly to the Aptos blockchain</li>
                <li>Slower queries (~100-500ms response time)</li>
                <li>No analytics or cached data</li>
                <li>App continues to function normally</li>
                <li>Users experience slightly slower page loads</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Why Hybrid Architecture?</h4>
              <p className="text-gray-600">
                The blockchain provides immutability and decentralization, while PostgreSQL provides 
                performance and analytics. This hybrid approach gives you the best of both worlds: 
                blockchain security with traditional database speed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

