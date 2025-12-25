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
