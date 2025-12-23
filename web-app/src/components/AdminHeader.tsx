/**
 * Admin Header Component
 * 
 * Consistent header with profile dropdown for all admin pages
 * Includes "How Payments Work" info modal with smooth animations
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  School, 
  Activity, 
  CreditCard, 
  TrendingUp, 
  Shield, 
  LogOut,
  HelpCircle,
  X,
  DollarSign,
  ArrowLeft
} from 'lucide-react';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  title: string;
}

export default function AdminHeader({ title }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  // Handle modal open animation
  const openModal = () => {
    setIsModalOpen(true);
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsModalVisible(true);
      });
    });
  };

  // Handle modal close animation
  const closeModal = () => {
    setIsModalVisible(false);
    // Wait for animation to complete before removing from DOM
    setTimeout(() => {
      setIsModalOpen(false);
    }, 200);
  };

  // Determine platform prefix based on current route
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';

  const menuItems = [
    {
      id: 'campuses',
      label: 'Campus Management',
      icon: School,
      color: 'text-primary-400',
      path: `${platformPrefix}/admin`,
    },
    {
      id: 'system',
      label: 'System Health Monitor',
      icon: Activity,
      color: 'text-green-600',
      path: `${platformPrefix}/admin/system-health`,
    },
    {
      id: 'payments',
      label: 'Payments & Transactions',
      icon: CreditCard,
      color: 'text-blue-600',
      path: `${platformPrefix}/admin/payments`,
    },
    {
      id: 'marketplace',
      label: 'Marketplace Engine',
      icon: TrendingUp,
      color: 'text-purple-600',
      path: `${platformPrefix}/admin/marketplace`,
    },
    {
      id: 'fraud',
      label: 'Fraud Detection',
      icon: Shield,
      color: 'text-red-600',
      path: `${platformPrefix}/admin/fraud`,
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setShowProfileDropdown(false);
  };

  return (
    <>
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo - centered on mobile, left on desktop */}
            <div className="flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 sm:gap-4">
              <img src={CampusCutLogo} alt="CampusCut" className="h-8 sm:h-10 w-auto" />
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 hidden sm:block">{title}</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* How Payments Work Button */}
              <button
                onClick={openModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                title="How Payments Work"
              >
                <HelpCircle className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-primary-700 hidden sm:inline">How Payments Work</span>
              </button>

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
                      onClick={() => handleNavigation(`${platformPrefix}/admin-role-select`)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <ArrowLeft className="w-4 h-4 text-gray-500" />
                      Back to Roles
                    </button>
                    
                    <button
                      onClick={() => {
                        useAuthStore.getState().logout();
                        navigate(`${platformPrefix}`);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How Payments Work Modal */}
      {isModalOpen && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-200 ease-out ${
            isModalVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          onClick={closeModal}
        >
          <div 
            className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out ${
              isModalVisible 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-green-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">How Payments Work</h2>
              </div>
              <button
                onClick={closeModal}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-5">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Student Books & Pays</h4>
                    <p className="text-sm text-gray-600">
                      Student pays via credit/debit card through Stripe. Payment is securely processed and held in platform escrow.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Escrow & Platform Fee (5%)</h4>
                    <p className="text-sm text-gray-600">
                      The platform automatically deducts a 5% fee. Remaining 95% is held in escrow until service completion.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Service Completed</h4>
                    <p className="text-sm text-gray-600">
                      After the haircut, the barber marks the booking as complete. Funds are released from escrow to the barber's Stripe Connect account.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Barber Receives Payout</h4>
                    <p className="text-sm text-gray-600">
                      Barber receives earnings directly to their connected bank account via Stripe Connect (typically within 2 business days).
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={closeModal}
                className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
