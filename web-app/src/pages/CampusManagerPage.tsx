/**
 * Campus Manager Dashboard
 * 
 * Allows campus managers to:
 * - Review barber applications
 * - View campus barber metrics
 * - Manage campus-specific settings
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  ClipboardList, 
  BarChart3, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft,
  LogOut,
  User,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { barberApplicationService, BarberApplication } from '../services/barber-application.service';
import Button from '../components/Button';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import toast from 'react-hot-toast';
import TabChairLogo from '../assets/logos/Tab_Chair.webp';

export default function CampusManagerPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [applications, setApplications] = useState<BarberApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedApplication, setExpandedApplication] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const response = await barberApplicationService.getAllApplications();
      setApplications(response.data || []);
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error('Failed to load barber applications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewApplication = async (applicationId: string, status: 'approved' | 'rejected' | 'interview_scheduled') => {
    try {
      setProcessingId(applicationId);
      await barberApplicationService.updateApplicationStatus(applicationId, status);
      toast.success(`Application ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'scheduled for interview'}!`);
      await loadApplications();
    } catch (error) {
      console.error('Failed to update application:', error);
      toast.error('Failed to update application status');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Rejected</span>;
      case 'interview_scheduled':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Interview Scheduled</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>;
    }
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const displayedApplications = activeTab === 'pending' ? pendingApplications : applications;

  const platformPrefix = '/web';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src={TabChairLogo} alt="CampusCut" className="h-10 w-auto" />
              <span className="hidden sm:block font-bold text-gray-900">Campus Manager</span>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Avatar 
                  src={user?.profile_picture_url} 
                  alt={user?.first_name || 'User'} 
                  size="sm" 
                />
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {user?.first_name}
                </span>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      navigate(`${platformPrefix}/admin-role-select`);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                    Back to Roles
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/web');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Applications</p>
                <p className="text-2xl font-bold text-gray-900">{pendingApplications.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {applications.filter(app => app.status === 'approved').length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Applications Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary-600" />
              Barber Applications
            </h2>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({pendingApplications.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({applications.length})
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : displayedApplications.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications</h3>
              <p className="text-gray-500">
                {activeTab === 'pending' 
                  ? 'There are no pending applications to review.'
                  : 'No barber applications have been submitted yet.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedApplications.map((application) => (
                <div
                  key={application.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Application Header */}
                  <button
                    onClick={() => setExpandedApplication(
                      expandedApplication === application.id ? null : application.id
                    )}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar 
                        src={application.user?.profile_picture_url} 
                        alt={application.user?.first_name || 'Applicant'} 
                        size="md" 
                      />
                      <div className="text-left">
                        <h3 className="font-medium text-gray-900">
                          {application.user?.first_name} {application.user?.last_name}
                        </h3>
                        <p className="text-sm text-gray-500">{application.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(application.status)}
                      <span className="text-sm text-gray-500">{formatDate(application.created_at)}</span>
                      {expandedApplication === application.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedApplication === application.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column - Details */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Experience</h4>
                            <p className="text-gray-900">{application.years_experience} years</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">License</h4>
                            <p className="text-gray-900">
                              {application.has_license ? `Yes - ${application.license_number || 'Number not provided'}` : 'No'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Own Tools</h4>
                            <p className="text-gray-900">{application.has_own_tools ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Specialties</h4>
                            <div className="flex flex-wrap gap-1">
                              {(application.specialties || []).map((specialty, idx) => (
                                <span key={idx} className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                                  {specialty}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Availability</h4>
                            <p className="text-gray-900">{application.available_hours}</p>
                          </div>
                        </div>

                        {/* Right Column - Why & Portfolio */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Why become a barber?</h4>
                            <p className="text-gray-900">{application.why_be_barber}</p>
                          </div>
                          {application.portfolio_description && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 mb-1">Portfolio</h4>
                              <p className="text-gray-900">{application.portfolio_description}</p>
                            </div>
                          )}
                          {application.social_media && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 mb-1">Social Media</h4>
                              <p className="text-gray-900">{application.social_media}</p>
                            </div>
                          )}
                          {application.additional_notes && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 mb-1">Additional Notes</h4>
                              <p className="text-gray-900">{application.additional_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {application.status === 'pending' && (
                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                          <Button
                            onClick={() => handleReviewApplication(application.id, 'approved')}
                            disabled={processingId === application.id}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleReviewApplication(application.id, 'interview_scheduled')}
                            disabled={processingId === application.id}
                            className="flex items-center gap-2"
                          >
                            <Calendar className="w-4 h-4" />
                            Schedule Interview
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleReviewApplication(application.id, 'rejected')}
                            disabled={processingId === application.id}
                            className="flex items-center gap-2 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

