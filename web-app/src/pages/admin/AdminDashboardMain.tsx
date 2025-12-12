/**
 * Main Admin Dashboard
 * 
 * Landing page with navigation to all admin sections
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Activity, Fuel, ArrowLeft, TrendingUp, Shield, Users } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { CampusCutsLogo } from '@assets';

export default function AdminDashboardMain() {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'campuses',
      title: 'Campus Management',
      description: 'View and manage all campuses, barbers, and students',
      icon: School,
      color: 'indigo',
      path: '/admin/campuses',
      stats: 'Manage users across all universities',
    },
    {
      id: 'system',
      title: 'System Health',
      description: 'Monitor system mode (Hybrid vs Blockchain-only)',
      icon: Activity,
      color: 'green',
      path: '/admin/system-health',
      stats: 'Real-time infrastructure monitoring',
    },
    {
      id: 'gas',
      title: 'Gas Wallet Monitor',
      description: 'Track gas wallet balance and usage',
      icon: Fuel,
      color: 'orange',
      path: '/admin/gas-wallet',
      stats: 'Automated balance alerts and predictions',
    },
    {
      id: 'analytics',
      title: 'Platform Analytics',
      description: 'View revenue, bookings, and growth metrics',
      icon: TrendingUp,
      color: 'purple',
      path: '/admin/analytics',
      stats: 'Coming soon',
    },
    {
      id: 'fraud',
      title: 'Fraud Detection',
      description: 'AI-powered fraud alerts and pattern recognition',
      icon: Shield,
      color: 'red',
      path: '/admin/fraud',
      stats: 'Coming soon',
    },
    {
      id: 'disputes',
      title: 'Dispute Resolution',
      description: 'AI-assisted booking dispute recommendations',
      icon: Users,
      color: 'blue',
      path: '/admin/disputes',
      stats: 'Coming soon',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <Button onClick={() => navigate('/')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Platform Administration</h2>
          <p className="text-gray-600">
            Manage campuses, monitor system health, and oversee platform operations
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 rounded-full p-3">
                <School className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-indigo-600 font-semibold">CAMPUSES</p>
                <p className="text-2xl font-bold text-gray-900">5</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center gap-4">
              <div className="bg-green-600 rounded-full p-3">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-semibold">SYSTEM STATUS</p>
                <p className="text-xl font-bold text-gray-900">Operational</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-center gap-4">
              <div className="bg-orange-600 rounded-full p-3">
                <Fuel className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-orange-600 font-semibold">GAS WALLET</p>
                <p className="text-xl font-bold text-gray-900">Monitoring</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const IconComponent = section.icon;
            const colorClasses = {
              indigo: 'bg-indigo-100 text-indigo-600',
              green: 'bg-green-100 text-green-600',
              orange: 'bg-orange-100 text-orange-600',
              purple: 'bg-purple-100 text-purple-600',
              red: 'bg-red-100 text-red-600',
              blue: 'bg-blue-100 text-blue-600',
            }[section.color];

            return (
              <Card
                key={section.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                onClick={() => navigate(section.path)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`rounded-full p-3 ${colorClasses}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{section.title}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">{section.stats}</p>
                </div>

                <Button className="w-full mt-4">
                  Open {section.title} →
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

