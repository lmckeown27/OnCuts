/**
 * Admin Campus Dashboard
 * 
 * Campus-specific admin view with real-time transaction tracking
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, TrendingUp } from 'lucide-react';
import RealtimeTransactionFeed from '../../components/RealtimeTransactionFeed';

interface CampusStats {
  name: string;
  city: string;
  state: string;
  totalStudents: number;
  activeBarbers: number;
  totalBookings: number;
}

export const AdminCampusDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { campusId } = useParams();

  // Mock data - replace with actual API call
  const campus: CampusStats = {
    name: 'California Polytechnic State University',
    city: 'San Luis Obispo',
    state: 'CA',
    totalStudents: 21000,
    activeBarbers: 12,
    totalBookings: 450,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                alt="CampusCuts"
                className="h-10 w-auto"
                src="/src/assets/logos/Logo1.png"
              />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={() => navigate('/admin/campuses')}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 px-3 py-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <button
              onClick={() => navigate('/admin/campuses')}
              className="hover:text-indigo-600"
            >
              All Campuses
            </button>
            <span>›</span>
            <span className="font-medium text-gray-900">{campus.name}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Campus Info */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{campus.name}</h2>
          <p className="text-gray-600 mt-1">
            {campus.city}, {campus.state}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-full p-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {campus.totalStudents.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-full p-3">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Barbers</p>
                <p className="text-2xl font-bold text-gray-900">{campus.activeBarbers}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{campus.totalBookings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Transaction Feed */}
        <div className="mb-8">
          <RealtimeTransactionFeed campusId={campusId} maxItems={15} />
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/admin/campus/${campusId}/barbers`)}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-indigo-100 rounded-full p-4">
                <UserCheck className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">View Barbers</h3>
                <p className="text-gray-600">Manage barber profiles and performance</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              View detailed barber information including performance scores, pricing, and
              booking history.
            </p>
            <button className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 px-4 py-2 text-base w-full">
              View {campus.activeBarbers} Barbers →
            </button>
          </div>

          <div
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/admin/campus/${campusId}/students`)}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-green-100 rounded-full p-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">View Students</h3>
                <p className="text-gray-600">Manage student accounts and activity</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              View student profiles, booking history, and spending patterns.
            </p>
            <button className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 px-4 py-2 text-base w-full">
              View Students →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCampusDashboard;

