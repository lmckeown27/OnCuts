import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, User, LayoutDashboard, Award, Inbox } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberBookingRequests from '../components/booking/BarberBookingRequests';
import { CampusCutsLogo } from '@assets';

type TabType = 'dashboard' | 'requests' | 'pricing' | 'profile';

export default function BarberPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Mock barber ID - in production this would come from auth
  const barberId = 'barber-1';

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
            <Button onClick={() => navigate('/web')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 inline mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Inbox className="w-4 h-4 inline mr-2" />
                Booking Requests
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'pricing'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Award className="w-4 h-4 inline mr-2" />
                Performance & Pricing
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Manage Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'requests' && <BarberBookingRequests barberId={barberId} />}
        {activeTab === 'pricing' && <BarberPricingDashboard barberId={barberId} />}
        {activeTab === 'profile' && <BarberProfileEditor barberId={barberId} />}
      </div>
    </div>
  );
}

function DashboardView() {
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
            <div className="bg-purple-100 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
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

      {/* Upcoming Appointments */}
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Schedule</h2>
        <div className="space-y-4">
          {[
            { time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
            { time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$20', status: 'confirmed' },
            { time: '2:00 PM', client: 'Chris Lee', service: 'Full Service', price: '$55', status: 'pending' },
            { time: '3:30 PM', client: 'David Brown', service: 'Haircut', price: '$30', status: 'confirmed' },
          ].map((apt, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-bold text-indigo-600">{apt.time}</p>
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
                <Button size="sm" variant="secondary" className="mt-1">
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
