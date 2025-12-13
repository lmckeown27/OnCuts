import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, Award } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberBookingRequests from '../components/booking/BarberBookingRequests';
import { CampusCutsLogo } from '@assets';

export default function BarberPage() {
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
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
  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 rounded-full p-3">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Appointments</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="bg-green-100 rounded-full p-3">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Earnings</p>
              <p className="text-2xl font-bold text-gray-900">$340</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-gray-900">4.8</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Overview */}
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">This Week</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Bookings</p>
            <p className="text-2xl font-bold text-gray-900">24</p>
            <p className="text-xs text-green-600">+12% from last week</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Revenue</p>
            <p className="text-2xl font-bold text-gray-900">$1,240</p>
            <p className="text-xs text-green-600">+8% from last week</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">New Reviews</p>
            <p className="text-2xl font-bold text-gray-900">12</p>
            <p className="text-xs text-gray-500">4.9 avg rating</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tips</p>
            <p className="text-2xl font-bold text-gray-900">$180</p>
            <p className="text-xs text-green-600">+15% from last week</p>
          </div>
        </div>
      </Card>

      {/* Booking Requests - Integrated */}
      <div className="mb-6">
        <BarberBookingRequests barberId={barberId} />
      </div>

      {/* Upcoming Appointments */}
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Schedule</h2>
        <div className="space-y-4">
          {[
            { id: '1', time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
            { id: '2', time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$20', status: 'confirmed' },
            { id: '3', time: '2:00 PM', client: 'Chris Lee', service: 'Full Service', price: '$55', status: 'pending' },
            { id: '4', time: '3:30 PM', client: 'David Brown', service: 'Haircut', price: '$30', status: 'confirmed' },
          ].map((apt, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-center">
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
                <p className="font-bold text-green-600">{apt.price}</p>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="mt-1"
                  onClick={() => navigate(`/barber/appointment/${apt.id}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Reviews</h2>
        <div className="space-y-4">
          {[
            { name: 'Alex Johnson', rating: 5, comment: 'Best fade I\'ve ever gotten! Super clean work.', date: '2 hours ago' },
            { name: 'Marcus White', rating: 5, comment: 'Great conversation and even better haircut. Will be back!', date: '1 day ago' },
            { name: 'Tyler Green', rating: 4, comment: 'Really good cut, just took a bit longer than expected.', date: '2 days ago' },
          ].map((review, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">{review.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">{review.date}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{review.comment}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
