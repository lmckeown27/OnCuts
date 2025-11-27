import { useNavigate } from 'react-router-dom';
import { UserCircle, Shield, Users } from 'lucide-react';
import { CampusCutsLogo } from '@assets';

export default function RoleSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-24 w-auto" />
          </div>
          <p className="text-xl text-gray-600">Select Your Role</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin Button */}
          <button
            onClick={() => navigate('/admin')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="bg-primary-100 rounded-full p-6">
                <Shield className="w-12 h-12 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Admin</h2>
              <p className="text-gray-600 text-center">Manage platform and users</p>
            </div>
          </button>

          {/* Consumer Button */}
          <button
            onClick={() => navigate('/consumer')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="bg-primary-100 rounded-full p-6">
                <Users className="w-12 h-12 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Consumer</h2>
              <p className="text-gray-600 text-center">Book barber appointments</p>
            </div>
          </button>

          {/* Barber Button */}
          <button
            onClick={() => navigate('/barber')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer border-2 border-transparent hover:border-primary-500"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="bg-primary-100 rounded-full p-6">
                <UserCircle className="w-12 h-12 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Barber</h2>
              <p className="text-gray-600 text-center">Manage your business</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

