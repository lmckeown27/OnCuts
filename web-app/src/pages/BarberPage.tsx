/**
 * Barber Dashboard Page - Version 4.0 (Cache Buster)
 * Last updated: 2025-12-18 00:15:00
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, Award, Scissors, Inbox, Shield, Star, MapPin, MessageSquare, Search, Filter, X } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberPricingDashboard from '../components/BarberPricingDashboard';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusManagerBadge } from '../components/CampusManagerBadge';
import { CampusManagerDashboard } from '../components/CampusManagerDashboard';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';
import { useViewport } from '../hooks/useViewport';

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
  
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
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
  
  // Mock barber data - in production this would come from API
  const barberId = 'barber-1';
  const isCampusManager = true; // TODO: Fetch from API
  const campusId = 'campus-1';
  const campusName = 'California Polytechnic State University';

  // Mock appointment details data
  const appointmentDetailsData: Record<string, any> = {
    '1': {
      id: '1',
      time: '10:00 AM',
      date: 'Today, Friday, January 12, 2025',
      client: {
        name: 'John Doe',
        email: 'john.doe@college.edu',
        phone: '(555) 123-4567',
        studentId: 'STU-2024-001',
        totalBookings: 12,
        completedBookings: 11,
        cancelledBookings: 1,
        reliabilityScore: 92,
        avgRating: 4.7,
      },
      service: {
        name: 'Haircut & Fade',
        duration: '45 min',
        notes: 'Looking for a mid-fade with texture on top, similar to last time',
      },
      location: {
        type: 'My Dorm',
        address: 'Yosemite Hall, Room 304',
        instructions: 'Third floor, take elevator. Will meet you in lobby.',
      },
      price: {
        service: 35.00,
        platformFee: 1.75,
        total: 36.75,
        paymentMethod: 'Escrow (Blockchain)',
      },
      status: 'confirmed',
      bookedAt: '2 hours ago',
      blockchainTx: '0x7f8a...3d2c',
    },
    '2': {
      id: '2',
      time: '11:30 AM',
      date: 'Today, Friday, January 12, 2025',
      client: {
        name: 'Mike Smith',
        email: 'mike.smith@college.edu',
        phone: '(555) 234-5678',
        studentId: 'STU-2024-002',
        totalBookings: 8,
        completedBookings: 8,
        cancelledBookings: 0,
        reliabilityScore: 100,
        avgRating: 5.0,
      },
      service: {
        name: 'Beard Trim',
        duration: '20 min',
        notes: 'Clean up the edges, keep it natural looking',
      },
      location: {
        type: 'Student Union',
        address: 'UU Plaza, 2nd Floor Lounge',
        instructions: 'Near the food court, will be at the corner table.',
      },
      price: {
        service: 23.00,
        platformFee: 1.15,
        total: 24.15,
        paymentMethod: 'Escrow (Blockchain)',
      },
      status: 'confirmed',
      bookedAt: '3 hours ago',
      blockchainTx: '0x9a2b...4e5f',
    },
    '3': {
      id: '3',
      time: '2:00 PM',
      date: 'Today, Friday, January 12, 2025',
      client: {
        name: 'Chris Lee',
        email: 'chris.lee@college.edu',
        phone: '(555) 345-6789',
        studentId: 'STU-2024-003',
        totalBookings: 5,
        completedBookings: 4,
        cancelledBookings: 1,
        reliabilityScore: 80,
        avgRating: 4.5,
      },
      service: {
        name: 'Full Service',
        duration: '60 min',
        notes: 'Haircut, beard trim, and hot towel shave. First time here!',
      },
      location: {
        type: 'Off-Campus Apartment',
        address: 'The Grove Apartments, Unit 204B',
        instructions: 'Use the west entrance, building 2. Parking available.',
      },
      price: {
        service: 45.00,
        platformFee: 2.25,
        total: 47.25,
        paymentMethod: 'Escrow (Blockchain)',
      },
      status: 'pending',
      bookedAt: '30 minutes ago',
      blockchainTx: '0x3c4d...7g8h',
    },
    '4': {
      id: '4',
      time: '3:30 PM',
      date: 'Today, Friday, January 12, 2025',
      client: {
        name: 'David Brown',
        email: 'david.brown@college.edu',
        phone: '(555) 456-7890',
        studentId: 'STU-2024-004',
        totalBookings: 15,
        completedBookings: 14,
        cancelledBookings: 1,
        reliabilityScore: 93,
        avgRating: 4.8,
      },
      service: {
        name: 'Haircut',
        duration: '30 min',
        notes: 'Regular trim, same as last 3 times',
      },
      location: {
        type: 'My Dorm',
        address: 'Sierra Madre Hall, Room 512',
        instructions: 'Fifth floor, room at the end of the hall.',
      },
      price: {
        service: 28.00,
        platformFee: 1.40,
        total: 29.40,
        paymentMethod: 'Escrow (Blockchain)',
      },
      status: 'confirmed',
      bookedAt: '1 day ago',
      blockchainTx: '0x5e6f...9i0j',
    },
    '5': {
      id: '5',
      time: '5:00 PM',
      date: 'Today, Friday, January 12, 2025',
      client: {
        name: 'James Wilson',
        email: 'james.wilson@college.edu',
        phone: '(555) 567-8901',
        studentId: 'STU-2024-005',
        totalBookings: 3,
        completedBookings: 3,
        cancelledBookings: 0,
        reliabilityScore: 100,
        avgRating: 5.0,
      },
      service: {
        name: 'Haircut',
        duration: '30 min',
        notes: 'Keep it short on the sides, blend the top. Military style.',
      },
      location: {
        type: 'Recreation Center',
        address: 'Campus Rec Center, Main Lobby',
        instructions: 'Meet near the front desk after my workout.',
      },
      price: {
        service: 28.00,
        platformFee: 1.40,
        total: 29.40,
        paymentMethod: 'Escrow (Blockchain)',
      },
      status: 'confirmed',
      bookedAt: '4 hours ago',
      blockchainTx: '0x7k8l...1m2n',
    },
  };

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
            {/* Left section - Switch to Consumer on mobile, Logo + Switch on desktop */}
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
              {/* Logo - hidden on mobile (shown in center), visible on desktop */}
              <img src={CampusCutLogo} alt="CampusCut" className="hidden sm:block h-10 w-auto" />
            </div>
            
            {/* Center section - Logo on mobile only */}
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2">
              <img src={CampusCutLogo} alt="CampusCut" className="h-10 w-auto" />
            </div>
            
            {/* Right section - Booking Requests + Profile */}
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Booking Requests Inbox */}
              <BarberBookingRequestsDropdown barberId={barberId} />

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  B
                </div>
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
        <DashboardView navigate={navigate} barberId={barberId} onViewDetails={openServiceDetails} />
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={closeProfileEditor}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <BarberProfileEditor barberId={barberId} />
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Campus Manager Dashboard</h2>
              </div>
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
    </div>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
  onViewDetails: (appointmentId: string) => void;
}

function DashboardView({ navigate, barberId, onViewDetails }: DashboardViewProps) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Viewport detection for responsive layout
  const { isMobile, isMobilePortrait, isTablet } = useViewport();

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

  // Mock detailed appointment data by day
  const getAppointmentsForDay = (day: number) => {
    const appointments: { [day: number]: Array<{ id: string; time: string; client: string; service: string; price: string; status: string }> } = {
      1: [
        { id: '1', time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { id: '2', time: '2:00 PM', client: 'Sarah Miller', service: 'Full Service', price: '$45', status: 'confirmed' },
      ],
      2: [{ id: '2', time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$23', status: 'confirmed' }],
      3: [{ id: '3', time: '3:00 PM', client: 'Chris Lee', service: 'Haircut', price: '$28', status: 'pending' }],
      5: [
        { id: '4', time: '9:00 AM', client: 'David Brown', service: 'Haircut', price: '$28', status: 'confirmed' },
        { id: '5', time: '10:00 AM', client: 'James Wilson', service: 'Fade', price: '$30', status: 'confirmed' },
        { id: '1', time: '11:00 AM', client: 'Robert Taylor', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { id: '3', time: '1:00 PM', client: 'Michael Davis', service: 'Full Service', price: '$45', status: 'confirmed' },
        { id: '2', time: '2:30 PM', client: 'William Anderson', service: 'Beard Trim', price: '$23', status: 'confirmed' },
        { id: '4', time: '3:30 PM', client: 'Richard Thomas', service: 'Haircut', price: '$28', status: 'confirmed' },
        { id: '5', time: '4:30 PM', client: 'Joseph Jackson', service: 'Fade', price: '$30', status: 'confirmed' },
        { id: '1', time: '5:30 PM', client: 'Thomas White', service: 'Lineup', price: '$15', status: 'confirmed' },
      ],
      12: [
        { id: '1', time: '10:00 AM', client: 'Edward Evans', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
        { id: '2', time: '11:30 AM', client: 'Ronald Edwards', service: 'Beard Trim', price: '$23', status: 'confirmed' },
        { id: '3', time: '1:00 PM', client: 'Timothy Collins', service: 'Full Service', price: '$45', status: 'pending' },
        { id: '4', time: '2:30 PM', client: 'Jason Stewart', service: 'Haircut', price: '$28', status: 'confirmed' },
        { id: '5', time: '4:00 PM', client: 'Jeffrey Morris', service: 'Fade', price: '$30', status: 'confirmed' },
        { id: '1', time: '5:00 PM', client: 'Ryan Rogers', service: 'Haircut', price: '$28', status: 'confirmed' },
      ],
    };
    return appointments[day] || [];
  };

  const handleDayClick = (day: number) => {
    openDayModal(day);
  };

  return (
    <>
      {/* Schedule Section - Top Priority */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">My Schedule</h2>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setScheduleView('daily')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${
                scheduleView === 'daily'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setScheduleView('weekly')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${
                scheduleView === 'weekly'
                  ? 'bg-primary-400 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setScheduleView('monthly')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${
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
          const dailyAppointments = [
            { id: '1', time: '10:00 AM', client: 'John Doe', service: 'Haircut & Fade', price: '$35', status: 'confirmed' },
            { id: '2', time: '11:30 AM', client: 'Mike Smith', service: 'Beard Trim', price: '$23', status: 'confirmed' },
            { id: '3', time: '2:00 PM', client: 'Chris Lee', service: 'Full Service', price: '$45', status: 'pending' },
            { id: '4', time: '3:30 PM', client: 'David Brown', service: 'Haircut', price: '$28', status: 'confirmed' },
            { id: '5', time: '5:00 PM', client: 'James Wilson', service: 'Haircut', price: '$28', status: 'confirmed' },
          ];

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-3 sm:mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Today - Friday, January 12, 2025</h3>
                <p className="text-xs sm:text-sm text-gray-600">{dailyAppointments.length} appointment{dailyAppointments.length !== 1 ? 's' : ''}</p>
              </div>
              {dailyAppointments.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-sm text-gray-600">You have no appointments scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {dailyAppointments.map((apt, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 active:scale-98 transition-all gap-3 sm:gap-0">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-center min-w-[60px] sm:min-w-[80px]">
                          <p className="font-bold text-primary-400 text-sm sm:text-base">{apt.time}</p>
                          <span className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                            apt.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <div className="h-10 sm:h-12 w-px bg-gray-300 hidden sm:block"></div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm sm:text-base">{apt.client}</p>
                          <p className="text-xs sm:text-sm text-gray-600">{apt.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-0">
                        <p className="font-bold text-green-600 text-sm sm:text-base sm:mb-1">{apt.price}</p>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => onViewDetails(apt.id)}
                          className="text-xs sm:text-sm px-2 sm:px-3"
                        >
                          Details
                        </Button>
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
          // Week appointment data (January 8-14, 2025) - maps to days 8-14 from monthly calendar
          const weekDays = [
            { name: 'Monday', date: 8, shortName: 'Mon' },
            { name: 'Tuesday', date: 9, shortName: 'Tue' },
            { name: 'Wednesday', date: 10, shortName: 'Wed' },
            { name: 'Thursday', date: 11, shortName: 'Thu' },
            { name: 'Friday', date: 12, shortName: 'Fri' },
            { name: 'Saturday', date: 13, shortName: 'Sat' },
            { name: 'Sunday', date: 14, shortName: 'Sun' },
          ];

          const weekAppointmentNames: { [date: number]: string[] } = {
            8: ['Nancy Lee', 'Lisa Walker', 'Betty Hall', 'Margaret Allen', 'Sandra Young', 'Ashley Hernandez', 'Donna King', 'Carol Wright'],
            9: ['Michelle Lopez', 'Emily Hill'],
            10: ['Daniel Scott', 'Matthew Green', 'Anthony Adams', 'Mark Baker'],
            11: ['Donald Nelson', 'Steven Carter', 'Paul Mitchell', 'Andrew Perez', 'Joshua Roberts', 'Kenneth Turner', 'Kevin Phillips', 'Brian Campbell', 'George Parker'],
            12: ['Edward Evans', 'Ronald Edwards', 'Timothy Collins', 'Jason Stewart', 'Jeffrey Morris', 'Ryan Rogers'],
            13: ['Jacob Reed', 'Gary Cook', 'Nicholas Morgan', 'Eric Bell', 'Jonathan Murphy', 'Stephen Bailey', 'Larry Rivera', 'Justin Cooper', 'Scott Richardson'],
            14: ['Brandon Cox', 'Benjamin Howard', 'Samuel Ward', 'Frank Torres'],
          };

          const totalWeekAppointments = Object.values(weekAppointmentNames).reduce((sum, arr) => sum + arr.length, 0);

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-3 sm:mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Week of January 8 - 14, 2025</h3>
                <p className="text-xs sm:text-sm text-gray-600">{totalWeekAppointments} appointments this week</p>
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
                      className={`flex items-center justify-between p-3 rounded-lg border active:scale-98 transition-all ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200'
                      } cursor-pointer`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.date}</div>
                        <div>
                          <div className={`font-medium text-sm ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.name}</div>
                          <div className={`text-xs ${isToday ? 'text-white/70' : 'text-gray-500'}`}>
                            {appointments.length === 0 ? 'No appointments' : `${appointments.length} appointment${appointments.length > 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 -rotate-90 ${isToday ? 'text-white/70' : 'text-gray-400'}`} />
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Grid view */}
              <div className="hidden sm:grid grid-cols-7 gap-3">
                {/* Week day headers */}
                {weekDays.map(day => (
                  <div key={day.date} className="text-center font-semibold text-gray-600 text-sm py-2">
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
                      className={`p-4 rounded-lg border overflow-hidden min-h-[140px] flex flex-col ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer transition-colors`}
                    >
                      <div className="text-center mb-3">
                        <div className="text-2xl font-bold mb-1">{day.date}</div>
                        <div className={`text-xs ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                          {day.name}
                        </div>
                      </div>
                      <div className="text-xs space-y-1 flex-1 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : (
                          <>
                            <div className="truncate font-medium">{appointments[0]}</div>
                            {appointments.length > 1 && (
                              <>
                                <div className="truncate">{appointments[1]}</div>
                                {appointments.length > 2 && (
                                  <div className={isToday ? 'text-white/80 font-semibold' : 'text-gray-500 font-semibold'}>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-3 sm:mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">January 2025</h3>
              <p className="text-xs sm:text-sm text-gray-600">168 appointments this month</p>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Calendar header */}
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center font-semibold text-gray-600 text-xs sm:text-sm py-1 sm:py-2">
                  <span className="sm:hidden">{day}</span>
                  <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
              {/* Calendar days */}
              {(() => {
                // Mock appointment data for each day
                const monthAppointments: { [day: number]: string[] } = {
                  1: ['John Doe', 'Sarah Miller'],
                  2: ['Mike Smith'],
                  3: ['Chris Lee'],
                  4: [],
                  5: ['David Brown', 'James Wilson', 'Robert Taylor', 'Michael Davis', 'William Anderson', 'Richard Thomas', 'Joseph Jackson', 'Thomas White'],
                  6: ['Jennifer Harris', 'Linda Martin', 'Patricia Thompson'],
                  7: ['Mary Garcia', 'Barbara Martinez', 'Elizabeth Robinson', 'Susan Clark', 'Jessica Rodriguez', 'Karen Lewis'],
                  8: ['Nancy Lee', 'Lisa Walker', 'Betty Hall', 'Margaret Allen', 'Sandra Young', 'Ashley Hernandez', 'Donna King', 'Carol Wright'],
                  9: ['Michelle Lopez', 'Emily Hill'],
                  10: ['Daniel Scott', 'Matthew Green', 'Anthony Adams', 'Mark Baker'],
                  11: ['Donald Nelson', 'Steven Carter', 'Paul Mitchell', 'Andrew Perez', 'Joshua Roberts', 'Kenneth Turner', 'Kevin Phillips', 'Brian Campbell', 'George Parker'],
                  12: ['Edward Evans', 'Ronald Edwards', 'Timothy Collins', 'Jason Stewart', 'Jeffrey Morris', 'Ryan Rogers'],
                  13: ['Jacob Reed', 'Gary Cook', 'Nicholas Morgan', 'Eric Bell', 'Jonathan Murphy', 'Stephen Bailey', 'Larry Rivera', 'Justin Cooper', 'Scott Richardson'],
                  14: ['Brandon Cox', 'Benjamin Howard', 'Samuel Ward', 'Frank Torres'],
                  15: ['Raymond Peterson', 'Gregory Gray', 'Alexander Ramirez', 'Patrick James', 'Jack Watson', 'Dennis Brooks', 'Jerry Kelly', 'Tyler Sanders', 'Aaron Price'],
                  16: ['Jose Bennett', 'Adam Wood', 'Henry Barnes', 'Nathan Ross', 'Douglas Henderson', 'Zachary Coleman', 'Peter Jenkins', 'Kyle Perry'],
                  17: [],
                  18: ['Walter Powell', 'Ethan Long', 'Jeremy Patterson', 'Harold Hughes', 'Keith Flores', 'Christian Washington'],
                  19: ['Roger Butler', 'Noah Simmons', 'Gerald Foster', 'Carl Gonzales'],
                  20: ['Terry Bryant', 'Sean Alexander', 'Austin Russell', 'Arthur Griffin', 'Lawrence Diaz', 'Jesse Hayes', 'Dylan Myers', 'Bryan Ford', 'Joe Hamilton'],
                  21: ['Jordan Graham'],
                  22: ['Billy Sullivan', 'Albert Wallace', 'Bruce Woods', 'Willie Cole', 'Gabriel West', 'Logan Jordan', 'Alan Owens', 'Juan Reynolds'],
                  23: ['Wayne Fisher', 'Roy Ellis', 'Ralph Gibson', 'Randy Hunt'],
                  24: ['Eugene Crawford', 'Vincent Black', 'Russell Daniels', 'Louis Palmer', 'Philip Mills', 'Bobby Nichols', 'Johnny Grant', 'Bradley Knight', 'Howard Ferguson'],
                  25: ['Shawn Boyd', 'Harry Rose'],
                  26: ['Carlos Stone', 'Jimmy Hawkins', 'Antonio Dunn', 'Bryan Perkins', 'Albert Hudson', 'Jonathan Spencer'],
                  27: ['Craig Gardner', 'Philip Webb', 'Fred Gibson', 'Ernest Walsh', 'Todd Larson', 'Jesse Ramos'],
                  28: ['Eddie Burton', 'Leonard Hicks', 'Danny Crawford', 'Sean Henry', 'Ronnie Boyd', 'Francis Mason', 'Curtis Dixon', 'Tony Fox'],
                  29: ['Vernon Burns', 'Joel Gordon', 'Melvin Wagner'],
                  30: [],
                  31: ['Stanley Fields', 'Leslie Berry'],
                };

                return Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const appointments = monthAppointments[day] || [];
                  const hasAppointments = appointments.length > 0;
                  
                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`aspect-square p-1 sm:p-2 rounded-md sm:rounded-lg border overflow-hidden ${
                        day === 12 
                          ? 'bg-primary-400 text-white border-primary-500' 
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer active:scale-95 transition-all`}
                    >
                      <div className="text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1">{day}</div>
                      {/* Mobile: Show +X bookings count */}
                      <div className="sm:hidden flex justify-center">
                        {hasAppointments && (
                          <div className={`text-sm font-bold ${day === 12 ? 'text-white' : 'text-primary-500'}`}>
                            +{appointments.length}
                          </div>
                        )}
                      </div>
                      {/* Desktop: Show names */}
                      <div className="hidden sm:block text-xs space-y-0.5 overflow-hidden">
                        {appointments.length === 0 ? (
                          <div className="text-gray-400">No apts</div>
                        ) : appointments.length === 1 ? (
                          <div className="truncate">{appointments[0]}</div>
                        ) : (
                          <>
                            <div className="truncate">{appointments[0]}</div>
                            <div className={day === 12 ? 'text-white/80' : 'text-gray-500'}>
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
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[80px]">
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
                        <p className="font-bold text-green-600 mb-1">{apt.price}</p>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => {
                            closeDayModal();
                            onViewDetails(apt.id);
                          }}
                        >
                          View Details
                        </Button>
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

  // Mock service history data
  const serviceHistory = [
    {
      id: 'service-1',
      date: '2025-12-16',
      time: '14:00',
      customerName: 'Alex Rivera',
      serviceType: 'Fade',
      location: 'Student Union - Room 204',
      price: 35.00,
      status: 'completed' as const,
      rating: 5,
      review: 'Excellent fade! Marcus really knows what he\'s doing. Super clean lines!',
    },
    {
      id: 'service-2',
      date: '2025-12-15',
      time: '16:30',
      customerName: 'Jordan Lee',
      serviceType: 'Haircut & Beard Trim',
      location: 'Kennedy Library - Study Room 3B',
      price: 45.00,
      status: 'completed' as const,
      rating: 5,
      review: 'Best haircut I\'ve gotten on campus. Professional and skilled!',
    },
    {
      id: 'service-3',
      date: '2025-12-14',
      time: '12:00',
      customerName: 'Sam Chen',
      serviceType: 'Lineup',
      location: 'Cerro Vista Apartments',
      price: 20.00,
      status: 'completed' as const,
      rating: 4,
      review: 'Good lineup, came out clean.',
    },
    {
      id: 'service-4',
      date: '2025-12-13',
      time: '18:00',
      customerName: 'Marcus Williams',
      serviceType: 'Full Service',
      location: 'Poly Canyon Village',
      price: 55.00,
      status: 'completed' as const,
      rating: 5,
      review: 'Worth every penny! The hot towel shave was amazing.',
    },
    {
      id: 'service-5',
      date: '2025-12-12',
      time: '15:00',
      customerName: 'David Park',
      serviceType: 'Fade',
      location: 'Campus Market',
      price: 32.00,
      status: 'completed' as const,
      rating: 4,
    },
    {
      id: 'service-6',
      date: '2025-12-11',
      time: '13:30',
      customerName: 'Tyler Johnson',
      serviceType: 'Haircut',
      location: 'Recreation Center',
      price: 30.00,
      status: 'cancelled' as const,
    },
    {
      id: 'service-7',
      date: '2025-12-10',
      time: '17:00',
      customerName: 'Chris Martinez',
      serviceType: 'Beard Trim',
      location: 'Engineering Plaza',
      price: 25.00,
      status: 'no-show' as const,
    },
  ];

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

        {/* Stats Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.avgRating.toFixed(1)}</p>
              <p className="text-xs text-gray-600">Avg Rating</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-500">${stats.totalEarned.toFixed(0)}</p>
              <p className="text-xs text-gray-600">Earned</p>
            </div>
          </div>
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
                      {service.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < service.rating! ? 'text-yellow-500 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
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
