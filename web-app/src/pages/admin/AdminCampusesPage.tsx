import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlatform } from '../../utils/platform';
import { School, Users, UserCheck, TrendingUp, Award, ArrowLeft, Search, FileText, AlertTriangle, Calendar, CheckCircle, XCircle, X, Mail, Eye, Ban, MessageSquare } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Loading from '../../components/Loading';
import AdminHeader from '../../components/AdminHeader';
import RealtimeTransactionFeed from '../../components/RealtimeTransactionFeed';

type Campus = {
  id: string;
  name: string;
  city: string;
  state: string;
  domain: string;
  student_count: number;
  active_barbers: number;
  total_bookings: number;
};

type Barber = {
  id: string;
  name: string;
  email: string;
  specialties: string[];
  average_rating: number;
  total_bookings: number;
  years_experience: number;
  performance_score: number; // 0-100
  quality_score: number;
  reliability_score: number;
  demand_score: number;
  current_price_range: string;
  is_active: boolean;
};

type Student = {
  id: string;
  name: string;
  email: string;
  total_bookings: number;
  total_spent: number;
  is_active: boolean;
};

export default function AdminCampusesPage() {
  const navigate = useNavigate();
  const platform = usePlatform();
  const platformPrefix = `/${platform}`;
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [campusSearchTerm, setCampusSearchTerm] = useState('');
  const [campusTab, setCampusTab] = useState<'transactions' | 'barbers' | 'students' | 'campus-manager'>('transactions');
  const [managerSubTab, setManagerSubTab] = useState<'applications' | 'management' | 'content' | 'incidents'>('applications');
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);

  // Mock data for campuses
  const campuses: Campus[] = [
    {
      id: 'campus-1',
      name: 'California Polytechnic State University',
      city: 'San Luis Obispo',
      state: 'CA',
      domain: 'calpoly.edu',
      student_count: 21000,
      active_barbers: 12,
      total_bookings: 450,
    },
    {
      id: 'campus-2',
      name: 'University of California, Santa Barbara',
      city: 'Santa Barbara',
      state: 'CA',
      domain: 'ucsb.edu',
      student_count: 26000,
      active_barbers: 15,
      total_bookings: 680,
    },
    {
      id: 'campus-3',
      name: 'University of California, Los Angeles',
      city: 'Los Angeles',
      state: 'CA',
      domain: 'ucla.edu',
      student_count: 45000,
      active_barbers: 28,
      total_bookings: 1250,
    },
  ];

  // Mock barbers with performance scores
  const mockBarbers: Record<string, Barber[]> = {
    'campus-1': [
      {
        id: 'barber-1',
        name: 'Marcus Thompson',
        email: 'marcus.thompson@calpoly.edu',
        specialties: ['Fades', 'Curly Hair', 'Beard Grooming'],
        average_rating: 4.9,
        total_bookings: 156,
        years_experience: 5,
        performance_score: 92,
        quality_score: 95,
        reliability_score: 88,
        demand_score: 85,
        current_price_range: '$30-$50',
        is_active: true,
      },
      {
        id: 'barber-2',
        name: 'Jordan Williams',
        email: 'jordan.w@calpoly.edu',
        specialties: ['Modern Cuts', 'Line-ups'],
        average_rating: 4.7,
        total_bookings: 98,
        years_experience: 3,
        performance_score: 85,
        quality_score: 88,
        reliability_score: 82,
        demand_score: 78,
        current_price_range: '$28-$45',
        is_active: true,
      },
      {
        id: 'barber-3',
        name: 'Alex Chen',
        email: 'alex.chen@calpoly.edu',
        specialties: ['Asian Hair', 'Perms'],
        average_rating: 4.8,
        total_bookings: 45,
        years_experience: 2,
        performance_score: 78,
        quality_score: 92,
        reliability_score: 75,
        demand_score: 65,
        current_price_range: '$25-$40',
        is_active: true,
      },
    ],
    'campus-2': [
      {
        id: 'barber-4',
        name: 'Tyler Martinez',
        email: 'tyler.m@ucsb.edu',
        specialties: ['Fades', 'Tapers'],
        average_rating: 4.9,
        total_bookings: 203,
        years_experience: 6,
        performance_score: 94,
        quality_score: 96,
        reliability_score: 92,
        demand_score: 88,
        current_price_range: '$32-$55',
        is_active: true,
      },
      {
        id: 'barber-5',
        name: 'Sarah Johnson',
        email: 'sarah.j@ucsb.edu',
        specialties: ['Women\'s Cuts', 'Color'],
        average_rating: 4.8,
        total_bookings: 124,
        years_experience: 4,
        performance_score: 87,
        quality_score: 90,
        reliability_score: 85,
        demand_score: 80,
        current_price_range: '$30-$48',
        is_active: true,
      },
    ],
    'campus-3': [
      {
        id: 'barber-6',
        name: 'Carlos Rodriguez',
        email: 'carlos.r@ucla.edu',
        specialties: ['Fades', 'Modern Styles'],
        average_rating: 4.9,
        total_bookings: 287,
        years_experience: 7,
        performance_score: 96,
        quality_score: 98,
        reliability_score: 95,
        demand_score: 92,
        current_price_range: '$35-$60',
        is_active: true,
      },
    ],
  };

  // Mock students
  const mockStudents: Record<string, Student[]> = {
    'campus-1': [
      {
        id: 'student-1',
        name: 'John Doe',
        email: 'jdoe@calpoly.edu',
        total_bookings: 12,
        total_spent: 380,
        is_active: true,
      },
      {
        id: 'student-2',
        name: 'Jane Smith',
        email: 'jsmith@calpoly.edu',
        total_bookings: 8,
        total_spent: 240,
        is_active: true,
      },
    ],
    'campus-2': [
      {
        id: 'student-3',
        name: 'Mike Wilson',
        email: 'mwilson@ucsb.edu',
        total_bookings: 15,
        total_spent: 450,
        is_active: true,
      },
    ],
    'campus-3': [
      {
        id: 'student-4',
        name: 'Emily Brown',
        email: 'ebrown@ucla.edu',
        total_bookings: 20,
        total_spent: 600,
        is_active: true,
      },
    ],
  };

  const handleSelectCampus = (campus: Campus) => {
    setSelectedCampus(campus);
    setCampusTab('transactions');
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="Campus Management" />

      {/* Breadcrumb - Inside separate container */}
      {selectedCampus && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 overflow-hidden">
              <button
                onClick={() => {
                  setSelectedCampus(null);
                  setCampusTab('transactions');
                }}
                className="hover:text-primary-400 whitespace-nowrap flex-shrink-0"
              >
                Campuses
              </button>
              <span className="flex-shrink-0">›</span>
              <span className="font-medium text-gray-900">{selectedCampus.name}</span>
              <span className="flex-shrink-0">›</span>
              <span className="font-medium text-gray-900 capitalize whitespace-nowrap flex-shrink-0">
                {campusTab}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedCampus ? (
          /* Campus Selection View */
          <>
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Select a Campus</h2>
              <p className="text-gray-600 mt-1">Choose a university to view barbers and students</p>
            </div>

            {/* Campus Search Bar */}
            <div className="mb-6 flex justify-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search campuses..."
                  value={campusSearchTerm}
                  onChange={(e) => setCampusSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center sm:justify-items-center md:justify-items-start">
              {campuses.filter(campus => 
                campus.name.toLowerCase().includes(campusSearchTerm.toLowerCase()) ||
                campus.city.toLowerCase().includes(campusSearchTerm.toLowerCase()) ||
                campus.state.toLowerCase().includes(campusSearchTerm.toLowerCase())
              ).map((campus) => (
                <Card
                  key={campus.id}
                  className="cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 w-full max-w-md sm:max-w-lg md:w-72 min-h-[180px] border-2 border-yellow-400 hover:border-yellow-500 p-6"
                  onClick={() => handleSelectCampus(campus)}
                >
                  <div className="mb-4 text-center">
                    <h3 className="font-bold text-gray-900 text-base">{campus.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{campus.city}, {campus.state}</p>
                  </div>

                  <div className="space-y-2 text-sm text-center">
                    <div className="flex gap-1 justify-center">
                      <span className="text-gray-600">Active Barbers:</span>
                      <span className="font-semibold">{campus.active_barbers}</span>
                    </div>
                    <div className="flex gap-1 justify-center">
                      <span className="text-gray-600">Total Bookings:</span>
                      <span className="font-semibold">{campus.total_bookings}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          /* Campus Detail View with Tabs */
          <>
            {/* Back Button */}
            <div className="mb-4">
              <Button 
                onClick={() => {
                  setSelectedCampus(null);
                  setCampusTab('transactions');
                }} 
                variant="secondary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to All Campuses
              </Button>
            </div>

            {/* Campus Header */}
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">{selectedCampus.name}</h2>
              <p className="text-gray-600 mt-1">{selectedCampus.city}, {selectedCampus.state}</p>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6 border-b border-gray-200">
              <div className="flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setCampusTab('transactions')}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                    campusTab === 'transactions'
                      ? 'text-primary-600 border-primary-500'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setCampusTab('barbers')}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                    campusTab === 'barbers'
                      ? 'text-primary-600 border-primary-500'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  Barbers ({selectedCampus.active_barbers})
                </button>
                <button
                  onClick={() => setCampusTab('students')}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                    campusTab === 'students'
                      ? 'text-primary-600 border-primary-500'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  Students
                </button>
                <button
                  onClick={() => setCampusTab('campus-manager')}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                    campusTab === 'campus-manager'
                      ? 'text-primary-600 border-primary-500'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  Campus Manager
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {campusTab === 'transactions' && (
              <RealtimeTransactionFeed campusId={selectedCampus.id} maxItems={20} />
            )}

            {campusTab === 'barbers' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {(mockBarbers[selectedCampus.id] || []).map((barber) => (
                  <Card 
                    key={barber.id} 
                    className="hover:shadow-md hover:border-primary-300 transition-all cursor-pointer active:scale-[0.98] p-3"
                    onClick={() => setSelectedBarber(barber)}
                  >
                    <div className="flex flex-col items-center text-center">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center mb-2">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                      
                      {/* Name */}
                      <p className="font-semibold text-gray-900 text-sm truncate w-full">{barber.name}</p>
                    </div>
                  </Card>
                ))}

                {(!mockBarbers[selectedCampus.id] || mockBarbers[selectedCampus.id].length === 0) && (
                  <Card>
                    <p className="text-center text-gray-600 py-8">No barbers found for this campus</p>
                  </Card>
                )}

                {/* Barber Actions Popup */}
                {selectedBarber && (
                  <div 
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedBarber(null)}
                  >
                    <div 
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="bg-gradient-to-r from-primary-500 to-green-500 px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-white">{selectedBarber.name}</h3>
                            <p className="text-white/80 text-sm">{selectedBarber.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setSelectedBarber(null)}
                          className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="px-5 py-4 border-b border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{selectedBarber.total_bookings}</p>
                            <p className="text-xs text-gray-500">Bookings</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">{selectedBarber.years_experience}yr</p>
                            <p className="text-xs text-gray-500">Experience</p>
                          </div>
                        </div>
                      </div>

                      {/* Specialties */}
                      <div className="px-5 py-3 border-b border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedBarber.specialties.map((specialty, idx) => (
                            <span key={idx} className="px-2 py-1 bg-primary-100 text-primary-600 text-xs rounded-full">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-4 space-y-2">
                        <button 
                          onClick={() => {
                            navigate(`${platformPrefix}/admin/user/${selectedBarber.id}`);
                            setSelectedBarber(null);
                          }}
                          className="w-full px-4 py-3 text-left rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <Eye className="w-5 h-5 text-gray-500" />
                          <span className="font-medium text-gray-900">View Full Profile</span>
                        </button>
                        
                        <button 
                          className="w-full px-4 py-3 text-left rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <MessageSquare className="w-5 h-5 text-blue-500" />
                          <span className="font-medium text-gray-900">Send Message</span>
                        </button>
                        
                        <button 
                          className="w-full px-4 py-3 text-left rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-3"
                        >
                          <Mail className="w-5 h-5 text-green-500" />
                          <span className="font-medium text-gray-900">Email Barber</span>
                        </button>
                        
                        <button 
                          className="w-full px-4 py-3 text-left rounded-xl border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-3"
                        >
                          <Ban className="w-5 h-5 text-red-500" />
                          <span className="font-medium text-red-600">
                            {selectedBarber.is_active ? 'Suspend Barber' : 'Reactivate Barber'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {campusTab === 'students' && (
              <Card>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Bookings
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Spent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(mockStudents[selectedCampus.id] || []).map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              to={`${platformPrefix}/admin/user/${student.id}`}
                              className="font-medium text-primary-400 hover:text-primary-600 hover:underline"
                            >
                              {student.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {student.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.total_bookings}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${student.total_spent.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              student.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {student.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {(!mockStudents[selectedCampus.id] || mockStudents[selectedCampus.id].length === 0) && (
                    <div className="text-center py-8 text-gray-600">
                      No students found for this campus
                    </div>
                  )}
                </div>
              </Card>
            )}

            {campusTab === 'campus-manager' && (
              <div className="space-y-6">
                {/* Manager Info Header */}
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-purple-100 rounded-full p-3">
                        <UserCheck className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">John Smith</h3>
                        <p className="text-sm text-gray-600">jsmith@{selectedCampus.domain}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Last login: 2 hours ago</p>
                    </div>
                  </div>
                </Card>

                {/* Sub-tabs for Campus Manager sections */}
                <div className="border-b border-gray-200">
                  <nav className="flex gap-1 sm:gap-4 overflow-x-auto">
                    <button
                      onClick={() => setManagerSubTab('applications')}
                      className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                        managerSubTab === 'applications'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Barber Applications
                    </button>
                    <button
                      onClick={() => setManagerSubTab('management')}
                      className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                        managerSubTab === 'management'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      Barber Management
                    </button>
                    <button
                      onClick={() => setManagerSubTab('content')}
                      className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                        managerSubTab === 'content'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Content
                    </button>
                    <button
                      onClick={() => setManagerSubTab('incidents')}
                      className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                        managerSubTab === 'incidents'
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Incidents
                    </button>
                  </nav>
                </div>

                {/* Barber Applications Sub-tab */}
                {managerSubTab === 'applications' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Pending Applications</h3>
                      <span className="text-sm text-gray-500">2 pending review</span>
                    </div>

                    <Card className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">John Smith</h4>
                          <p className="text-sm text-gray-600">john.smith@example.com</p>
                          <p className="text-sm text-gray-600">(555) 123-4567</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">Applied 1/9/2025</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                              Pending
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50">
                            <Calendar className="w-4 h-4" />
                            Interview
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">Maria Garcia</h4>
                          <p className="text-sm text-gray-600">maria.garcia@example.com</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">Applied 1/11/2025</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              Interviewed
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </Card>

                    <h3 className="text-lg font-semibold text-gray-900 mt-6">Recently Processed</h3>
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">Alex Johnson</h4>
                          <p className="text-sm text-gray-600">Processed by Campus Manager on 1/5/2025</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          Approved
                        </span>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Barber Management Sub-tab */}
                {managerSubTab === 'management' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Barber Management Actions</h3>
                      <span className="text-sm text-gray-500">Actions taken by Campus Manager</span>
                    </div>

                    <Card className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Updated schedule for Marcus Thompson</p>
                            <p className="text-sm text-gray-500">Changed availability hours</p>
                          </div>
                          <span className="text-xs text-gray-500">2 days ago</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Suspended barber: Tyler Williams</p>
                            <p className="text-sm text-gray-500">Reason: Multiple customer complaints</p>
                          </div>
                          <span className="text-xs text-red-600 font-medium">Action Required</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Promoted barber: Sarah Chen</p>
                            <p className="text-sm text-gray-500">Added premium service permissions</p>
                          </div>
                          <span className="text-xs text-gray-500">1 week ago</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Content Sub-tab */}
                {managerSubTab === 'content' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Content Submissions</h3>
                      <span className="text-sm text-gray-500">Campus announcements & updates</span>
                    </div>

                    <Card className="p-4">
                      <div className="space-y-4">
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">Finals Week Extended Hours</h4>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                              Published
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            All campus barbers will have extended hours during finals week (Dec 9-15). 
                            Open until 10 PM daily.
                          </p>
                          <p className="text-xs text-gray-500">Submitted: 3 days ago</p>
                        </div>

                        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">New Pricing Structure Proposal</h4>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                              Pending Approval
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Proposing updated base pricing to reflect increased demand and quality standards.
                          </p>
                          <p className="text-xs text-gray-500">Submitted: 1 day ago</p>
                          <div className="flex gap-2 mt-3">
                            <button className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                              Approve
                            </button>
                            <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                              Request Changes
                            </button>
                            <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Incidents Sub-tab */}
                {managerSubTab === 'incidents' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Reported Incidents</h3>
                      <span className="text-sm text-gray-500">1 open incident</span>
                    </div>

                    <Card className="p-4 border-l-4 border-l-red-500">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h4 className="font-semibold text-gray-900">Customer Complaint - Service Quality</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Customer reported unsatisfactory haircut from barber Tyler Williams. 
                            Requesting refund and follow-up.
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">Reported: 1 day ago</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                              Open
                            </span>
                          </div>
                        </div>
                        <button className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                          Resolve
                        </button>
                      </div>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-green-500">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <h4 className="font-semibold text-gray-900">Scheduling Conflict - Resolved</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Double booking issue between two customers. Rescheduled one appointment.
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">Resolved: 3 days ago</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                              Resolved
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 border-l-4 border-l-green-500">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <h4 className="font-semibold text-gray-900">Payment Issue - Resolved</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Customer charged twice for single service. Refund processed.
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">Resolved: 1 week ago</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                              Resolved
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}




