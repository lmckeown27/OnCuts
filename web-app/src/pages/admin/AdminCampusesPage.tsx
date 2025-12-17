import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, Users, UserCheck, TrendingUp, DollarSign, Award, ArrowLeft } from 'lucide-react';
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
  const [selectedView, setSelectedView] = useState<'campuses' | 'barbers' | 'students'>('campuses');
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setSelectedView('campuses');
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={() => {
                  setSelectedCampus(null);
                  setSelectedView('campuses');
                }}
                className="hover:text-primary-400"
              >
                All Campuses
              </button>
              <span>›</span>
              <span className="font-medium text-gray-900">{selectedCampus.name}</span>
              {selectedView !== 'campuses' && (
                <>
                  <span>›</span>
                  <span className="font-medium text-gray-900">
                    {selectedView === 'barbers' ? 'Barbers' : 'Students'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedCampus ? (
          /* Campus Selection View */
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Select a Campus</h2>
              <p className="text-gray-600 mt-1">Choose a university to view barbers and students</p>
            </div>

            {/* How Payments Work Section */}
            <Card className="mb-8 bg-gradient-to-br from-primary-50 to-primary-50 border-2 border-primary-200">
              <div className="flex items-start gap-4">
                <div className="bg-primary-100 rounded-full p-3 flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-primary-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">How Payments Work on CampusCuts</h3>
                  
                  <div className="space-y-4 text-sm text-gray-700">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">1. Student Books & Pays</h4>
                      <p>Student pays via credit card (Stripe). Funds are converted to USDC and held in escrow on the Aptos blockchain.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">2. Escrow & Platform Fee (5%)</h4>
                      <p>The platform automatically deducts a 5% fee. Remaining 95% is held in escrow until service completion.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">3. Service Completed</h4>
                      <p>After the haircut, the barber marks the booking as complete. Funds are released from escrow to the barber's wallet.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">4. Barber Withdraws</h4>
                      <p>Barber can withdraw earnings to their bank account via Stripe Connect. Platform absorbs all blockchain gas fees.</p>
                    </div>
                    
                    <div className="pt-3 border-t border-primary-200">
                      <p className="font-semibold text-primary-700">All transactions are recorded on the Aptos blockchain for transparency and auditability.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campuses.map((campus) => (
                <Card
                  key={campus.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleSelectCampus(campus)}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-primary-100 rounded-full p-3">
                      <School className="w-6 h-6 text-primary-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{campus.name}</h3>
                      <p className="text-sm text-gray-600">{campus.city}, {campus.state}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Students:</span>
                      <span className="font-semibold">{campus.student_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Barbers:</span>
                      <span className="font-semibold">{campus.active_barbers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Bookings:</span>
                      <span className="font-semibold">{campus.total_bookings}</span>
                    </div>
                  </div>

                  <Button className="w-full mt-4">
                    View Campus
                  </Button>
                </Card>
              ))}
            </div>
          </>
        ) : selectedView === 'campuses' ? (
          /* Campus Detail View */
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCampus.name}</h2>
                <p className="text-gray-600 mt-1">{selectedCampus.city}, {selectedCampus.state}</p>
              </div>
              <Button 
                onClick={() => {
                  setSelectedCampus(null);
                  setSelectedView('campuses');
                }} 
                variant="secondary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to All Campuses
              </Button>
            </div>

            {/* Campus Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Students</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedCampus.student_count.toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-3">
                    <UserCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Barbers</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedCampus.active_barbers}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 rounded-full p-3">
                    <TrendingUp className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedCampus.total_bookings}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Real-Time Transaction Feed */}
            <div className="mb-8">
              <RealtimeTransactionFeed campusId={selectedCampus.id} maxItems={20} />
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedView('barbers')}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-primary-100 rounded-full p-4">
                    <UserCheck className="w-8 h-8 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">View Barbers</h3>
                    <p className="text-gray-600">Manage barber profiles and performance</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  View detailed barber information including performance scores, pricing, and booking history.
                </p>
                <Button className="w-full">
                  View {selectedCampus.active_barbers} Barbers →
                </Button>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedView('students')}
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
                <Button className="w-full">
                  View Students →
                </Button>
              </Card>
            </div>
          </>
        ) : selectedView === 'barbers' ? (
          /* Barbers View */
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Barbers at {selectedCampus.name}</h2>
                <p className="text-gray-600 mt-1">{mockBarbers[selectedCampus.id]?.length || 0} active barbers</p>
              </div>
              <Button onClick={() => setSelectedView('campuses')} variant="secondary">
                Back to Campus
              </Button>
            </div>

            <div className="space-y-4">
              {(mockBarbers[selectedCampus.id] || []).map((barber) => (
                <Card key={barber.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    {/* Barber Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          to={`/admin/user/${barber.id}`}
                          className="text-lg font-bold text-primary-400 hover:text-primary-600 hover:underline"
                        >
                          {barber.name}
                        </Link>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          barber.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {barber.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{barber.email}</p>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {barber.specialties.map((specialty, idx) => (
                          <span key={idx} className="px-2 py-1 bg-primary-100 text-primary-600 text-xs rounded-full">
                            {specialty}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Rating</p>
                          <p className="font-semibold">{barber.average_rating} stars</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Bookings</p>
                          <p className="font-semibold">{barber.total_bookings}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Experience</p>
                          <p className="font-semibold">{barber.years_experience} years</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Price Range</p>
                          <p className="font-semibold">{barber.current_price_range}</p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Score Panel */}
                    <div className="ml-6 p-4 bg-gradient-to-br from-primary-50 to-primary-50 rounded-lg border-2 border-primary-200 min-w-[280px]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Performance Score</h4>
                        <Award className="w-5 h-5 text-primary-400" />
                      </div>
                      
                      <div className="text-center mb-4">
                        <div className={`text-4xl font-bold ${getPerformanceColor(barber.performance_score)}`}>
                          {barber.performance_score}
                        </div>
                        <div className="text-sm text-gray-600">/ 100</div>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getPerformanceBadge(barber.performance_score)}`}>
                          {barber.performance_score >= 90 ? 'Excellent' : barber.performance_score >= 75 ? 'Good' : 'Average'}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Quality</span>
                            <span className="font-semibold">{barber.quality_score}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${barber.quality_score}%` }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Reliability</span>
                            <span className="font-semibold">{barber.reliability_score}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${barber.reliability_score}%` }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-600">Demand</span>
                            <span className="font-semibold">{barber.demand_score}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{ width: `${barber.demand_score}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {(!mockBarbers[selectedCampus.id] || mockBarbers[selectedCampus.id].length === 0) && (
                <Card>
                  <p className="text-center text-gray-600 py-8">No barbers found for this campus</p>
                </Card>
              )}
            </div>
          </>
        ) : (
          /* Students View */
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Students at {selectedCampus.name}</h2>
                <p className="text-gray-600 mt-1">{mockStudents[selectedCampus.id]?.length || 0} registered students</p>
              </div>
              <Button onClick={() => setSelectedView('campuses')} variant="secondary">
                Back to Campus
              </Button>
            </div>

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
                            to={`/admin/user/${student.id}`}
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
          </>
        )}
      </div>
    </div>
  );
}
