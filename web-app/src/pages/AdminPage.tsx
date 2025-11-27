import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Users, TrendingUp, Settings, AlertTriangle, DollarSign, MapPin, Eye, Ban, Check, MessageSquare, FileText, Activity } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import type { Barber, Campus, Booking } from '../types';
import barberService from '../services/barber.service';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { CampusCutsLogo } from '@assets';

interface ModerationItem {
  id: string;
  type: 'barber_signup' | 'reported_content' | 'booking_dispute';
  barber?: Barber;
  content?: string;
  reportedBy?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface PlatformStats {
  totalUsers: number;
  totalBarbers: number;
  totalStudents: number;
  todayBookings: number;
  todayRevenue: number;
  platformRevenue: number;
  activeCampuses: number;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'analytics' | 'support'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalBarbers: 0,
    totalStudents: 0,
    todayBookings: 0,
    todayRevenue: 0,
    platformRevenue: 0,
    activeCampuses: 2, // Cal Poly SLO, UCSB
  });
  const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      
      // Load barbers for moderation queue (new signups)
      const barbersResponse = await barberService.getBarbers({ limit: 100 });
      
      // Mock moderation queue
      const mockQueue: ModerationItem[] = barbersResponse.data
        .filter(b => !b.is_active) // Assuming inactive barbers are pending approval
        .map(b => ({
          id: `mod-${b.id}`,
          type: 'barber_signup' as const,
          barber: b,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
        }));

      setModerationQueue(mockQueue);

      // Mock stats (in production, these would come from a real analytics endpoint)
      setStats({
        totalUsers: 1234,
        totalBarbers: barbersResponse.data.length,
        totalStudents: 1234 - barbersResponse.data.length,
        todayBookings: 89,
        todayRevenue: 4235.50,
        platformRevenue: 212.78, // 5% of todayRevenue
        activeCampuses: 2,
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveBarber = async (barberId: string) => {
    try {
      await barberService.toggleVacationMode(barberId, true); // Activate the barber
      toast.success('Barber approved successfully');
      loadAdminData();
    } catch (error) {
      toast.error('Failed to approve barber');
    }
  };

  const handleRejectBarber = async (barberId: string) => {
    try {
      // In production, this would be a real ban/reject endpoint
      toast.success('Barber application rejected');
      loadAdminData();
    } catch (error) {
      toast.error('Failed to reject barber');
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading admin dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-12 w-auto" />
              <div className="border-l-2 border-white border-opacity-30 pl-4">
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-primary-100">Platform Management & Moderation</p>
              </div>
            </div>
            <Button onClick={() => navigate('/')} variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'moderation', label: 'Moderation', icon: AlertTriangle, badge: moderationQueue.length },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'support', label: 'Support', icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors relative ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-sm font-medium">Total Users</p>
                    <p className="text-3xl font-bold text-blue-900">{stats.totalUsers.toLocaleString()}</p>
                    <p className="text-xs text-blue-600 mt-1">{stats.totalStudents} students • {stats.totalBarbers} barbers</p>
                  </div>
                  <Users className="w-12 h-12 text-blue-600" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-700 text-sm font-medium">Today's Revenue</p>
                    <p className="text-3xl font-bold text-green-900">${stats.todayRevenue.toLocaleString()}</p>
                    <p className="text-xs text-green-600 mt-1">${stats.platformRevenue} platform fee</p>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-600" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-700 text-sm font-medium">Today's Bookings</p>
                    <p className="text-3xl font-bold text-purple-900">{stats.todayBookings}</p>
                    <p className="text-xs text-purple-600 mt-1">+12% vs yesterday</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-600" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-700 text-sm font-medium">Active Campuses</p>
                    <p className="text-3xl font-bold text-orange-900">{stats.activeCampuses}</p>
                    <p className="text-xs text-orange-600 mt-1">Cal Poly SLO, UCSB</p>
                  </div>
                  <MapPin className="w-12 h-12 text-orange-600" />
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="secondary" fullWidth onClick={() => setActiveTab('moderation')}>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Review Pending ({moderationQueue.length})
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setActiveTab('analytics')}>
                  <TrendingUp className="w-5 h-5 mr-2" />
                  View Analytics
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setActiveTab('support')}>
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Support Inbox
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* Moderation Tab */}
        {activeTab === 'moderation' && (
          <Card>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Moderation</h2>
            
            {moderationQueue.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-600">No pending moderation items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {moderationQueue.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full uppercase">
                            {item.type.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(item.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>

                        {item.type === 'barber_signup' && item.barber && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {item.barber.user?.first_name} {item.barber.user?.last_name}
                            </h3>
                            <p className="text-gray-600 mb-3">{item.barber.bio}</p>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <p className="text-sm text-gray-600">Experience:</p>
                                <p className="font-medium">{item.barber.years_of_experience} years</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Specialties:</p>
                                <p className="font-medium">{item.barber.specialties.join(', ')}</p>
                              </div>
                            </div>
                            {item.barber.portfolio_images && item.barber.portfolio_images.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mb-4">
                                {item.barber.portfolio_images.slice(0, 4).map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img.thumbnail_url || img.image_url}
                                    alt={`Portfolio ${idx + 1}`}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-6">
                        <Button
                          onClick={() => item.barber && handleApproveBarber(item.barber.id)}
                          className="flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => item.barber && handleRejectBarber(item.barber.id)}
                          className="flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            <Card className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Analytics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-blue-900">${stats.todayRevenue.toLocaleString()}</p>
                  <p className="text-sm text-blue-600 mt-1">This month</p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700 font-medium mb-1">Platform Fees</p>
                  <p className="text-3xl font-bold text-green-900">${stats.platformRevenue.toLocaleString()}</p>
                  <p className="text-sm text-green-600 mt-1">5% commission</p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-700 font-medium mb-1">Growth Rate</p>
                  <p className="text-3xl font-bold text-purple-900">+24%</p>
                  <p className="text-sm text-purple-600 mt-1">vs last month</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-lg mb-4">Campus Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Cal Poly SLO</p>
                      <p className="text-sm text-gray-600">45 active barbers • 567 students</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary-600">$2,840</p>
                      <p className="text-sm text-gray-600">This week</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">UC Santa Barbara</p>
                      <p className="text-sm text-gray-600">38 active barbers • 489 students</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary-600">$2,195</p>
                      <p className="text-sm text-gray-600">This week</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <Card>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Support Inbox</h2>
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No open tickets</h3>
              <p className="text-gray-600">All support requests have been resolved</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

