import { useNavigate } from 'react-router-dom';
import { UserCircle, ArrowLeft, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

export default function BarberPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Barber Dashboard</h1>
          </div>
          <Button onClick={() => navigate('/')} variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
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

        <Card className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Appointments</h2>
          <div className="space-y-4">
            {[
              { time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade' },
              { time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim' },
              { time: '2:00 PM', client: 'Chris Lee', service: 'Full Service' },
            ].map((apt, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{apt.client}</p>
                  <p className="text-sm text-gray-600">{apt.service}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">{apt.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

