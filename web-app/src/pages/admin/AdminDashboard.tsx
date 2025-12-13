/**
 * Admin Dashboard
 * 
 * Central hub for platform administration:
 * - Wallet connection & gas management
 * - Platform statistics
 * - Dispute resolution
 * - Fee withdrawals
 */

import React, { useState, useEffect } from 'react';
import AdminWalletConnect from '../../components/AdminWalletConnect';
import GasWalletMonitor from '../../components/GasWalletMonitor';

interface PlatformStats {
  total_users: number;
  total_barbers: number;
  total_students: number;
  total_bookings: number;
  total_completed: number;
  total_volume_apt: number;
  platform_fees_accumulated: number;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    try {
      // Query blockchain for platform stats
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json();
      
      // Mock stats for now (TODO: implement blockchain queries)
      setStats({
        total_users: data.stats?.total_users || 0,
        total_barbers: Math.floor((data.stats?.total_users || 0) * 0.3),
        total_students: Math.floor((data.stats?.total_users || 0) * 0.7),
        total_bookings: data.stats?.total_bookings || 0,
        total_completed: Math.floor((data.stats?.total_bookings || 0) * 0.85),
        total_volume_apt: 1250.45,
        platform_fees_accumulated: 62.52,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage platform operations, gas wallet, and resolve disputes
          </p>
        </div>

        {/* Platform Stats */}
        {!loading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Total Users</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_users}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.total_barbers} barbers, {stats.total_students} students
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Total Bookings</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_bookings}</div>
              <div className="text-xs text-green-600 mt-1">
                {stats.total_completed} completed ({Math.round((stats.total_completed / stats.total_bookings) * 100)}%)
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Total Volume</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_volume_apt.toFixed(2)} APT</div>
              <div className="text-xs text-gray-500 mt-1">
                ≈ ${(stats.total_volume_apt * 10).toFixed(2)} USD
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Platform Fees</div>
              <div className="text-3xl font-bold text-primary-400">{stats.platform_fees_accumulated.toFixed(2)} APT</div>
              <div className="text-xs text-gray-500 mt-1">
                ≈ ${(stats.platform_fees_accumulated * 10).toFixed(2)} USD available
              </div>
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        <div className="mb-8">
          <AdminWalletConnect />
        </div>

        {/* Gas Wallet Monitoring */}
        <div className="mb-8">
          <GasWalletMonitor />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Pending Disputes</h3>
            <p className="text-gray-600 mb-4">View and resolve booking disputes</p>
            <button className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
              View Disputes (0)
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Withdraw Fees</h3>
            <p className="text-gray-600 mb-4">Withdraw accumulated platform fees</p>
            <button 
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={!stats || stats.platform_fees_accumulated < 1}
            >
              Withdraw Fees
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Platform Settings</h3>
            <p className="text-gray-600 mb-4">Configure platform parameters</p>
            <button className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Open Settings
            </button>
          </div>
        </div>

        {/* Blockchain Info */}
        <div className="mt-8 bg-primary-50 border border-primary-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary-700 mb-2">
            Blockchain-First Architecture
          </h3>
          <div className="text-sm text-primary-500 space-y-1">
            <div>All data stored on-chain (Aptos)</div>
            <div>Decentralized file storage (IPFS)</div>
            <div>Custodial wallet service (Gas-free UX)</div>
            <div>Smart contract escrow (Trustless payments)</div>
            <div>Zero database costs (PostgreSQL removed)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

