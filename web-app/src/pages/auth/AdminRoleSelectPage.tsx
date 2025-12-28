import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Scissors, User, ArrowRight, Crown, Users } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import TabChairLogo from '../../assets/logos/Tab_Chair.webp';

interface RoleOption {
  id: 'admin' | 'campus_manager' | 'barber' | 'consumer';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  route: string;
}

const roleOptions: RoleOption[] = [
  {
    id: 'admin',
    title: 'Administrator',
    description: 'Manage campuses, users, system health, and platform settings',
    icon: <Shield className="w-8 h-8" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200 hover:border-purple-400',
    route: '/web/admin'
  },
  {
    id: 'campus_manager',
    title: 'Campus Manager',
    description: 'Review barber applications, manage campus barbers, and view campus metrics',
    icon: <Users className="w-8 h-8" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200 hover:border-blue-400',
    route: '/web/barber' // Routes to BarberPage which has embedded campus manager features
  },
  {
    id: 'barber',
    title: 'Barber',
    description: 'Manage appointments, earnings, availability, and client communications',
    icon: <Scissors className="w-8 h-8" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    borderColor: 'border-amber-200 hover:border-amber-400',
    route: '/web/barber'
  },
  {
    id: 'consumer',
    title: 'Consumer',
    description: 'Browse barbers, book appointments, and manage your profile',
    icon: <User className="w-8 h-8" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    route: '/web/consumer'
  }
];

export default function AdminRoleSelectPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setActiveRole } = useAuthStore();

  // Redirect if not authenticated or not a true admin
  // Campus managers should never see this page - they go directly to /web/barber
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/web');
      return;
    }
    
    // Only true admins can access this page
    if (user && !user.is_admin) {
      // Campus managers go to barber page, others go to their respective dashboards
      if (user.is_campus_manager || user.user_type === 'campus_manager') {
        navigate('/web/barber');
      } else if (user.user_type === 'barber') {
        navigate('/web/barber');
      } else {
        navigate('/web/consumer');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleRoleSelect = (role: RoleOption) => {
    // Set the active role in state (for UI purposes)
    if (setActiveRole) {
      setActiveRole(role.id);
    }
    navigate(role.route);
  };

  // Only true admins should see this page
  if (!user?.is_admin) {
    return null; // Will redirect in useEffect
  }

  // Admins see all roles
  const availableRoles = roleOptions;

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ backgroundColor: '#022b19' }}
    >
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Link to="/" className="hover:opacity-80 active:scale-95 transition-all duration-150">
            <img 
              src={TabChairLogo} 
              alt="CampusCut Logo" 
              className="h-16 w-auto mb-4"
            />
          </Link>
          
          {/* Role Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full mb-4 bg-purple-500/20">
            <Crown className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-purple-300">Administrator Access</span>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Welcome, {user?.first_name}!
          </h1>
          <p className="text-gray-300 text-center">
            Select a role to access the platform
          </p>
        </div>

        {/* Role Selection Card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl p-8"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">
            Choose Your View
          </h2>

          <div className="space-y-4">
            {availableRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role)}
                className={`w-full p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 text-left group ${role.bgColor} ${role.borderColor}`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center ${role.color}`}>
                  {role.icon}
                </div>
                
                {/* Content */}
                <div className="flex-grow">
                  <h3 className={`font-semibold text-lg ${role.color}`}>
                    {role.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    {role.description}
                  </p>
                </div>
                
                {/* Arrow */}
                <ArrowRight className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-1 ${role.color}`} />
              </button>
            ))}
          </div>

          {/* Info Note */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              <strong>Tip:</strong> As an administrator, you have full access to all platform features. 
              You can switch between roles at any time.
            </p>
          </div>
        </div>

        {/* Logout Link */}
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              useAuthStore.getState().logout();
              navigate('/web');
            }}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

