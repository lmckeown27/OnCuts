/**
 * Campus Manager Dashboard
 * 
 * Conditional overlay shown only when barber.isCampusManager === true
 * Reuses 100% of existing Barber page styles and layout
 */

import React, { useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Flag
} from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { CampusManagerBarberView } from './CampusManagerBarberView';

// Types
interface BarberApplication {
  id: string;
  applicantName: string;
  appliedAt: Date;
  status: 'pending' | 'interviewed' | 'approved' | 'rejected';
  email: string;
  phoneNumber?: string;
}

interface Incident {
  id: string;
  barberName: string;
  type: string;
  description: string;
  status: 'open' | 'escalated' | 'resolved';
  createdAt: Date;
}

interface CampusManagerDashboardProps {
  campusId: string;
  campusName: string;
}

export const CampusManagerDashboard: React.FC<CampusManagerDashboardProps> = ({ 
  campusId, 
  campusName 
}) => {
  const [activeTab, setActiveTab] = useState<'applications' | 'barbers' | 'content' | 'incidents'>('applications');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('applications')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'applications'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Barber Applications
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('barbers')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'barbers'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Barber Management
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('content')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'content'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Content
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'incidents'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Incidents
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'applications' && <BarberApplicationsPanel campusId={campusId} />}
        {activeTab === 'barbers' && <BarberManagementPanel campusId={campusId} campusName={campusName} />}
        {activeTab === 'content' && <ContentManagementPanel campusId={campusId} />}
        {activeTab === 'incidents' && <IncidentsPanel campusId={campusId} />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// BARBER APPLICATIONS PANEL
// ═══════════════════════════════════════════════════════════════

const BarberApplicationsPanel: React.FC<{ campusId: string }> = ({ campusId }) => {
  // TODO: Fetch applications from API
  const [applications] = useState<BarberApplication[]>([
    {
      id: '1',
      applicantName: 'John Smith',
      appliedAt: new Date('2025-01-10'),
      status: 'pending',
      email: 'john.smith@example.com',
      phoneNumber: '(555) 123-4567',
    },
    {
      id: '2',
      applicantName: 'Maria Garcia',
      appliedAt: new Date('2025-01-12'),
      status: 'interviewed',
      email: 'maria.garcia@example.com',
    },
  ]);

  const handleAction = (applicationId: string, action: 'approve' | 'reject' | 'interview') => {
    console.log(`Action ${action} on application ${applicationId}`);
    // TODO: Implement API call
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Pending Applications</h3>
        <span className="text-sm text-gray-500">{applications.length} pending</span>
      </div>

      {applications.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No pending applications</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{app.applicantName}</h4>
                  <p className="text-sm text-gray-600 mt-1">{app.email}</p>
                  {app.phoneNumber && (
                    <p className="text-sm text-gray-600">{app.phoneNumber}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-500">
                      Applied {app.appliedAt.toLocaleDateString()}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      app.status === 'interviewed' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {app.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(app.id, 'interview')}
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Interview
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAction(app.id, 'approve')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(app.id, 'reject')}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {app.status === 'interviewed' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAction(app.id, 'approve')}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(app.id, 'reject')}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// BARBER MANAGEMENT PANEL
// ═══════════════════════════════════════════════════════════════

interface CampusBarber {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  instagramHandle?: string;
  avgRating: number;
  totalBookings: number;
  completedBookings: number;
  isActive: boolean;
  joinedDate: Date;
}

const BarberManagementPanel: React.FC<{ campusId: string; campusName: string }> = ({ campusId, campusName }) => {
  // TODO: Fetch barbers from API
  const [barbers] = useState<CampusBarber[]>([
    {
      id: '1',
      name: 'Marcus Johnson',
      email: 'marcus.j@example.com',
      phoneNumber: '(555) 123-4567',
      instagramHandle: 'marcuscuts_slo',
      avgRating: 4.8,
      totalBookings: 127,
      completedBookings: 119,
      isActive: true,
      joinedDate: new Date('2024-01-15'),
    },
    {
      id: '2',
      name: 'David Kim',
      email: 'david.kim@example.com',
      instagramHandle: 'davidkim_fades',
      avgRating: 4.7,
      totalBookings: 89,
      completedBookings: 84,
      isActive: true,
      joinedDate: new Date('2024-02-01'),
    },
    {
      id: '3',
      name: 'Carlos Martinez',
      email: 'carlos.m@example.com',
      phoneNumber: '(555) 987-6543',
      avgRating: 4.6,
      totalBookings: 56,
      completedBookings: 52,
      isActive: true,
      joinedDate: new Date('2024-03-10'),
    },
    {
      id: '4',
      name: 'Tyler Brooks',
      email: 'tyler.brooks@example.com',
      avgRating: 4.9,
      totalBookings: 8,
      completedBookings: 7,
      isActive: false,
      joinedDate: new Date('2024-12-01'),
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

  // Filter barbers based on search and status
  const filteredBarbers = barbers.filter((barber) => {
    const matchesSearch = barber.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         barber.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && barber.isActive) ||
                         (filterStatus === 'inactive' && !barber.isActive);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Barber Management</h3>
        <p className="text-sm text-gray-500">View and manage barbers working on your campus</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filterStatus === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({barbers.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filterStatus === 'active'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active ({barbers.filter(b => b.isActive).length})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filterStatus === 'inactive'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Inactive ({barbers.filter(b => !b.isActive).length})
          </button>
        </div>
      </div>

      {/* Barbers List */}
      {filteredBarbers.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No barbers found matching your criteria</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBarbers.map((barber) => (
            <Card key={barber.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header Row */}
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{barber.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      barber.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {barber.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {barber.avgRating >= 4.8 && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        ⭐ Top Rated
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Email:</span>
                      <a href={`mailto:${barber.email}`} className="text-primary-600 hover:underline">
                        {barber.email}
                      </a>
                    </div>
                    {barber.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Phone:</span>
                        <a href={`tel:${barber.phoneNumber}`} className="text-primary-600 hover:underline">
                          {barber.phoneNumber}
                        </a>
                      </div>
                    )}
                    {barber.instagramHandle && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Instagram:</span>
                        <a
                          href={`https://www.instagram.com/${barber.instagramHandle}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline"
                        >
                          @{barber.instagramHandle}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Joined:</span>
                      <span>{barber.joinedDate.toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">Rating:</span>
                      <span className="text-yellow-600 font-semibold">{barber.avgRating.toFixed(1)}</span>
                      <span className="text-gray-500">★</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">Total Bookings:</span>
                      <span className="text-gray-700">{barber.totalBookings}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">Completed:</span>
                      <span className="text-green-600 font-semibold">{barber.completedBookings}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">Completion Rate:</span>
                      <span className="text-gray-700">
                        {((barber.completedBookings / barber.totalBookings) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedBarberId(barber.id)}
                  >
                    View Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = `mailto:${barber.email}`}
                  >
                    Contact
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Campus Manager Responsibilities</h4>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li>• Monitor barber performance and assist with onboarding</li>
              <li>• Provide support and answer questions from barbers</li>
              <li>• Help resolve issues between barbers and customers</li>
              <li>• Ensure all barbers maintain professional standards</li>
              <li>• Cannot manipulate rankings, pricing, or visibility</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Barber Profile Modal */}
      {selectedBarberId && (
        <CampusManagerBarberView
          barberId={selectedBarberId}
          onClose={() => setSelectedBarberId(null)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CONTENT MANAGEMENT PANEL (Instagram Integration)
// ═══════════════════════════════════════════════════════════════

const ContentManagementPanel: React.FC<{ campusId: string }> = ({ campusId }) => {
  // Map campus IDs to Instagram handles
  const getCampusInstagram = (campusId: string): string => {
    // TODO: Fetch from database/API
    const instagramHandles: Record<string, string> = {
      'campus-1': 'campuscutsslo',
      '00000000-0000-0000-0000-000000000001': 'campuscutsslo',
      // Add more campus-to-instagram mappings here
    };
    
    return instagramHandles[campusId] || 'campuscutsslo'; // Default to SLO
  };

  const instagramHandle = getCampusInstagram(campusId);
  const instagramUrl = `https://www.instagram.com/${instagramHandle}/`;

  const openInstagram = () => {
    window.open(instagramUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Campus Content & Social Media</h3>
        <p className="text-sm text-gray-500">
          Manage your campus's Instagram presence and share barber content with the community.
        </p>
      </div>

      {/* Instagram Card */}
      <Card className="p-8">
        <div className="text-center">
          {/* Instagram Logo */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>

          {/* Instagram Info */}
          <h4 className="text-xl font-bold text-gray-900 mb-2">
            Campus Instagram
          </h4>
          <p className="text-lg text-gray-700 mb-1">
            @{instagramHandle}
          </p>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Post barber showcases, campus events, promotions, and student success stories to your campus Instagram page.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="primary"
              onClick={openInstagram}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              Open Instagram
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(instagramUrl);
                alert('Instagram link copied to clipboard!');
              }}
            >
              Copy Link
            </Button>
          </div>
        </div>
      </Card>

      {/* Content Guidelines */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Content Guidelines</h4>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li>• Showcase barber work and transformations</li>
              <li>• Highlight positive customer experiences</li>
              <li>• Promote campus events and special offers</li>
              <li>• Tag barbers and customers (with permission)</li>
              <li>• Use relevant hashtags (#CampusCuts, #YourCampusName)</li>
              <li>• Maintain professional and inclusive content</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">247</p>
          <p className="text-xs text-gray-600 mt-1">Posts</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">1.2K</p>
          <p className="text-xs text-gray-600 mt-1">Followers</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">892</p>
          <p className="text-xs text-gray-600 mt-1">Following</p>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// INCIDENTS PANEL
// ═══════════════════════════════════════════════════════════════

const IncidentsPanel: React.FC<{ campusId: string }> = ({ campusId }) => {
  const [incidents] = useState<Incident[]>([
    {
      id: '1',
      barberName: 'John Doe',
      type: 'Quality Complaint',
      description: 'Multiple complaints about rushed service',
      status: 'open',
      createdAt: new Date('2025-01-15'),
    },
  ]);

  const handleEscalate = (incidentId: string) => {
    console.log(`Escalating incident ${incidentId}`);
    // TODO: Implement API call
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Incident Reports</h3>
        <Button variant="outline">
          <Flag className="w-4 h-4 mr-2" />
          Report Issue
        </Button>
      </div>

      {incidents.length === 0 ? (
        <Card className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <p className="text-gray-500">No open incidents</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <Card key={incident.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{incident.barberName}</h4>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                      {incident.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{incident.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-500">
                      {incident.createdAt.toLocaleDateString()}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      incident.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                      incident.status === 'escalated' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
                
                {incident.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEscalate(incident.id)}
                    className="ml-4"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Escalate to Admin
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

