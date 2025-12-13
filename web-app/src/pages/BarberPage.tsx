import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, Award, Scissors } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequests from '../components/booking/BarberBookingRequests';
import { CampusCutsLogo } from '@assets';

export default function BarberPage() {
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showServiceSpecialties, setShowServiceSpecialties] = useState(false);
  const [showPricingDashboard, setShowPricingDashboard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mock barber ID - in production this would come from auth
  const barberId = 'barber-1';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Barber Dashboard</h1>
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-400 rounded-full flex items-center justify-center text-white font-semibold">
                  B
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setShowProfileEditor(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowServiceSpecialties(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Scissors className="w-4 h-4 text-gray-500" />
                    My Services
                  </button>
                  <button
                    onClick={() => {
                      setShowPricingDashboard(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Award className="w-4 h-4 text-gray-500" />
                    Performance & Pricing
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      navigate('/web');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4 text-gray-500" />
                    Back to Roles
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content - Combined Dashboard & Requests */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <DashboardView navigate={navigate} barberId={barberId} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberProfileEditor barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Service Specialties Modal */}
      {showServiceSpecialties && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">My Services & Pricing</h2>
              <button
                onClick={() => setShowServiceSpecialties(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberServiceSpecialties barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Pricing Dashboard Modal */}
      {showPricingDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Performance & Pricing</h2>
              <button
                onClick={() => setShowPricingDashboard(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <BarberPricingDashboard barberId={barberId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
}

function DashboardView({ navigate, barberId }: DashboardViewProps) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  return (
    <>
      {/* Booking Requests - Top Priority */}
      <div className="mb-6">
        <BarberBookingRequests barberId={barberId} />
      </div>

      {/* Schedule Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">My Schedule</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setScheduleView('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'daily'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setScheduleView('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'weekly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setScheduleView('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scheduleView === 'monthly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Daily View */}
        {scheduleView === 'daily' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Today - Friday, January 12, 2025</h3>
              <p className="text-sm text-gray-600">8 appointments</p>
            </div>
            <div className="space-y-3">
              {[
                { id: '1', time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
                { id: '2', time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$20', status: 'confirmed' },
                { id: '3', time: '2:00 PM', client: 'Chris Lee', service: 'Full Service', price: '$55', status: 'pending' },
                { id: '4', time: '3:30 PM', client: 'David Brown', service: 'Haircut', price: '$30', status: 'confirmed' },
                { id: '5', time: '5:00 PM', client: 'James Wilson', service: 'Haircut', price: '$30', status: 'confirmed' },
              ].map((apt, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[80px]">
                      <p className="font-bold text-primary-400">{apt.time}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        apt.status === 'confirmed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="h-12 w-px bg-gray-300"></div>
                    <div>
                      <p className="font-semibold text-gray-900">{apt.client}</p>
                      <p className="text-sm text-gray-600">{apt.service}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 mb-1">{apt.price}</p>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => navigate(`/barber/appointment/${apt.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly View */}
        {scheduleView === 'weekly' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Week of January 8 - 14, 2025</h3>
              <p className="text-sm text-gray-600">42 appointments this week</p>
            </div>
            <div className="space-y-6">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dayIdx) => (
                <div key={day}>
                  <h4 className="font-semibold text-gray-900 mb-2">{day}</h4>
                  <div className="space-y-2">
                    {[1, 2, 3].map((apt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-primary-400 min-w-[60px]">
                            {`${10 + idx}:00 AM`}
                          </span>
                          <span className="text-gray-900">Client Name</span>
                          <span className="text-gray-500">• Haircut</span>
                        </div>
                        <span className="font-semibold text-green-600">$30</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly View */}
        {scheduleView === 'monthly' && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">January 2025</h3>
              <p className="text-sm text-gray-600">168 appointments this month</p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {/* Calendar header */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                  {day}
                </div>
              ))}
              {/* Calendar days */}
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <div
                  key={day}
                  className={`aspect-square p-2 rounded-lg border ${
                    day === 12 
                      ? 'bg-primary-400 text-white border-primary-500' 
                      : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                  } cursor-pointer transition-colors`}
                >
                  <div className="text-sm font-semibold">{day}</div>
                  <div className="text-xs mt-1">{Math.floor(Math.random() * 10)} apts</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
