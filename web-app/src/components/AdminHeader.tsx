/**
 * Admin Header Component
 * 
 * Consistent header with profile dropdown for all admin pages
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, School, Activity, Fuel, TrendingUp, Shield, LogOut } from 'lucide-react';
import { CampusCutLogo } from '@assets';

interface Props {
  title: string;
}

export default function AdminHeader({ title }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const menuItems = [
    {
      id: 'campuses',
      label: 'Campus Management',
      icon: School,
      color: 'text-primary-400',
      path: '/admin',
    },
    {
      id: 'system',
      label: 'System Health Monitor',
      icon: Activity,
      color: 'text-green-600',
      path: '/admin/system-health',
    },
    {
      id: 'gas',
      label: 'Gas Wallet Monitor',
      icon: Fuel,
      color: 'text-orange-600',
      path: '/admin/gas-wallet',
    },
    {
      id: 'marketplace',
      label: 'Marketplace Engine',
      icon: TrendingUp,
      color: 'text-purple-600',
      path: '/admin/marketplace',
    },
    {
      id: 'fraud',
      label: 'Fraud Detection',
      icon: Shield,
      color: 'text-red-600',
      path: '/admin/fraud',
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setShowProfileDropdown(false);
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={CampusCutLogo} alt="CampusCut" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
          
          {/* Admin Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-semibold">
                A
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Admin Tools</p>
                </div>
                
                {menuItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-3 transition-colors ${
                        isActive ? 'bg-primary-50 text-primary-400 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-primary-400' : item.color}`} />
                      {item.label}
                    </button>
                  );
                })}
                
                <div className="border-t border-gray-200 my-1"></div>
                
                <button
                  onClick={() => handleNavigation('/web')}
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
  );
}

