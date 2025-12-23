/**
 * Admin System Health Page
 * 
 * Displays system health monitoring and service status
 * Monitors: PostgreSQL, API Server, Stripe, Email
 */

import { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  Users, 
  Calendar, 
  Star,
  TrendingUp,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import SystemModeMeter from '../../components/SystemModeMeter';
import AdminHeader from '../../components/AdminHeader';
import Card from '../../components/Card';
import axios from 'axios';

interface PlatformStats {
  available: boolean;
  stats?: {
    users: { students: number; barbers: number; total: number };
    bookings: { total: number; completed: number; pending: number; completionRate: number };
    campuses: { active: number };
    reviews: { total: number; averageRating: string };
  };
  message?: string;
}

export default function AdminSystemHealthPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await axios.get('http://localhost:3001/api/system/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({ 
        available: false, 
        message: 'Unable to connect to backend' 
      });
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="System Health" />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Infrastructure Status</h2>
          <p className="text-gray-600">
            Monitor database connectivity, service health, and platform metrics
          </p>
        </div>

        {/* System Health Dashboard */}
        <div className="mb-8">
          <SystemModeMeter />
        </div>

        {/* Platform Statistics */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              Platform Statistics
            </h3>
            <button 
              onClick={fetchStats}
              disabled={loadingStats}
              className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingStats ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading statistics...
            </div>
          ) : stats?.available && stats.stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Users */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-gray-700">Users</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.stats.users.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.stats.users.students} students · {stats.stats.users.barbers} barbers
                </div>
              </div>

              {/* Bookings */}
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-100 rounded-lg p-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-gray-700">Bookings</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.stats.bookings.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.stats.bookings.completionRate}% completion rate
                </div>
              </div>

              {/* Campuses */}
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-purple-100 rounded-lg p-2">
                    <Database className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="font-semibold text-gray-700">Campuses</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.stats.campuses.active}
                </div>
                <div className="text-xs text-gray-500">
                  Active campuses
                </div>
              </div>

              {/* Reviews */}
              <div className="bg-yellow-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-yellow-100 rounded-lg p-2">
                    <Star className="w-5 h-5 text-yellow-600" />
                  </div>
                  <span className="font-semibold text-gray-700">Reviews</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.stats.reviews.averageRating}
                </div>
                <div className="text-xs text-gray-500">
                  {stats.stats.reviews.total} total reviews
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">{stats?.message || 'Statistics unavailable'}</p>
              <p className="text-sm text-gray-500">Connect to database to view platform metrics</p>
            </div>
          )}
        </Card>

        {/* Architecture Overview */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Architecture Overview</h3>
          
          <div className="space-y-6 text-sm text-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Data Storage */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Data Storage
                </h4>
                <ul className="space-y-1 text-blue-800 text-sm">
                  <li>• PostgreSQL for all user data</li>
                  <li>• Bookings, reviews, and transactions</li>
                  <li>• Campus and barber information</li>
                  <li>• Optimized connection pooling</li>
                </ul>
              </div>

              {/* Payment Processing */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Payment Processing
                </h4>
                <ul className="space-y-1 text-green-800 text-sm">
                  <li>• Stripe for card payments</li>
                  <li>• Stripe Connect for barber payouts</li>
                  <li>• Escrow system for booking security</li>
                  <li>• 5% platform fee</li>
                </ul>
              </div>

              {/* API Server */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  API Server
                </h4>
                <ul className="space-y-1 text-purple-800 text-sm">
                  <li>• Node.js with Express</li>
                  <li>• RESTful API endpoints</li>
                  <li>• JWT authentication</li>
                  <li>• Rate limiting & security</li>
                </ul>
              </div>

              {/* Notifications */}
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Communications
                </h4>
                <ul className="space-y-1 text-orange-800 text-sm">
                  <li>• Email via SMTP (Nodemailer)</li>
                  <li>• Verification codes</li>
                  <li>• Booking confirmations</li>
                  <li>• Password resets</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Technology Stack</h4>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Stripe', 'Tailwind CSS', 'JWT'].map((tech) => (
                  <span 
                    key={tech}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
