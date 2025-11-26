import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Users, TrendingUp, Settings } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

export default function AdminPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
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
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">1,234</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-full p-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Barbers</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 rounded-full p-3">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Bookings Today</p>
                <p className="text-2xl font-bold text-gray-900">89</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Controls</h2>
          <p className="text-gray-600">Platform management features will appear here.</p>
        </Card>
      </div>
    </div>
  );
}

