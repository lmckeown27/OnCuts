/**
 * Barber Dashboard Page - Version 4.0 (Cache Buster)
 * Last updated: 2025-12-18 00:15:00
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, Award, Scissors, Inbox, Shield, MapPin, MessageCircle, MessageSquare, Search, Filter, X, Clock, Zap, ArrowLeft } from 'lucide-react';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import Card from '../components/Card';
import TimePickerDropdown from '../components/TimePickerDropdown';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusManagerBadge } from '../components/CampusManagerBadge';
import { CampusManagerDashboard } from '../components/CampusManagerDashboard';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
import WalkInPaymentModal from '../components/WalkInPaymentModal';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';
import { useViewport, useBodyScrollLock } from '../hooks';
import toast from 'react-hot-toast';

const COMPONENT_VERSION = 'v4.0-modal-fix';

export default function BarberPage() {
  console.log('🚀 BarberPage loaded -', COMPONENT_VERSION);
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  
  // Viewport detection for responsive behavior
  const { isMobile, isTablet, viewport } = useViewport();
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  // Modal states with visibility for animations
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isProfileEditorVisible, setIsProfileEditorVisible] = useState(false);
  
  const [showServiceSpecialties, setShowServiceSpecialties] = useState(false);
  const [isServiceSpecialtiesVisible, setIsServiceSpecialtiesVisible] = useState(false);
  
  const [showPricingDashboard, setShowPricingDashboard] = useState(false);
  const [isPricingDashboardVisible, setIsPricingDashboardVisible] = useState(false);
  
  const [showCampusManagerDashboard, setShowCampusManagerDashboard] = useState(false);
  const [isCampusManagerVisible, setIsCampusManagerVisible] = useState(false);
  
  const [showServiceHistory, setShowServiceHistory] = useState(false);
  const [isServiceHistoryVisible, setIsServiceHistoryVisible] = useState(false);
  
  const [showAvailability, setShowAvailability] = useState(false);
  
  const [showWalkInPayment, setShowWalkInPayment] = useState(false);
  const [isAvailabilityVisible, setIsAvailabilityVisible] = useState(false);
  
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  // Lock body scroll when any modal is open
  const isAnyModalOpen = showProfileEditor || showServiceSpecialties || showPricingDashboard || showCampusManagerDashboard || showServiceHistory || showAvailability || showServiceDetails || showWalkInPayment;
  useBodyScrollLock(isAnyModalOpen);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Generic modal animation helpers
  const openModal = (setShow: (v: boolean) => void, setVisible: (v: boolean) => void) => {
    setShow(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisible(true);
      });
    });
  };

  const closeModal = (setShow: (v: boolean) => void, setVisible: (v: boolean) => void) => {
    setVisible(false);
    setTimeout(() => {
      setShow(false);
    }, 150);
  };

  // Modal open/close handlers
  const openProfileEditor = () => openModal(setShowProfileEditor, setIsProfileEditorVisible);
  const closeProfileEditor = () => closeModal(setShowProfileEditor, setIsProfileEditorVisible);
  
  const openServiceSpecialties = () => openModal(setShowServiceSpecialties, setIsServiceSpecialtiesVisible);
  const closeServiceSpecialties = () => closeModal(setShowServiceSpecialties, setIsServiceSpecialtiesVisible);
  
  const openPricingDashboard = () => openModal(setShowPricingDashboard, setIsPricingDashboardVisible);
  const closePricingDashboard = () => closeModal(setShowPricingDashboard, setIsPricingDashboardVisible);
  
  const openCampusManager = () => openModal(setShowCampusManagerDashboard, setIsCampusManagerVisible);
  const closeCampusManager = () => closeModal(setShowCampusManagerDashboard, setIsCampusManagerVisible);
  
  const openServiceHistory = () => openModal(setShowServiceHistory, setIsServiceHistoryVisible);
  const closeServiceHistory = () => closeModal(setShowServiceHistory, setIsServiceHistoryVisible);
  
  const openAvailability = () => openModal(setShowAvailability, setIsAvailabilityVisible);
  const closeAvailability = () => closeModal(setShowAvailability, setIsAvailabilityVisible);
  
  // Get barber data from auth - in production this would come from API
  const { user } = useAuthStore();
  const barberId = user?.id || '';
  const isCampusManager = false; // TODO: Fetch from API based on user role
  const campusId = user?.campus_id || '';
  const campusName = ''; // TODO: Fetch campus name from API

  // Appointment details will be fetched from API
  const appointmentDetailsData: Record<string, any> = {};

  // Function to open service details modal [v3.0]
  const openServiceDetails = (appointmentId: string) => {
    console.log('🔍 Opening service details for appointment:', appointmentId);
    const appointmentData = appointmentDetailsData[appointmentId];
    if (appointmentData) {
      setSelectedAppointment(appointmentData);
      setShowServiceDetails(true);
      console.log('✅ Modal opened with data:', appointmentData);
    } else {
      console.error('❌ No appointment data found for ID:', appointmentId);
    }
  };

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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between relative">
            {/* Left section - Switch to Consumer */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Switch to Consumer - always on left */}
              <button
                onClick={() => navigate(`${platformPrefix}/consumer`)}
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                title="Switch to Consumer view"
              >
                <Calendar className="w-4 h-4 text-primary-600" />
                <span className="hidden sm:inline text-sm font-medium text-primary-700">Switch to Consumer</span>
              </button>
            </div>
            
            {/* Center section - Logo always centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img src={CampusCutLogo} alt="CampusCut" className="h-10 sm:h-12 w-auto" />
            </div>
            
            {/* Right section - Messages, Booking Requests + Profile */}
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Messages Button */}
              <button
                onClick={() => navigate(`${platformPrefix}/barber/messages`)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                title="Messages"
              >
                <MessageCircle className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Booking Requests Inbox */}
              <BarberBookingRequestsDropdown barberId={barberId} />

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Avatar src={user?.profile_picture_url} alt={user?.first_name || 'Barber'} size="md" />
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-w-[calc(100vw-2rem)]">
                  <button
                    onClick={() => {
                      openProfileEditor();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      openServiceSpecialties();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Scissors className="w-4 h-4 text-gray-500" />
                    My Services
                  </button>
                  <button
                    onClick={() => {
                      openServiceHistory();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Service History
                  </button>
                  <button
                    onClick={() => {
                      openAvailability();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Clock className="w-4 h-4 text-gray-500" />
                    Availability
                  </button>
                  <button
                    onClick={() => {
                      openPricingDashboard();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Award className="w-4 h-4 text-gray-500" />
                    Performance & Pricing
                  </button>
                  
                  {/* Campus Manager Option (conditional) */}
                  {isCampusManager && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          openCampusManager();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                      >
                        <Shield className="w-4 h-4 text-primary-600" />
                        Campus Manager
                      </button>
                    </>
                  )}
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  {(user?.user_type === 'admin' || user?.is_admin) && (
                    <button
                      onClick={() => {
                        navigate(`${platformPrefix}/admin-role-select`);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <ArrowLeft className="w-4 h-4 text-gray-500" />
                      Back to Roles
                    </button>
                  )}
                  <button
                    onClick={() => {
                      useAuthStore.getState().logout();
                      navigate('/web');
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

      {/* Content - Combined Dashboard & Requests */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <DashboardView navigate={navigate} barberId={barberId} onViewDetails={openServiceDetails} onWalkInClick={() => setShowWalkInPayment(true)} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isProfileEditorVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeProfileEditor}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto transition-all duration-150 ease-out
              ${isProfileEditorVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={closeProfileEditor}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <BarberProfileEditor userId={barberId} onClose={closeProfileEditor} />
            </div>
          </div>
        </div>
      )}

      {/* Service Specialties Modal */}
      {showServiceSpecialties && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isServiceSpecialtiesVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeServiceSpecialties}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto transition-all duration-150 ease-out
              ${isServiceSpecialtiesVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">My Services & Pricing</h2>
              <button
                onClick={closeServiceSpecialties}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
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
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isPricingDashboardVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closePricingDashboard}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto transition-all duration-150 ease-out
              ${isPricingDashboardVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Performance & Pricing</h2>
              <button
                onClick={closePricingDashboard}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <BarberPricingDashboard barberId={barberId} />
            </div>
          </div>
        </div>
      )}

      {/* Campus Manager Dashboard Modal (conditional) */}
      {isCampusManager && showCampusManagerDashboard && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isCampusManagerVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeCampusManager}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto transition-all duration-150 ease-out
              ${isCampusManagerVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Campus Manager Dashboard</h2>
              <button
                onClick={closeCampusManager}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <CampusManagerDashboard campusId={campusId} campusName={campusName} />
            </div>
          </div>
        </div>
      )}

      {/* Service Details Modal */}
      {selectedAppointment && (
        <ServiceDetailsModal
          isOpen={showServiceDetails}
          onClose={() => {
            setShowServiceDetails(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
        />
      )}

      {/* Service History Modal */}
      {showServiceHistory && (
        <ServiceHistoryModal 
          isVisible={isServiceHistoryVisible} 
          onClose={closeServiceHistory} 
        />
      )}

      {/* Availability Modal */}
      {showAvailability && (
        <AvailabilityModal 
          isVisible={isAvailabilityVisible} 
          onClose={closeAvailability}
          userId={user?.id}
        />
      )}

      {/* Walk-in Payment Modal */}
      <WalkInPaymentModal
        isOpen={showWalkInPayment}
        onClose={() => setShowWalkInPayment(false)}
        barberName="Marcus"
      />
    </div>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
  onViewDetails: (appointmentId: string) => void;
  onWalkInClick: () => void;
}

function DashboardView({ navigate, barberId, onViewDetails, onWalkInClick }: DashboardViewProps) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  
  // Viewport detection for responsive layout
  const { isMobile, isMobilePortrait, isTablet } = useViewport();

  // Touch/swipe state for switching views
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastWheelTime = useRef<number>(0);

  const views: ('daily' | 'weekly' | 'monthly')[] = ['daily', 'weekly', 'monthly'];
  
  const switchToNextView = () => {
    const currentIndex = views.indexOf(scheduleView);
    if (currentIndex < views.length - 1) {
      setScheduleView(views[currentIndex + 1]);
    }
  };

  const switchToPrevView = () => {
    const currentIndex = views.indexOf(scheduleView);
    if (currentIndex > 0) {
      setScheduleView(views[currentIndex - 1]);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Only trigger if horizontal swipe is dominant and significant (>50px)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swipe left -> next view
        switchToNextView();
      } else {
        // Swipe right -> previous view
        switchToPrevView();
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Use native wheel event listener to properly prevent browser back/forward navigation
  useEffect(() => {
    const container = scheduleContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only respond to horizontal scroll (deltaX) which is 2-finger swipe on trackpad
      if (Math.abs(e.deltaX) > 30 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Prevent browser back/forward navigation
        e.preventDefault();
        
        // Debounce to prevent rapid switching
        const now = Date.now();
        if (now - lastWheelTime.current < 300) return;
        
        lastWheelTime.current = now;
        if (e.deltaX > 0) {
          // Scroll right -> next view
          setScheduleView(prev => {
            const idx = views.indexOf(prev);
            return idx < views.length - 1 ? views[idx + 1] : prev;
          });
        } else {
          // Scroll left -> previous view
          setScheduleView(prev => {
            const idx = views.indexOf(prev);
            return idx > 0 ? views[idx - 1] : prev;
          });
        }
      }
    };

    // Add with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Day modal open/close handlers with animation
  const openDayModal = (day: number) => {
    setSelectedDay(day);
    setShowDayModal(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsDayModalVisible(true);
      });
    });
  };

  const closeDayModal = () => {
    setIsDayModalVisible(false);
    setTimeout(() => {
      setShowDayModal(false);
      setSelectedDay(null);
    }, 150);
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeDayModal();
      }
    };

    if (showDayModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDayModal]);

  // Appointments will be fetched from API - for now return empty
  const getAppointmentsForDay = (_day: number): Array<{ id: string; time: string; client: string; service: string; price: string; status: string }> => {
    // TODO: Fetch from API based on barberId and date
    return [];
  };

  const handleDayClick = (day: number) => {
    openDayModal(day);
  };

  return (
    <>
      {/* Schedule Section - Top Priority */}
      <Card>
        <div 
          ref={scheduleContainerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="touch-pan-y"
        >
        <div className="flex flex-col items-center gap-3 mb-4">
          {/* Walk-in Button - always on top, matches view toggle button widths */}
          <button
            onClick={onWalkInClick}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors text-sm sm:text-base font-semibold min-w-[5rem] sm:min-w-[6rem] text-center"
            title="Quick payment for walk-in customers"
          >
            Walk-in
          </button>
          
          {/* View Toggle Buttons - centered, all same min-width */}
          <div className="flex gap-2 sm:gap-3 justify-center">
            <button
              onClick={() => setScheduleView('daily')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-colors min-w-[5rem] sm:min-w-[6rem] ${
                scheduleView === 'daily'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setScheduleView('weekly')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-colors min-w-[5rem] sm:min-w-[6rem] ${
                scheduleView === 'weekly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setScheduleView('monthly')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-colors min-w-[5rem] sm:min-w-[6rem] ${
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
        {scheduleView === 'daily' && (() => {
          // TODO: Fetch daily appointments from API
          const dailyAppointments: Array<{ id: string; time: string; client: string; service: string; price: string; status: string }> = [];

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Today - Friday, January 12, 2025</h3>
                <p className="text-sm sm:text-base text-gray-600 font-medium">{dailyAppointments.length} appointment{dailyAppointments.length !== 1 ? 's' : ''}</p>
              </div>
              {dailyAppointments.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Calendar className="w-14 h-14 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-4 sm:mb-5" />
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-base sm:text-lg text-gray-600">You have no appointments scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {dailyAppointments.map((apt, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => onViewDetails(apt.id)}
                      className="p-5 sm:p-6 bg-gray-50 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-gray-100 active:scale-98 transition-all cursor-pointer"
                    >
                      {/* Top row: Client name + Price */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="font-bold text-gray-900 text-lg sm:text-xl">{apt.client}</p>
                        <p className="font-bold text-green-600 text-xl sm:text-2xl">{apt.price}</p>
                      </div>
                      {/* Middle: Service */}
                      <p className="text-base sm:text-lg text-gray-600 mb-3">{apt.service}</p>
                      {/* Bottom row: Time */}
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-primary-400 text-base sm:text-lg">{apt.time}</p>
                        <span className="text-sm sm:text-base text-gray-500">Tap for details →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Weekly View */}
        {scheduleView === 'weekly' && (() => {
          // Week days structure
          const weekDays = [
            { name: 'Monday', date: 8, shortName: 'Mon' },
            { name: 'Tuesday', date: 9, shortName: 'Tue' },
            { name: 'Wednesday', date: 10, shortName: 'Wed' },
            { name: 'Thursday', date: 11, shortName: 'Thu' },
            { name: 'Friday', date: 12, shortName: 'Fri' },
            { name: 'Saturday', date: 13, shortName: 'Sat' },
            { name: 'Sunday', date: 14, shortName: 'Sun' },
          ];

          // TODO: Fetch weekly appointments from API
          const weekAppointmentNames: { [date: number]: string[] } = {};

          const totalWeekAppointments = Object.values(weekAppointmentNames).reduce((sum, arr) => sum + arr.length, 0);

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Week of January 8 - 14, 2025</h3>
                <p className="text-sm sm:text-base text-gray-600 font-medium">{totalWeekAppointments} appointments this week</p>
              </div>
              
              {/* Mobile: List view */}
              <div className="sm:hidden space-y-2">
                {weekDays.map(day => {
                  const appointments = weekAppointmentNames[day.date] || [];
                  const isToday = day.date === 12;

                  return (
                    <div
                      key={day.date}
                      onClick={() => handleDayClick(day.date)}
                      className={`flex items-center justify-between p-4 rounded-xl border active:scale-98 transition-all ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200'
                      } cursor-pointer`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-3xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.date}</div>
                        <div>
                          <div className={`font-semibold text-base ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.name}</div>
                          <div className={`text-sm ${isToday ? 'text-white/70' : 'text-gray-500'}`}>
                            {appointments.length === 0 ? 'No appointments' : `${appointments.length} appointment${appointments.length > 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-6 h-6 -rotate-90 ${isToday ? 'text-white/70' : 'text-gray-400'}`} />
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Grid view */}
              <div className="hidden sm:grid grid-cols-7 gap-4">
                {/* Week day headers */}
                {weekDays.map(day => (
                  <div key={day.date} className="text-center font-bold text-gray-600 text-base py-2">
                    {day.shortName}
                  </div>
                ))}
                {/* Week day cards */}
                {weekDays.map(day => {
                  const appointments = weekAppointmentNames[day.date] || [];
                  const isToday = day.date === 12;

                  return (
                    <div
                      key={day.date}
                      onClick={() => handleDayClick(day.date)}
                      className={`p-5 rounded-xl border overflow-hidden min-h-[160px] flex flex-col ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer transition-colors`}
                    >
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold mb-1">{day.date}</div>
                        <div className={`text-sm ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                          {day.name}
                        </div>
                      </div>
                      <div className="text-sm space-y-1.5 flex-1 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : (
                          <>
                            <div className="truncate font-semibold">{appointments[0]}</div>
                            {appointments.length > 1 && (
                              <>
                                <div className="truncate">{appointments[1]}</div>
                                {appointments.length > 2 && (
                                  <div className={isToday ? 'text-white/80 font-bold' : 'text-gray-500 font-bold'}>
                                    +{appointments.length - 2} more
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Monthly View */}
        {scheduleView === 'monthly' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">January 2025</h3>
              <p className="text-sm sm:text-base text-gray-600 font-medium">0 appointments this month</p>
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {/* Calendar header */}
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center font-bold text-gray-600 text-sm sm:text-base py-2 sm:py-3">
                  <span className="sm:hidden">{day}</span>
                  <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
              {/* Calendar days */}
              {(() => {
                // TODO: Fetch monthly appointments from API
                const monthAppointments: { [day: number]: string[] } = {};

                return Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const appointments = monthAppointments[day] || [];
                  const hasAppointments = appointments.length > 0;
                  
                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`aspect-square p-1.5 sm:p-3 rounded-lg sm:rounded-xl border overflow-hidden ${
                        day === 12 
                          ? 'bg-primary-400 text-white border-primary-500' 
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer active:scale-95 transition-all`}
                    >
                      <div className="text-sm sm:text-base font-bold mb-0.5 sm:mb-1">{day}</div>
                      {/* Mobile: Show +X bookings count */}
                      <div className="sm:hidden flex justify-center">
                        {hasAppointments && (
                          <div className={`text-base font-bold ${day === 12 ? 'text-white' : 'text-primary-500'}`}>
                            +{appointments.length}
                          </div>
                        )}
                      </div>
                      {/* Desktop: Show names */}
                      <div className="hidden sm:block text-sm space-y-0.5 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className="text-gray-400">No apts</div>
                        ) : appointments.length === 1 ? (
                          <div className="truncate font-medium">{appointments[0]}</div>
                        ) : (
                          <>
                            <div className="truncate font-medium">{appointments[0]}</div>
                            <div className={`font-semibold ${day === 12 ? 'text-white/80' : 'text-gray-500'}`}>
                              +{appointments.length - 1} more
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* View indicator dots at bottom for swipe hint - mobile only */}
        <div className="flex justify-center gap-2 mt-4 sm:hidden">
          {views.map((view) => (
            <div
              key={view}
              className={`w-2 h-2 rounded-full transition-colors ${
                scheduleView === view ? 'bg-primary-400' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        </div>
      </Card>

      {/* Day Detail Modal */}
      {showDayModal && selectedDay !== null && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
            isDayModalVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          onClick={closeDayModal}
        >
          <div 
            ref={modalRef} 
            className={`bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden transition-all duration-150 ease-out ${
              isDayModalVisible 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-primary-400 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">January {selectedDay}, 2025</h2>
                  <p className="text-white/80">
                    {getAppointmentsForDay(selectedDay).length} appointment{getAppointmentsForDay(selectedDay).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={closeDayModal}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {getAppointmentsForDay(selectedDay).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-gray-600">You have no appointments scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAppointmentsForDay(selectedDay).map((apt, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        closeDayModal();
                        onViewDetails(apt.id);
                      }}
                      className="p-5 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      {/* Top row: Client name + Price */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="font-bold text-gray-900 text-lg">{apt.client}</p>
                        <p className="font-bold text-green-600 text-xl">{apt.price}</p>
                      </div>
                      {/* Middle: Service */}
                      <p className="text-base text-gray-600 mb-3">{apt.service}</p>
                      {/* Bottom row: Time */}
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-primary-400 text-base">{apt.time}</p>
                        <span className="text-sm text-gray-500">Tap for details →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Service History Modal Component
function ServiceHistoryModal({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'cancelled' | 'no-show'>('all');

  // TODO: Fetch service history from API
  const serviceHistory: Array<{
    id: string;
    date: string;
    time: string;
    customerName: string;
    serviceType: string;
    location: string;
    price: number;
    status: 'completed' | 'cancelled' | 'no-show';
    rating?: number;
    review?: string;
  }> = [];

  const filteredServices = serviceHistory.filter((service) => {
    const matchesSearch = service.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.serviceType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || service.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: serviceHistory.length,
    completed: serviceHistory.filter(s => s.status === 'completed').length,
    avgRating: serviceHistory.filter(s => s.rating).reduce((sum, s) => sum + (s.rating || 0), 0) / serviceHistory.filter(s => s.rating).length,
    totalEarned: serviceHistory.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.price, 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-yellow-100 text-yellow-700';
      case 'no-show': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 text-white px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">Service History</h2>
            <p className="text-white/80 text-sm">{stats.total} total services</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No-show</option>
            </select>
          </div>
        </div>

        {/* Service List */}
        <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-6">
          {filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No services found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices.map((service) => (
                <div key={service.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-primary-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{service.customerName}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(service.status)}`}>
                          {service.status.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(service.date).toLocaleDateString()} at {service.time}
                        </span>
                        <span>•</span>
                        <span className="font-medium">{service.serviceType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${service.price.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <MapPin className="w-3 h-3" />
                    <span>{service.location}</span>
                  </div>

                  {service.review && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-sm text-green-800 italic">"{service.review}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Availability Modal Component
function AvailabilityModal({ isVisible, onClose, userId }: { isVisible: boolean; onClose: () => void; userId?: string }) {
  const [availability, setAvailability] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '10:00', end: '16:00' },
    sunday: { enabled: false, start: '10:00', end: '16:00' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [barberId, setBarberId] = useState<string | null>(null);

  // Load barber's current weekly schedule when modal opens
  useEffect(() => {
    if (isVisible && userId) {
      loadSchedule();
    }
  }, [isVisible, userId]);

  const loadSchedule = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/barbers/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setBarberId(data.data.id);
          if (data.data.weekly_schedule) {
            setAvailability(data.data.weekly_schedule);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ] as const;

  const handleToggleDay = (day: keyof typeof availability) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled }
    }));
  };

  const handleTimeChange = (day: keyof typeof availability, field: 'start' | 'end', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSave = async () => {
    if (!barberId) {
      console.error('No barber ID found');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/barbers/${barberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ weekly_schedule: availability }),
      });
      
      if (response.ok) {
        toast.success('Availability saved!');
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || 'Failed to save availability');
      }
    } catch (error) {
      console.error('Failed to save availability:', error);
      toast.error('Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${isVisible ? 'bg-black/50' : 'bg-black/0'}`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Availability</h2>
            <p className="text-white/80 text-sm">Set your working hours</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-4">
            {days.map(({ key, label }) => (
              <div 
                key={key}
                className={`p-4 rounded-xl border-2 transition-all ${
                  availability[key].enabled 
                    ? 'border-primary-200 bg-primary-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-semibold ${availability[key].enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                    {label}
                  </span>
                  <button
                    onClick={() => handleToggleDay(key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      availability[key].enabled ? 'bg-primary-400' : 'bg-gray-300'
                    }`}
                  >
                    <span 
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        availability[key].enabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                
                {availability[key].enabled && (
                  <div className="flex items-center gap-3">
                    <TimePickerDropdown
                      label="Start"
                      value={availability[key].start}
                      onChange={(value) => handleTimeChange(key, 'start', value)}
                      maxTime={availability[key].end}
                      className="flex-1"
                    />
                    <span className="text-gray-400 mt-5">to</span>
                    <TimePickerDropdown
                      label="End"
                      value={availability[key].end}
                      onChange={(value) => handleTimeChange(key, 'end', value)}
                      minTime={availability[key].start}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Availability'}
          </Button>
        </div>
      </div>
    </div>
  );
}
