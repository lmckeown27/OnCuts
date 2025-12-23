import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Shield, Users, ArrowLeft } from 'lucide-react';
import { CampusCutLogo } from '@assets';

interface RoleSelectionPageProps {
  platform?: 'web' | 'app';
}

export default function RoleSelectionPage({ platform = 'web' }: RoleSelectionPageProps) {
  const navigate = useNavigate();

  const platformInfo = {
    web: { prefix: '/web' },
    app: { prefix: '/app' },
  };

  const info = platformInfo[platform];
  
  // Helper function to navigate within the current platform
  const navigateTo = (route: string) => {
    navigate(`${info.prefix}${route}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-2xl">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={CampusCutLogo} alt="CampusCut" className="h-24 w-auto" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to CampusCut</h1>
          <p className="text-xl text-gray-600">Select Your Role</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin Button */}
          <button
            onClick={() => navigateTo('/admin')}
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
            onClick={() => navigateTo('/consumer')}
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
            onClick={() => navigateTo('/barber')}
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

