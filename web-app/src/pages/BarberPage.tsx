/**
 * Barber Dashboard Page - Version 4.0 (Cache Buster)
 * Last updated: 2025-12-18 00:15:00
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, ChevronLeft, ChevronRight, Scissors, Inbox, Shield, MapPin, MessageCircle, MessageSquare, Search, Filter, X, Clock, Zap, ArrowLeft, Bell, AlertCircle, Check, Send, AlertTriangle, Trash2, Pencil, Save, User, Mail, FileText, CreditCard } from 'lucide-react';
import notificationService, { Notification } from '../services/notification.service';
import api from '../services/api.service';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import Card from '../components/Card';
import TimeInput from '../components/TimeInput';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusManagerBadge } from '../components/CampusManagerBadge';
import { CampusManagerDashboard } from '../components/CampusManagerDashboard';
import BarberChatsModal from '../components/BarberChatsModal';
import BarberLocationsModal from '../components/BarberLocationsModal';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
// import WalkInPaymentModal from '../components/WalkInPaymentModal'; // Walk-in feature disabled
import BookingDetailsModal from '../components/BookingDetailsModal';
import PullToRefresh from '../components/PullToRefresh';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';
import campusService from '../services/campus.service';
import type { Campus } from '../types';
import { useMessageStore } from '../store/useMessageStore';
import { useViewport, useBodyScrollLock, useGeolocation, useDynamicViewportHeight } from '../hooks';
import toast from 'react-hot-toast';

const COMPONENT_VERSION = 'v4.0-modal-fix';

export default function BarberPage() {
  console.log('🚀 BarberPage loaded -', COMPONENT_VERSION);
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  
  // Viewport detection for responsive behavior
  const { isMobile, isTablet, viewport } = useViewport();
  
  // Handle dynamic viewport height for mobile browser bar changes
  useDynamicViewportHeight();
  
  // Auto-update barber's location when they access the dashboard
  // This ensures their location stays current for consumer discovery
  useGeolocation();
  
  // Message store for unread count
  const { unreadCount: unreadMessages, loadUnreadCount } = useMessageStore();
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  // Modal states with visibility for animations
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isProfileEditorVisible, setIsProfileEditorVisible] = useState(false);
  
  const [showServiceSpecialties, setShowServiceSpecialties] = useState(false);
  const [isServiceSpecialtiesVisible, setIsServiceSpecialtiesVisible] = useState(false);
  
  const [showCampusManagerDashboard, setShowCampusManagerDashboard] = useState(false);
  const [isCampusManagerVisible, setIsCampusManagerVisible] = useState(false);
  
  const [showBarberChats, setShowBarberChats] = useState(false);
  const [isBarberChatsVisible, setIsBarberChatsVisible] = useState(false);
  
  const [showBookings, setShowBookings] = useState(false);
  const [isBookingsVisible, setIsBookingsVisible] = useState(false);
  
  const [showLocations, setShowLocations] = useState(false);
  const [isLocationsVisible, setIsLocationsVisible] = useState(false);
  
  const [showAvailability, setShowAvailability] = useState(false);
  
  // const [showWalkInPayment, setShowWalkInPayment] = useState(false); // Walk-in feature disabled
  const [isAvailabilityVisible, setIsAvailabilityVisible] = useState(false);
  
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false);
  
  // Lock body scroll when any modal is open
  const isAnyModalOpen = showProfileEditor || showServiceSpecialties || showCampusManagerDashboard || showBarberChats || showBookings || showLocations || showAvailability || showServiceDetails || showNotifications || showBookingDetailsModal;
  useBodyScrollLock(isAnyModalOpen);
  
  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data.notifications);
      setUnreadNotifications(data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };
  
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };
  
  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      await notificationService.deleteAllNotifications();
      setNotifications([]);
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };
  
  // Format time helper
  const formatNotificationTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  // Fetch notifications and unread messages on mount
  useEffect(() => {
    fetchNotifications();
    loadUnreadCount();
  }, [loadUnreadCount]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Generic modal animation helpers
  const openModal = (setShow: (v: boolean) => void, setVisible: (v: boolean) => void) => {
    // Scroll to top first to prevent white space issues on mobile
    window.scrollTo({ top: 0, behavior: 'instant' });
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
  
  const openCampusManager = () => openModal(setShowCampusManagerDashboard, setIsCampusManagerVisible);
  const closeCampusManager = () => closeModal(setShowCampusManagerDashboard, setIsCampusManagerVisible);
  
  const openBarberChats = () => openModal(setShowBarberChats, setIsBarberChatsVisible);
  const closeBarberChats = () => closeModal(setShowBarberChats, setIsBarberChatsVisible);
  
  const openBookings = () => openModal(setShowBookings, setIsBookingsVisible);
  const closeBookings = () => closeModal(setShowBookings, setIsBookingsVisible);
  
  const openLocations = () => openModal(setShowLocations, setIsLocationsVisible);
  const closeLocations = () => closeModal(setShowLocations, setIsLocationsVisible);
  
  const openAvailability = () => openModal(setShowAvailability, setIsAvailabilityVisible);
  const closeAvailability = () => closeModal(setShowAvailability, setIsAvailabilityVisible);
  
  // Get barber data from auth - in production this would come from API
  const { user } = useAuthStore();
  const barberId = user?.id || '';
  const isCampusManager = user?.is_campus_manager || user?.user_type === 'campus_manager';
  
  // Role-based access control: Only barbers, campus managers, and admins can access this page
  // Consumers/students should be redirected to the consumer page
  const isAuthorizedForBarberPage = 
    user?.user_type === 'barber' || 
    user?.user_type === 'campus_manager' || 
    user?.user_type === 'admin' ||
    user?.has_barber_profile;
  
  useEffect(() => {
    if (user && !isAuthorizedForBarberPage) {
      console.warn('Unauthorized access to BarberPage. Redirecting to consumer page.', {
        userId: user.id,
        userType: user.user_type,
        hasBarberProfile: user.has_barber_profile
      });
      toast.error('You need a barber profile to access this page');
      navigate(`${platformPrefix}/consumer`);
    }
  }, [user, isAuthorizedForBarberPage, navigate, platformPrefix]);

  // State for booking details modal
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  
  // State for barber profile data (for walk-in services and campus manager)
  const [barberProfile, setBarberProfile] = useState<{ name: string; specialties: string[]; campusId?: string; campusTimezone?: string } | null>(null);

  // Admin campus management - admins can manage any campus
  const isAdmin = user?.is_admin || user?.user_type === 'admin';
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [selectedAdminCampusId, setSelectedAdminCampusId] = useState<string>('');
  const [showCampusSelector, setShowCampusSelector] = useState(false);
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const campusSelectorRef = useRef<HTMLDivElement>(null);

  // Use barber profile campusId (from barbers table) for campus manager, fallback to user's campus_id
  // For admins, use the selected campus (or first available campus)
  const defaultCampusId = barberProfile?.campusId || user?.campus_id || '';
  const campusId = isAdmin && selectedAdminCampusId ? selectedAdminCampusId : defaultCampusId;
  
  // Find the current campus name from the list
  const currentCampus = allCampuses.find(c => c.id?.toString() === campusId);
  const campusName = currentCampus?.name || '';

  // Fetch all campuses for admin users
  useEffect(() => {
    const fetchCampuses = async () => {
      if (!isAdmin) return;
      try {
        const campuses = await campusService.getCampuses();
        setAllCampuses(campuses);
        // Set initial selected campus if not already set
        if (!selectedAdminCampusId && campuses.length > 0) {
          // Default to user's campus if available, otherwise first campus
          const userCampus = campuses.find(c => c.id?.toString() === (user?.campus_id || ''));
          setSelectedAdminCampusId(userCampus?.id?.toString() || campuses[0]?.id?.toString() || '');
        }
      } catch (error) {
        console.error('Failed to fetch campuses for admin:', error);
      }
    };
    fetchCampuses();
  }, [isAdmin, user?.campus_id]);

  // Close campus selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (campusSelectorRef.current && !campusSelectorRef.current.contains(event.target as Node)) {
        setShowCampusSelector(false);
        setCampusSearchQuery('');
      }
    };
    
    if (showCampusSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCampusSelector]);

  // Fetch barber profile data for walk-in modal and campus manager
  useEffect(() => {
    const fetchBarberProfile = async () => {
      if (!barberId) return;
      try {
        const response = await api.get(`/barbers/user/${barberId}`);
        if (response) {
          const fullName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Barber';
          setBarberProfile({
            name: response.name || fullName || 'Barber',
            specialties: response.specialties || [],
            campusId: response.campus_id || '',
            campusTimezone: response.campus_timezone || 'America/Los_Angeles'
          });
        }
      } catch (error) {
        console.error('Failed to fetch barber profile:', error);
      }
    };
    fetchBarberProfile();
  }, [barberId, user]);

  // Pull-to-refresh handler for mobile - reload the page
  const handlePullToRefresh = async () => {
    window.location.reload();
  };

  // Function to open booking details modal - receives full booking object
  const openBookingDetails = (booking: any) => {
    console.log('🔍 Opening booking details for:', booking.id);
    setSelectedBookingForDetails(booking);
    window.scrollTo({ top: 0, behavior: 'instant' });
    setShowBookingDetailsModal(true);
  };

  // Refresh bookings when a booking is updated
  const handleBookingUpdated = () => {
    setBookingsRefreshKey(prev => prev + 1);
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
    <PullToRefresh onRefresh={handlePullToRefresh} className="min-h-screen bg-gray-50" disabled={isAnyModalOpen}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between relative">
            {/* Left section - Messages + Campus Manager Badge */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Consumer Chat Button */}
              <button
                onClick={() => navigate(`${platformPrefix}/barber/messages`)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors relative"
                title="Consumer Chat"
              >
                <Send className="w-5 h-5 text-primary-600" />
                <span className="text-xs sm:text-sm font-semibold text-primary-700">Chats</span>
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </button>
              
              {/* Campus Manager Badge */}
                {isCampusManager && (
                <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">Campus Manager</span>
                </div>
                )}
              </div>
            
            {/* Center section - Logo always centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img src={CampusCutLogo} alt="CampusCut" className="h-10 sm:h-12 w-auto" />
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
                <Avatar src={user?.profile_picture_url} alt={user?.first_name || 'Barber'} size="md" />
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-w-[calc(100vw-2rem)]">
                  <button
                    onClick={() => {
                      navigate(`${platformPrefix}/consumer`);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-3"
                  >
                    <Calendar className="w-4 h-4 text-primary-500" />
                    Switch to Consumer
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
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
                      openLocations();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <MapPin className="w-4 h-4 text-gray-500" />
                    My Locations
                  </button>
                  <button
                    onClick={() => {
                      openBookings();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Bookings
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
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      setShowNotifications(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <Bell className="w-4 h-4 text-gray-500" />
                    Notifications
                    {unreadNotifications > 0 && (
                      <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>
                  {/* Barber Chats & Chat with Campus Manager (for non-CM barbers) */}
                  {!isCampusManager && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          openBarberChats();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Barber Chats
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setShowProfileDropdown(false);
                            const messageService = (await import('../services/message.service')).default;
                            const result = await messageService.startCMBarberConversation();
                            navigate(`${platformPrefix}/barber/messages/${result.conversationId}`);
                          } catch (error: any) {
                            console.error('Failed to start CM conversation:', error);
                            toast.error(error.message || 'Failed to start conversation with campus manager');
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                      >
                        <MessageCircle className="w-4 h-4 text-primary-600" />
                        Chat with Campus Manager
                      </button>
                    </>
                  )}
                  {/* Campus Manager Options (conditional) */}
                  {isCampusManager && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          openCampusManager();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Campus Manager
                      </button>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          openBarberChats();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Barber Chats
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
        <DashboardView navigate={navigate} barberId={barberId} onViewDetails={openBookingDetails} refreshKey={bookingsRefreshKey} campusTimezone={barberProfile?.campusTimezone || 'America/Los_Angeles'} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div 
          className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isProfileEditorVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeProfileEditor}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85dvh] sm:max-h-[80vh] overflow-y-auto transition-all duration-150 ease-out
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
          className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isServiceSpecialtiesVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeServiceSpecialties}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto transition-all duration-150 ease-out
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

      {/* Campus Manager Dashboard Modal (conditional) */}
      {isCampusManager && showCampusManagerDashboard && (
        <div 
          className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isCampusManagerVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeCampusManager}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] sm:max-h-[88vh] overflow-y-auto overscroll-contain transition-all duration-150 ease-out
              ${isCampusManagerVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10">
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Campus Manager Dashboard</h2>
                {/* Campus Selector for Admins */}
                {isAdmin && allCampuses.length > 0 && (
                  <div className="mt-2 relative" ref={campusSelectorRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={showCampusSelector ? campusSearchQuery : (campusName || '')}
                        onChange={(e) => {
                          setCampusSearchQuery(e.target.value);
                          if (!showCampusSelector) setShowCampusSelector(true);
                        }}
                        onFocus={() => {
                          setShowCampusSelector(true);
                          setCampusSearchQuery('');
                        }}
                        onBlur={(e) => {
                          // Delay to allow click on dropdown items to register first
                          setTimeout(() => {
                            // Only close if focus moved outside the selector container
                            if (campusSelectorRef.current && !campusSelectorRef.current.contains(document.activeElement)) {
                              setShowCampusSelector(false);
                              setCampusSearchQuery('');
                            }
                          }, 150);
                        }}
                        placeholder="Search campuses..."
                        className="w-full max-w-xs text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-primary-500 px-3 py-1.5 pr-8 rounded-lg transition-colors border border-transparent focus:border-primary-300 outline-none"
                      />
                      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform pointer-events-none ${showCampusSelector ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Campus Dropdown */}
                    {showCampusSelector && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[300px] max-h-[300px] overflow-y-auto overscroll-contain">
                        <div className="p-2">
                          {allCampuses
                            .filter(campus => {
                              if (!campusSearchQuery) return true;
                              const query = campusSearchQuery.toLowerCase();
                              return (
                                campus.name?.toLowerCase().includes(query) ||
                                campus.city?.toLowerCase().includes(query) ||
                                campus.state?.toLowerCase().includes(query)
                              );
                            })
                            .map((campus) => (
                              <button
                                key={campus.id}
                                onClick={() => {
                                  setSelectedAdminCampusId(campus.id?.toString() || '');
                                  setShowCampusSelector(false);
                                  setCampusSearchQuery('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                  campus.id?.toString() === campusId
                                    ? 'bg-primary-100 text-primary-700 font-medium'
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                <div className="font-medium">{campus.name}</div>
                                {campus.city && campus.state && (
                                  <div className="text-xs text-gray-500">{campus.city}, {campus.state}</div>
                                )}
                              </button>
                            ))}
                          {allCampuses.filter(campus => {
                            if (!campusSearchQuery) return true;
                            const query = campusSearchQuery.toLowerCase();
                            return (
                              campus.name?.toLowerCase().includes(query) ||
                              campus.city?.toLowerCase().includes(query) ||
                              campus.state?.toLowerCase().includes(query)
                            );
                          }).length === 0 && (
                            <p className="text-sm text-gray-500 px-3 py-2">No campuses found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Show campus name for non-admin campus managers */}
                {!isAdmin && campusName && (
                  <p className="text-sm text-gray-500 mt-1">
                    {campusName}
                  </p>
                )}
              </div>
              <button
                onClick={closeCampusManager}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <CampusManagerDashboard campusId={campusId} campusName={campusName} />
            </div>
          </div>
        </div>
      )}

      {/* Barber-to-Barber Chats Modal (for all barbers) */}
      {showBarberChats && (
        <BarberChatsModal
          isVisible={isBarberChatsVisible}
          onClose={closeBarberChats}
          onSelectBarber={(barberUserId: string, conversationId: number | null) => {
            closeBarberChats();
            if (conversationId) {
              navigate(`${platformPrefix}/barber/messages/${conversationId}`);
            } else {
              // Start new conversation and navigate
              import('../services/message.service').then(async (mod) => {
                const result = await mod.default.startBarberConversation(barberUserId);
                navigate(`${platformPrefix}/barber/messages/${result.conversationId}`);
              }).catch(console.error);
            }
          }}
        />
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

      {/* Bookings Modal */}
      {showBookings && (
        <BookingsModal 
          isVisible={isBookingsVisible} 
          onClose={closeBookings}
          barberId={barberId}
        />
      )}

      {/* Locations Modal */}
      {showLocations && (
        <BarberLocationsModal 
          isVisible={isLocationsVisible} 
          onClose={closeLocations}
        />
      )}

      {/* Booking Details Modal - for schedule view bookings */}
      <BookingDetailsModal
        isOpen={showBookingDetailsModal}
        onClose={() => {
          setShowBookingDetailsModal(false);
          setSelectedBookingForDetails(null);
        }}
        booking={selectedBookingForDetails}
        onBookingUpdated={handleBookingUpdated}
      />

      {/* Availability Modal */}
      {showAvailability && (
        <AvailabilityModal 
          isVisible={isAvailabilityVisible} 
          onClose={closeAvailability}
          userId={user?.id}
        />
      )}

      {/* Walk-in Payment Modal - Feature disabled
      <WalkInPaymentModal
        isOpen={showWalkInPayment}
        onClose={() => setShowWalkInPayment(false)}
        barberName={barberProfile?.name || (user ? `${user.first_name} ${user.last_name}`.trim() : 'Barber')}
        barberSpecialties={barberProfile?.specialties || []}
      />
      */}

      {/* Notifications Modal */}
      {showNotifications && (
        <div 
          className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNotifications(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80dvh] sm:max-h-[80vh] overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Notifications</h2>
                <p className="text-white/80 text-sm">
                  {unreadNotifications > 0 ? `${unreadNotifications} unread` : 'All caught up!'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
              <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-white/80 hover:text-white text-sm underline"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button 
                    onClick={handleDeleteAllNotifications}
                    className="text-white/80 hover:text-white text-sm underline"
                  >
                    Delete all
                  </button>
                )}
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
              </button>
            </div>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No notifications yet</p>
          </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => {
                    // Normalize type for matching (handle case/whitespace variations)
                    const notifType = (notification.type || '').toLowerCase().trim();
                    const isMessageNotification = notifType === 'new_message' || notification.title?.toLowerCase().includes('message');
                    
                    // Determine icon and colors based on notification type
                    const getNotificationStyle = () => {
                      if (isMessageNotification) {
                        return { bg: 'bg-primary-100', icon: <MessageCircle className="w-5 h-5 text-primary-600" /> };
                      }
                      switch (notifType) {
                        case 'booking_accepted':
                          return { bg: 'bg-green-100', icon: <Check className="w-5 h-5 text-green-600" /> };
                        case 'booking_rejected':
                        case 'booking_cancelled':
                          return { bg: 'bg-red-100', icon: <AlertCircle className="w-5 h-5 text-red-600" /> };
                        case 'new_booking_request':
                          return { bg: 'bg-blue-100', icon: <Calendar className="w-5 h-5 text-blue-600" /> };
                        default:
                          return { bg: 'bg-primary-100', icon: <Bell className="w-5 h-5 text-primary-600" /> };
                      }
                    };
                    
                    const style = getNotificationStyle();
                    
                    // Parse notification data
                    const data = notification.data ? (typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data) : {};
                    
                    // Handle click - navigate to appropriate page
                    const handleNotificationClick = () => {
                      if (!notification.is_read) {
                        handleMarkNotificationRead(notification.id);
                      }
                      
                      // Message notifications navigate to the conversation
                      if (isMessageNotification && data.conversationId) {
                        navigate(`${platformPrefix}/barber/messages/${data.conversationId}`);
                        setShowNotifications(false);
                      } else if (notifType === 'new_booking_request') {
                        // Stay on barber page, close modal - dashboard shows requests
                        setShowNotifications(false);
                      } else {
                        // Default: close modal
                        setShowNotifications(false);
                      }
                    };
                    
                    return (
                      <div 
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.is_read ? 'bg-primary-50/50' : ''
                        }`}
                        onClick={handleNotificationClick}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                            {style.icon}
        </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900 text-sm">
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatNotificationTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
      )}
    </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                onClick={() => setShowNotifications(false)}
                variant="secondary"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
  onViewDetails: (booking: any) => void;
  // onWalkInClick: () => void; // Walk-in feature disabled
  refreshKey?: number;
  campusTimezone?: string;
}

// Type for confirmed bookings
interface ConfirmedBooking {
  id: string;
  consumerId: string;
  barberId: string;
  serviceType: string;
  priceUsdCents: number;
  scheduledTime: string;
  status: string;
  createdAt: string;
  // Consumer-provided input data
  location?: string;
  notes?: string;
  serviceName?: string;
  consumer: {
    firstName: string;
    lastName: string;
    avatar?: string;
    email?: string;
    profilePictureUrl?: string;
  };
}

function DashboardView({ navigate, barberId, onViewDetails, refreshKey = 0, campusTimezone = 'America/Los_Angeles' }: DashboardViewProps) {
  // Helper to get the current date in campus timezone
  const getTodayInCampusTimezone = () => {
    const now = new Date();
    // Get the date string in the campus timezone
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: campusTimezone }); // 'en-CA' gives YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    const campusToday = new Date(year, month - 1, day);
    campusToday.setHours(0, 0, 0, 0);
    return campusToday;
  };

  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Full date for modal
  const [showDayModal, setShowDayModal] = useState(false);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, 1 = next month, etc.
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, etc.
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const modalRef = useRef<HTMLDivElement>(null);
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  
  // Inline booking details state (shown within DayModal instead of separate popup)
  const [selectedBookingInline, setSelectedBookingInline] = useState<ConfirmedBooking | null>(null);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedTime, setEditedTime] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  
  // Confirmed bookings state
  const [confirmedBookings, setConfirmedBookings] = useState<ConfirmedBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  
  // Viewport detection for responsive layout
  const { isMobile, isMobilePortrait, isTablet } = useViewport();
  
  // Fetch confirmed bookings using the API service (handles auth automatically)
  useEffect(() => {
    const fetchConfirmedBookings = async () => {
      try {
        setIsLoadingBookings(true);
        // Fetch ACCEPTED, COMPLETED, and PAID bookings for the barber's schedule
        const response = await api.get<{ bookings: ConfirmedBooking[] }>('/bookings-simple', {
          role: 'barber',
          status: 'ACCEPTED,COMPLETED,PAID',
        });
        
        setConfirmedBookings(response.bookings || []);
      } catch (error) {
        console.error('Error fetching confirmed bookings:', error);
      } finally {
        setIsLoadingBookings(false);
      }
    };
    
    fetchConfirmedBookings();
  }, [refreshKey]);

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
  const openDayModal = (date: Date) => {
    setSelectedDate(date);
    // Scroll to bottom to prevent pull-to-refresh from activating while popup is open
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
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
      setSelectedDate(null);
      // Reset inline booking state
      setSelectedBookingInline(null);
      setIsEditingBooking(false);
      setIsDeletingBooking(false);
      setCancelReason('');
      // Scroll back to top when modal closes
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 150);
  };

  // Initialize editable fields when a booking is selected for inline view
  const selectBookingForInlineView = (booking: ConfirmedBooking) => {
    setSelectedBookingInline(booking);
    const scheduledTime = new Date(booking.scheduledTime);
    const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledTime.getDate()).padStart(2, '0');
    const year = scheduledTime.getFullYear();
    setEditedDate(`${month}/${day}/${year}`);
    const hours = String(scheduledTime.getHours()).padStart(2, '0');
    const minutes = String(scheduledTime.getMinutes()).padStart(2, '0');
    setEditedTime(`${hours}:${minutes}`);
    setEditedLocation(booking.location || '');
    setIsEditingBooking(false);
    setIsDeletingBooking(false);
    setCancelReason('');
  };

  // Back to appointments list
  const backToAppointmentsList = () => {
    setSelectedBookingInline(null);
    setIsEditingBooking(false);
    setIsDeletingBooking(false);
    setCancelReason('');
  };

  // Handle saving booking changes
  const handleSaveBookingChanges = async () => {
    if (!selectedBookingInline) return;
    
    // Parse date
    const dateParts = editedDate.split('/');
    if (dateParts.length !== 3) {
      toast.error('Please enter a valid date (MM/DD/YYYY)');
      return;
    }
    const month = parseInt(dateParts[0]);
    const day = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);
    if (isNaN(month) || isNaN(day) || isNaN(year)) {
      toast.error('Please enter a valid date');
      return;
    }
    
    // Parse time
    const timeParts = editedTime.split(':');
    if (timeParts.length !== 2) {
      toast.error('Please select a valid time');
      return;
    }
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    if (isNaN(hours) || isNaN(minutes)) {
      toast.error('Please select a valid time');
      return;
    }

    setIsSavingBooking(true);
    try {
      const newScheduledTime = new Date(year, month - 1, day, hours, minutes);
      await api.put(`/bookings-simple/${selectedBookingInline.id}`, {
        scheduledTime: newScheduledTime.toISOString(),
        location: editedLocation || null,
      });
      toast.success('Booking updated successfully!');
      setIsEditingBooking(false);
      // Refresh bookings
      onViewDetails(selectedBookingInline); // This triggers a refresh in parent
    } catch (error: any) {
      console.error('Failed to update booking:', error);
      toast.error(error.message || 'Failed to update booking');
    } finally {
      setIsSavingBooking(false);
    }
  };

  // Handle canceling booking
  const handleCancelBooking = async () => {
    if (!selectedBookingInline) return;
    
    setIsSavingBooking(true);
    try {
      await api.delete(`/bookings-simple/${selectedBookingInline.id}`, {
        reason: cancelReason || undefined,
      });
      toast.success('Booking cancelled successfully');
      closeDayModal();
      onViewDetails(selectedBookingInline); // Trigger refresh
    } catch (error: any) {
      console.error('Failed to cancel booking:', error);
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsSavingBooking(false);
    }
  };

  // Handle completing booking (request payment)
  const handleCompleteBooking = async () => {
    if (!selectedBookingInline) return;
    
    try {
      await api.post(`/bookings-simple/${selectedBookingInline.id}/request-payment`, {});
      toast.success('Payment request sent to customer');
      closeDayModal();
      navigate(`/web/payment/${selectedBookingInline.id}`);
    } catch (error: any) {
      console.error('Failed to request payment:', error);
      toast.error(error.message || 'Failed to request payment');
    }
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

  // Get appointments for a specific date from confirmed bookings
  const getAppointmentsForDate = (date: Date): ConfirmedBooking[] => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    return confirmedBookings
      .filter(booking => {
        const bookingDate = new Date(booking.scheduledTime);
        return bookingDate >= targetDate && bookingDate < nextDay;
      })
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  };

  const handleDayClick = (date: Date) => {
    openDayModal(date);
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
          {/* Jump to Today/This Week/This Month button - shown when offset is non-zero */}
          {((scheduleView === 'daily' && dayOffset !== 0) || 
            (scheduleView === 'weekly' && weekOffset !== 0) || 
            (scheduleView === 'monthly' && monthOffset !== 0)) && (
            <button 
              onClick={() => {
                if (scheduleView === 'daily') setDayOffset(0);
                else if (scheduleView === 'weekly') setWeekOffset(0);
                else setMonthOffset(0);
              }}
              className="px-3 py-1.5 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium"
            >
              {scheduleView === 'daily' ? 'Today' : scheduleView === 'weekly' ? 'This Week' : 'This Month'}
            </button>
          )}
          
          {/* Appointments Count - centered above toggle buttons */}
          <p className="text-sm sm:text-base text-gray-600 font-medium">
            {(() => {
              const today = getTodayInCampusTimezone();
              
              if (scheduleView === 'daily') {
                const displayDate = new Date(today);
                displayDate.setDate(displayDate.getDate() + dayOffset);
                const nextDay = new Date(displayDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const count = confirmedBookings.filter(b => {
                  const bookingDate = new Date(b.scheduledTime);
                  return bookingDate >= displayDate && bookingDate < nextDay;
                }).length;
                return `${count} appointment${count !== 1 ? 's' : ''}`;
              } else if (scheduleView === 'weekly') {
                const todayDay = today.getDay();
                const startOfWeek = new Date(today);
                const daysFromMonday = todayDay === 0 ? 6 : todayDay - 1;
                startOfWeek.setDate(today.getDate() - daysFromMonday + (weekOffset * 7));
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 7);
                const count = confirmedBookings.filter(b => {
                  const bookingDate = new Date(b.scheduledTime);
                  return bookingDate >= startOfWeek && bookingDate < endOfWeek;
                }).length;
                const weekWord = weekOffset === 0 ? 'this' : 'that';
                return `${count} appointment${count !== 1 ? 's' : ''} ${weekWord} week`;
              } else {
                const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
                const displayMonth = displayDate.getMonth();
                const displayYear = displayDate.getFullYear();
                const count = confirmedBookings.filter(b => {
                  const bookingDate = new Date(b.scheduledTime);
                  return bookingDate.getMonth() === displayMonth && bookingDate.getFullYear() === displayYear;
                }).length;
                const monthWord = monthOffset === 0 ? 'this' : 'that';
                return `${count} appointment${count !== 1 ? 's' : ''} ${monthWord} month`;
              }
            })()}
          </p>

          {/* View Toggle Buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 justify-items-center">
            {/* Walk-in feature disabled
            <div></div>
            <button
              onClick={onWalkInClick}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors text-sm sm:text-base font-semibold min-w-[5rem] sm:min-w-[6rem] text-center"
              title="Quick payment for walk-in customers"
            >
              Walk-in
            </button>
            <div></div>
            */}
            
            {/* Daily Button */}
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
            {/* Weekly Button */}
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
            {/* Monthly Button */}
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

          {/* Date Navigation - below toggle buttons */}
          {scheduleView === 'daily' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDayOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[200px] sm:min-w-[280px] text-center">
                {dayOffset === 0 ? 'Today - ' : dayOffset === 1 ? 'Tomorrow - ' : dayOffset === -1 ? 'Yesterday - ' : ''}
                {(() => {
                  const today = getTodayInCampusTimezone();
                  const displayDate = new Date(today);
                  displayDate.setDate(displayDate.getDate() + dayOffset);
                  return displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                })()}
              </h3>
              <button 
                onClick={() => setDayOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}

          {/* Weekly Date Navigation */}
          {scheduleView === 'weekly' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[200px] sm:min-w-[280px] text-center">
                {(() => {
                  const today = getTodayInCampusTimezone();
                  const todayDay = today.getDay();
                  const startOfWeek = new Date(today);
                  const daysFromMonday = todayDay === 0 ? 6 : todayDay - 1;
                  startOfWeek.setDate(today.getDate() - daysFromMonday + (weekOffset * 7));
                  const endOfWeek = new Date(startOfWeek);
                  endOfWeek.setDate(startOfWeek.getDate() + 6);
                  const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'long' });
                  const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'long' });
                  const year = endOfWeek.getFullYear();
                  return startMonth === endMonth 
                    ? `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`
                    : `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
                })()}
              </h3>
              <button 
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}

          {/* Monthly Date Navigation */}
          {scheduleView === 'monthly' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMonthOffset(prev => prev - 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[160px] text-center">
                {(() => {
                  const today = getTodayInCampusTimezone();
                  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
                  return displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                })()}
              </h3>
              <button 
                onClick={() => setMonthOffset(prev => prev + 1)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Daily View */}
        {scheduleView === 'daily' && (() => {
          // Filter bookings for the selected day (using dayOffset) - using campus timezone
          const today = getTodayInCampusTimezone();
          const displayDate = new Date(today);
          displayDate.setDate(displayDate.getDate() + dayOffset);
          const nextDay = new Date(displayDate);
          nextDay.setDate(nextDay.getDate() + 1);
          
          const dailyAppointments = confirmedBookings
            .filter(booking => {
              const bookingDate = new Date(booking.scheduledTime);
              return bookingDate >= displayDate && bookingDate < nextDay;
            })
            .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

          const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
          const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: campusTimezone });
          const dayLabel = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : dayOffset === -1 ? 'Yesterday' : '';
          const dateFormatted = displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

          return (
            <div>
              {isLoadingBookings ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading appointments...</p>
                        </div>
              ) : dailyAppointments.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Calendar className="w-14 h-14 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-4 sm:mb-5" />
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-base sm:text-lg text-gray-600">You have no appointments scheduled for {dayOffset === 0 ? 'today' : 'this day'}.</p>
                      </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {dailyAppointments.map((apt) => {
                    const isCompleted = apt.status === 'COMPLETED' || apt.status === 'PAID';
                    return (
                    <div 
                      key={apt.id} 
                      onClick={() => onViewDetails(apt)}
                      className={`p-5 sm:p-6 lg:p-4 rounded-xl border active:scale-98 transition-all cursor-pointer max-w-2xl mx-auto ${
                        isCompleted 
                          ? 'bg-green-50 border-green-200 hover:border-green-400' 
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300 hover:bg-gray-100'
                      }`}
                    >
                      {/* Top row: Client name + Status/Price */}
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-lg sm:text-xl lg:text-2xl">{apt.consumer.firstName} {apt.consumer.lastName}</p>
                          {isCompleted && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✓ Completed</span>
                          )}
                        </div>
                        <p className="font-bold text-green-600 text-xl sm:text-2xl lg:text-3xl">{formatPrice(apt.priceUsdCents)}</p>
                      </div>
                      {/* Service - prefer serviceName from input, fallback to serviceType */}
                      <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-2">
                        {apt.serviceName || apt.serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      {/* Location and Notes if available */}
                      {(apt.location || apt.notes) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {apt.location && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm lg:text-base">
                              <MapPin className="w-3 h-3 lg:w-4 lg:h-4" />
                              {apt.location}
                            </span>
                          )}
                          {apt.notes && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm lg:text-base">
                              {apt.notes}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Bottom row: Time */}
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-primary-400 text-base sm:text-lg lg:text-xl">{formatTime(apt.scheduledTime)}</p>
                        <span className="text-sm sm:text-base lg:text-lg text-gray-500">Tap for details →</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Weekly View */}
        {scheduleView === 'weekly' && (() => {
          // Get the week based on weekOffset - using campus timezone
          const today = getTodayInCampusTimezone();
          const todayDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
          
          // Calculate start of current week (Monday)
          const startOfWeek = new Date(today);
          const daysFromMonday = todayDay === 0 ? 6 : todayDay - 1;
          startOfWeek.setDate(today.getDate() - daysFromMonday);
          // Apply week offset
          startOfWeek.setDate(startOfWeek.getDate() + (weekOffset * 7));
          startOfWeek.setHours(0, 0, 0, 0);
          
          // Build week days array dynamically (handles month boundaries automatically)
          const weekDays = [];
          for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            weekDays.push({
              name: date.toLocaleDateString('en-US', { weekday: 'long' }),
              shortName: date.toLocaleDateString('en-US', { weekday: 'short' }),
              date: date.getDate(),
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              fullDate: date,
            });
          }
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          
          // Group bookings by date
          const weekAppointmentsByDate: { [dateKey: string]: ConfirmedBooking[] } = {};
          confirmedBookings.forEach(booking => {
            const bookingDate = new Date(booking.scheduledTime);
            if (bookingDate >= startOfWeek && bookingDate < endOfWeek) {
              const dateKey = bookingDate.toDateString();
              if (!weekAppointmentsByDate[dateKey]) {
                weekAppointmentsByDate[dateKey] = [];
              }
              weekAppointmentsByDate[dateKey].push(booking);
            }
          });

          const totalWeekAppointments = Object.values(weekAppointmentsByDate).reduce((sum, arr) => sum + arr.length, 0);
          
          // Format week range - show month on both ends if they differ
          const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'long' });
          const endDate = new Date(endOfWeek.getTime() - 1);
          const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
          const weekRangeText = startMonth === endMonth 
            ? `${startOfWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`
            : `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

          return (
            <div>
              {/* Mobile: List view */}
              <div className="sm:hidden space-y-2">
                {weekDays.map(day => {
                  const dayBookings = weekAppointmentsByDate[day.fullDate.toDateString()] || [];
                  const isToday = day.fullDate.toDateString() === today.toDateString();

                  return (
                    <div
                      key={day.fullDate.toISOString()}
                      onClick={() => handleDayClick(day.fullDate)}
                      className={`flex items-center justify-between p-4 rounded-xl border active:scale-98 transition-all ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200'
                      } cursor-pointer`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.date}</div>
                          {/* Show month if different from first day of week */}
                          {day.month !== weekDays[0].month && (
                            <div className={`text-xs ${isToday ? 'text-white/70' : 'text-gray-500'}`}>{day.month}</div>
                          )}
                        </div>
                        <div>
                          <div className={`font-semibold text-base ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.name}</div>
                          {(() => {
                            const completedCount = dayBookings.filter(b => b.status === 'COMPLETED' || b.status === 'PAID').length;
                            const pendingCount = dayBookings.filter(b => b.status === 'ACCEPTED').length;
                            
                            if (dayBookings.length === 0) {
                              return (
                                <div className={`text-sm ${isToday ? 'text-white/70' : 'text-gray-500'}`}>
                                  No appointments
                                </div>
                              );
                            }
                            
                            return (
                              <div className="flex flex-col gap-0.5">
                                {completedCount > 0 && (
                                  <div className={`text-sm ${isToday ? 'text-white/70' : 'text-green-700 font-bold'}`}>
                                    {completedCount} completed
                                  </div>
                                )}
                                {pendingCount > 0 && (
                                  <div className={`text-sm ${isToday ? 'text-white/70' : 'text-amber-600 font-bold'}`}>
                                    {pendingCount} pending
                                  </div>
                                )}
                              </div>
                            );
                          })()}
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
                  <div key={day.fullDate.toISOString() + '-header'} className="text-center font-bold text-gray-600 text-base py-2">
                    {day.shortName}
                  </div>
                ))}
                {/* Week day cards */}
                {weekDays.map(day => {
                  const dayBookings = weekAppointmentsByDate[day.fullDate.toDateString()] || [];
                  const isToday = day.fullDate.toDateString() === today.toDateString();

                  return (
                    <div
                      key={day.fullDate.toISOString()}
                      onClick={() => handleDayClick(day.fullDate)}
                      className={`p-5 rounded-xl border overflow-hidden min-h-[160px] flex flex-col ${
                        isToday
                          ? 'bg-primary-400 text-white border-primary-500'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer transition-colors`}
                    >
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold mb-1">{day.date}</div>
                        <div className={`text-sm ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                          {/* Show month if different from first day of week */}
                          {day.month !== weekDays[0].month ? `${day.month} - ${day.name}` : day.name}
                        </div>
                      </div>
                      <div className="text-sm space-y-1.5 flex-1 overflow-hidden">
                        {dayBookings.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : (
                          <>
                            <div className="truncate font-semibold">
                              {dayBookings[0].serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - {dayBookings[0].consumer.firstName}
                            </div>
                            {dayBookings.length > 1 && (
                              <>
                                <div className="truncate">
                                  {dayBookings[1].serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - {dayBookings[1].consumer.firstName}
                                </div>
                                {dayBookings.length > 2 && (
                                  <div className={isToday ? 'text-white/80 font-bold' : 'text-gray-500 font-bold'}>
                                    +{dayBookings.length - 2} more
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
        {scheduleView === 'monthly' && (() => {
          // Use campus timezone to determine current month
          const today = getTodayInCampusTimezone();
          // Calculate the displayed month based on offset
          const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
          const displayMonth = displayDate.getMonth();
          const displayYear = displayDate.getFullYear();
          
          // Get first day of month and number of days
          const firstDayOfMonth = new Date(displayYear, displayMonth, 1);
          const lastDayOfMonth = new Date(displayYear, displayMonth + 1, 0);
          const daysInMonth = lastDayOfMonth.getDate();
          const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
          
          const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          
          // Group bookings by day of month
          const monthAppointmentsByDay: { [day: number]: ConfirmedBooking[] } = {};
          confirmedBookings.forEach(booking => {
            const bookingDate = new Date(booking.scheduledTime);
            if (bookingDate.getMonth() === displayMonth && bookingDate.getFullYear() === displayYear) {
              const day = bookingDate.getDate();
              if (!monthAppointmentsByDay[day]) {
                monthAppointmentsByDay[day] = [];
              }
              monthAppointmentsByDay[day].push(booking);
            }
          });
          
          const totalMonthAppointments = Object.values(monthAppointmentsByDay).reduce((sum, arr) => sum + arr.length, 0);
          
          // Create array with empty slots for padding
          const calendarDays: (number | null)[] = [];
          for (let i = 0; i < startDayOfWeek; i++) {
            calendarDays.push(null); // Padding for days before first of month
          }
          for (let i = 1; i <= daysInMonth; i++) {
            calendarDays.push(i);
          }
          
          return (
          <div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {/* Calendar header */}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLabel, i) => (
                  <div key={i} className="text-center font-bold text-gray-600 text-sm sm:text-base py-2 sm:py-3">
                    <span className="sm:hidden">{dayLabel}</span>
                    <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
              {/* Calendar days */}
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }
                  
                  const dayBookings = monthAppointmentsByDay[day] || [];
                  const hasAppointments = dayBookings.length > 0;
                  // Check if this day is "today" in campus timezone (must match day, month, and year)
                  const isToday = day === today.getDate() && displayMonth === today.getMonth() && displayYear === today.getFullYear();
                  
                  return (
                    <div
                      key={day}
                      onClick={() => handleDayClick(new Date(displayYear, displayMonth, day))}
                      className={`aspect-square p-1.5 sm:p-3 rounded-lg sm:rounded-xl border overflow-hidden ${
                        isToday 
                          ? 'bg-primary-400 text-white border-primary-500' 
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                      } cursor-pointer active:scale-95 transition-all`}
                    >
                      <div className="text-sm sm:text-base font-bold mb-0.5 sm:mb-1">{day}</div>
                      {/* Mobile: Show +X bookings count with color coding */}
                      <div className="sm:hidden flex flex-col items-center gap-0">
                        {(() => {
                          const completedCount = dayBookings.filter(b => b.status === 'COMPLETED' || b.status === 'PAID').length;
                          const pendingCount = dayBookings.filter(b => b.status === 'ACCEPTED').length;
                          return (
                            <>
                              {completedCount > 0 && (
                                <div className={`text-xs font-bold ${isToday ? 'text-white' : 'text-green-600'}`}>
                                  +{completedCount}
                                </div>
                              )}
                              {pendingCount > 0 && (
                                <div className={`text-xs font-bold ${isToday ? 'text-white/80' : 'text-amber-500'}`}>
                                  +{pendingCount}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {/* Desktop: Show names with color-coded counts */}
                      <div className="hidden sm:block text-sm space-y-0.5 overflow-hidden">
                        {dayBookings.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : (
                          (() => {
                            const completedCount = dayBookings.filter(b => b.status === 'COMPLETED' || b.status === 'PAID').length;
                            const pendingCount = dayBookings.filter(b => b.status === 'ACCEPTED').length;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {completedCount > 0 && (
                                  <div className={`text-xs font-bold ${isToday ? 'text-white' : 'text-green-600'}`}>
                                    {completedCount} done
                                  </div>
                                )}
                                {pendingCount > 0 && (
                                  <div className={`text-xs font-bold ${isToday ? 'text-white/80' : 'text-amber-500'}`}>
                                    {pendingCount} pending
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
              })()}

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
      {showDayModal && selectedDate !== null && (
        <div 
          className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
            isDayModalVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          onClick={closeDayModal}
        >
          <div 
            ref={modalRef} 
            className={`bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80dvh] sm:max-h-[80vh] overflow-hidden transition-all duration-150 ease-out ${
              isDayModalVisible 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - changes based on whether viewing booking details */}
            <div className="bg-primary-400 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedBookingInline ? 'Booking Details' : selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p className="text-white/80">
                    {selectedBookingInline 
                      ? `${selectedBookingInline.status}` 
                      : `${getAppointmentsForDate(selectedDate).length} appointment${getAppointmentsForDate(selectedDate).length !== 1 ? 's' : ''}`
                    }
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
            
            <div className="p-6 overflow-y-auto max-h-[calc(80dvh-120px)] sm:max-h-[calc(80vh-120px)]">
              {/* Show booking details inline when a booking is selected */}
              {selectedBookingInline ? (
                <div className="space-y-4">
                  {/* Back button */}
                  <button
                    onClick={backToAppointmentsList}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back to Appointments</span>
                  </button>

                  {/* Cancel confirmation view */}
                  {isDeletingBooking ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                        <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
                        <div>
                          <h3 className="font-bold text-red-800">Cancel this booking?</h3>
                          <p className="text-sm text-red-600">
                            The customer will be notified. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reason for cancellation (optional)
                        </label>
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="e.g., Schedule conflict, emergency..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsDeletingBooking(false)}
                          className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
                          disabled={isSavingBooking}
                        >
                          Keep Booking
                        </button>
                        <button
                          onClick={handleCancelBooking}
                          disabled={isSavingBooking}
                          className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          {isSavingBooking ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              Cancel Booking
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : isEditingBooking ? (
                    /* Edit view */
                    <div className="space-y-4">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-primary-500" />
                        Edit Booking
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="MM/DD/YYYY"
                            value={editedDate}
                            onChange={(e) => {
                              let digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                              let formatted = '';
                              if (digits.length > 0) formatted = digits.slice(0, 2);
                              if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
                              if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
                              setEditedDate(formatted);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                          <input
                            type="time"
                            value={editedTime}
                            onChange={(e) => setEditedTime(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                          type="text"
                          value={editedLocation}
                          onChange={(e) => setEditedLocation(e.target.value)}
                          placeholder="Enter location..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        />
                      </div>
                      {selectedBookingInline.notes && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                          <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 italic">
                            "{selectedBookingInline.notes}"
                          </div>
                        </div>
                      )}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setIsEditingBooking(false)}
                          className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
                          disabled={isSavingBooking}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveBookingChanges}
                          disabled={isSavingBooking}
                          className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          {isSavingBooking ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode - booking details */
                    <div className="space-y-5">
                      {/* Customer Info */}
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                          {(selectedBookingInline.consumer.profilePictureUrl || selectedBookingInline.consumer.avatar) ? (
                            <img 
                              src={selectedBookingInline.consumer.profilePictureUrl || selectedBookingInline.consumer.avatar} 
                              alt="Customer" 
                              className="w-14 h-14 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-7 h-7 text-primary-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg">
                            {selectedBookingInline.consumer.firstName} {selectedBookingInline.consumer.lastName}
                          </h3>
                          {selectedBookingInline.consumer.email && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {selectedBookingInline.consumer.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Service Details */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Service</h4>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                          <span className="font-semibold text-gray-900">
                            {selectedBookingInline.serviceName || selectedBookingInline.serviceType}
                          </span>
                          <span className="font-bold text-green-600 text-lg">
                            ${(selectedBookingInline.priceUsdCents / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">When</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Calendar className="w-5 h-5 text-primary-500" />
                            <div>
                              <p className="text-xs text-gray-500">Date</p>
                              <p className="font-semibold text-gray-900">
                                {new Date(selectedBookingInline.scheduledTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Clock className="w-5 h-5 text-primary-500" />
                            <div>
                              <p className="text-xs text-gray-500">Time</p>
                              <p className="font-semibold text-gray-900">
                                {new Date(selectedBookingInline.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      {selectedBookingInline.location && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Where</h4>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <MapPin className="w-5 h-5 text-primary-500 flex-shrink-0" />
                            <p className="font-medium text-gray-900">{selectedBookingInline.location}</p>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {selectedBookingInline.notes && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Notes</h4>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <FileText className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                            <p className="text-gray-700 italic">"{selectedBookingInline.notes}"</p>
                          </div>
                        </div>
                      )}

                      {/* Booking Reference */}
                      <div className="text-center pt-2">
                        <p className="text-xs text-gray-400">Booking Reference</p>
                        <p className="font-mono text-sm text-gray-600 font-medium">
                          {selectedBookingInline.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      {(() => {
                        const canEdit = selectedBookingInline.status === 'ACCEPTED';
                        const canCancel = selectedBookingInline.status === 'ACCEPTED' || selectedBookingInline.status === 'PENDING';
                        const canComplete = selectedBookingInline.status === 'ACCEPTED';
                        
                        if (!canComplete && !canEdit && !canCancel) return null;
                        
                        return (
                          <div className="space-y-3 pt-4 border-t border-gray-100">
                            {canComplete && (
                              <button
                                onClick={handleCompleteBooking}
                                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                              >
                                <CreditCard className="w-4 h-4" />
                                Complete
                              </button>
                            )}
                            {(canEdit || canCancel) && (
                              <div className="flex gap-3">
                                {canEdit && (
                                  <button
                                    onClick={() => setIsEditingBooking(true)}
                                    className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Edit
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    onClick={() => setIsDeletingBooking(true)}
                                    className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 border border-red-200"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* Appointments list view */
                <>
                  {getAppointmentsForDate(selectedDate).length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                      <p className="text-gray-600">You have no appointments scheduled for this day.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAppointmentsForDate(selectedDate).map((apt) => {
                        const isCompleted = apt.status === 'COMPLETED' || apt.status === 'PAID';
                        return (
                        <div 
                          key={apt.id} 
                          onClick={() => selectBookingForInlineView(apt)}
                          className={`p-5 rounded-lg border transition-colors cursor-pointer ${
                            isCompleted 
                              ? 'bg-green-50 border-green-200 hover:border-green-400' 
                              : 'bg-gray-50 border-gray-200 hover:border-primary-300 hover:bg-gray-100'
                          }`}
                        >
                          {/* Top row: Client name + Price */}
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900 text-lg">{apt.consumer.firstName} {apt.consumer.lastName}</p>
                              {isCompleted && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✓ Completed</span>
                              )}
                            </div>
                            <p className="font-bold text-green-600 text-xl">${(apt.priceUsdCents / 100).toFixed(0)}</p>
                          </div>
                          {/* Service - prefer serviceName from input, fallback to serviceType */}
                          <p className="text-base text-gray-600 mb-2">
                            {apt.serviceName || apt.serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          {/* Location and Notes if available */}
                          {(apt.location || apt.notes) && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {apt.location && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm">
                                  <MapPin className="w-3 h-3" />
                                  {apt.location}
                              </span>
                              )}
                              {apt.notes && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                                  {apt.notes}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Bottom row: Time */}
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-primary-400 text-base">{new Date(apt.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                            <span className="text-sm text-gray-500">Tap for details →</span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Bookings Modal Component - View and manage all bookings
function BookingsModal({ isVisible, onClose, barberId }: { isVisible: boolean; onClose: () => void; barberId: string }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'past'>('today');
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);

  // Fetch bookings when modal opens
  useEffect(() => {
    if (isVisible && barberId) {
      fetchBookings();
    }
  }, [isVisible, barberId]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      // Fetch all bookings for this barber (ACCEPTED and COMPLETED)
      // Use role=barber to get bookings where user is the barber
      const response = await api.get(`/bookings-simple?role=barber`);
      // api.get already extracts data, so response is { bookings: [...] }
      const bookingsArray = response.bookings || response.data?.bookings || [];
      // Filter to only show ACCEPTED, COMPLETED, and PAID bookings
      const relevantBookings = bookingsArray.filter(
        (b: any) => b.status === 'ACCEPTED' || b.status === 'COMPLETED' || b.status === 'PAID'
      );
      setBookings(relevantBookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions
  const formatServiceType = (service: string) => {
    if (!service) return 'Service';
    return service.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    return date < now;
  };

  const isPaymentDue = (booking: any) => {
    // Payment is due if:
    // 1. Booking is ACCEPTED (not yet completed)
    // 2. Scheduled time was 15+ minutes ago
    if (booking.status !== 'ACCEPTED') return false;
    const scheduledTime = new Date(booking.scheduledTime);
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    return scheduledTime <= fifteenMinsAgo;
  };

  // Filter bookings by tab
  const filteredBookings = bookings.filter(booking => {
    const now = new Date();
    const bookingDate = new Date(booking.scheduledTime);
    
    if (activeTab === 'today') {
      return isToday(booking.scheduledTime) && booking.status === 'ACCEPTED';
    } else if (activeTab === 'upcoming') {
      return bookingDate > now && !isToday(booking.scheduledTime) && booking.status === 'ACCEPTED';
    } else {
      // Past: paid bookings, completed bookings (awaiting payment), OR past accepted bookings
      return booking.status === 'PAID' || booking.status === 'COMPLETED' || (booking.status === 'ACCEPTED' && isPast(booking.scheduledTime) && !isToday(booking.scheduledTime));
    }
  }).sort((a, b) => {
    // Sort by date (ascending for upcoming/today, descending for past)
    const dateA = new Date(a.scheduledTime).getTime();
    const dateB = new Date(b.scheduledTime).getTime();
    return activeTab === 'past' ? dateB - dateA : dateA - dateB;
  });

  // Mark booking as complete - triggers payment request
  const handleMarkComplete = async (bookingId: string) => {
    setMarkingComplete(bookingId);
    try {
      const response = await api.put(`/bookings-simple/${bookingId}/complete`);
      if (response.success) {
        toast.success('Service marked complete! Payment request sent to customer.');
        fetchBookings(); // Refresh list
      } else {
        toast.error(response.error || 'Failed to mark as complete');
      }
    } catch (error: any) {
      console.error('Failed to mark booking complete:', error);
      toast.error(error.message || 'Failed to mark as complete');
    } finally {
      setMarkingComplete(null);
    }
  };

  const getStatusBadge = (booking: any) => {
    if (booking.status === 'PAID') {
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">Paid</span>;
    }
    if (booking.status === 'COMPLETED') {
      // COMPLETED means awaiting payment
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold animate-pulse">Awaiting Payment</span>;
    }
    if (isPaymentDue(booking)) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold animate-pulse">Payment Due</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Confirmed</span>;
  };

  return (
    <div 
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90dvh] sm:max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 text-white px-6 py-4 flex items-center justify-between z-10">
                        <div>
            <h2 className="text-2xl font-bold">Bookings</h2>
            <p className="text-white/80 text-sm">{bookings.filter(b => b.status === 'ACCEPTED').length} active, {bookings.filter(b => b.status === 'COMPLETED' || b.status === 'PAID').length} completed</p>
                        </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
                      </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { key: 'today', label: 'Today' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No {activeTab} bookings</p>
              <p className="text-gray-400 text-sm mt-1">
                {activeTab === 'today' && 'No appointments scheduled for today'}
                {activeTab === 'upcoming' && 'No future appointments yet'}
                {activeTab === 'past' && 'No completed services yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const { date, time } = formatDateTime(booking.scheduledTime);
                // Show "Mark Complete" for all ACCEPTED bookings - barber can trigger payment at any time
                const showMarkComplete = booking.status === 'ACCEPTED';
                
                return (
                  <div 
                    key={booking.id} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      booking.status === 'PAID'
                        ? 'bg-gray-50 border-gray-200 hover:border-gray-400'
                        : isPaymentDue(booking) || booking.status === 'COMPLETED'
                          ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-400 hover:shadow-md'
                    }`}
                          onClick={() => {
                      setSelectedBooking(booking);
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      setShowBookingDetails(true);
                    }}
                  >
                    {/* Top Row: Customer + Status */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {(booking.consumer?.avatar || booking.consumer?.profileImageUrl) ? (
                            <img 
                              src={booking.consumer.avatar || booking.consumer.profileImageUrl} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-600 font-semibold text-sm">
                              {booking.consumer?.firstName?.[0]}{booking.consumer?.lastName?.[0]}
                            </span>
                          )}
                      </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {booking.consumer?.firstName} {booking.consumer?.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {booking.serviceName || formatServiceType(booking.serviceType)}
                          </p>
                    </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(booking)}
                        <p className="font-bold text-green-600 mt-1">{formatPrice(booking.priceUsdCents)}</p>
                      </div>
                    </div>

                    {/* Date/Time Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        {date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        {time}
                      </span>
                      {booking.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{booking.location}</span>
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {booking.notes && (
                      <div className="text-sm text-gray-500 italic mb-3 px-3 py-2 bg-white/50 rounded-lg">
                        "{booking.notes}"
                      </div>
                    )}

                    {/* Action Button */}
                    {showMarkComplete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent opening details modal
                          handleMarkComplete(booking.id);
                        }}
                        disabled={markingComplete === booking.id}
                        className={`w-full py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                          markingComplete === booking.id
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white active:scale-98'
                        }`}
                      >
                        {markingComplete === booking.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Mark Service Complete
                          </>
                        )}
                      </button>
                    )}

                    {/* Review display for completed/paid bookings */}
                    {(booking.status === 'COMPLETED' || booking.status === 'PAID') && booking.review && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-green-100" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className={star <= booking.review.rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                  ))}
                </div>
                        {booking.review.comment && (
                          <p className="text-sm text-gray-600 italic">"{booking.review.comment}"</p>
              )}
            </div>
                    )}
                    
                    {/* Tap to view details hint */}
                    <p className="text-xs text-gray-400 text-center mt-2">Tap to view details</p>
          </div>
                );
              })}
        </div>
      )}
        </div>
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={showBookingDetails}
        onClose={() => {
          setShowBookingDetails(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onBookingUpdated={fetchBookings}
      />
    </div>
  );
}

// Types for Calendly-style availability with multiple intervals per day
interface TimeInterval {
  id: string;
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  intervals: TimeInterval[];
}

interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

type DayKey = keyof WeeklyAvailability;

// Generate unique ID for intervals
const generateId = () => Math.random().toString(36).substring(2, 9);

// Default availability with intervals structure
const createDefaultAvailability = (): WeeklyAvailability => ({
  monday: { enabled: true, intervals: [{ id: generateId(), start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, intervals: [{ id: generateId(), start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, intervals: [{ id: generateId(), start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, intervals: [{ id: generateId(), start: '09:00', end: '17:00' }] },
  friday: { enabled: true, intervals: [{ id: generateId(), start: '09:00', end: '17:00' }] },
  saturday: { enabled: false, intervals: [] },
  sunday: { enabled: false, intervals: [] },
});

// Migrate old format (single start/end) to new format (intervals array)
const migrateSchedule = (schedule: Record<string, unknown>): WeeklyAvailability => {
  const days: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const migrated = createDefaultAvailability();
  
  for (const day of days) {
    const dayData = schedule[day] as { enabled?: boolean; start?: string; end?: string; intervals?: TimeInterval[] } | undefined;
    if (!dayData) continue;
    
    // If already has intervals array, use it
    if (dayData.intervals && Array.isArray(dayData.intervals) && dayData.intervals.length > 0) {
      // Filter out invalid intervals and provide defaults for missing fields
      const validIntervals = dayData.intervals
        .filter(i => i && (i.start || i.end)) // Keep intervals that have at least one time
        .map(i => ({
          id: i.id || generateId(),
          start: i.start || '09:00',
          end: i.end || '17:00'
        }));
      
      migrated[day] = {
        enabled: dayData.enabled ?? (validIntervals.length > 0),
        intervals: validIntervals
      };
    } 
    // Migrate from old single start/end format
    else if (dayData.start && dayData.end && dayData.enabled) {
      migrated[day] = {
        enabled: true,
        intervals: [{ id: generateId(), start: dayData.start, end: dayData.end }]
      };
    } 
    // Disabled day
    else {
      migrated[day] = {
        enabled: dayData.enabled ?? false,
        intervals: []
      };
    }
  }
  
  return migrated;
};

// Validation types
type IntervalError = {
  type: 'reverse' | 'overlap';
  message: string;
};

type ValidationErrors = {
  [day in DayKey]?: {
    [intervalId: string]: IntervalError;
  };
};

// Helper to convert time string to minutes
const timeToMinutes = (time: string | undefined | null): number => {
  if (!time || typeof time !== 'string' || !time.includes(':')) {
    return 0;
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
};

// Validate all intervals and return errors
const validateAvailability = (availability: WeeklyAvailability): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  const dayKeys: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (const day of dayKeys) {
    const intervals = availability[day].intervals;
    
    for (let i = 0; i < intervals.length; i++) {
      const current = intervals[i];
      const startMins = timeToMinutes(current.start);
      const endMins = timeToMinutes(current.end);
      
      // Check for reverse time (start >= end)
      if (startMins >= endMins) {
        if (!errors[day]) errors[day] = {};
        errors[day]![current.id] = {
          type: 'reverse',
          message: 'End time must be after start time'
        };
        continue; // Skip overlap check if times are reversed
      }
      
      // Check for overlaps with other intervals
      for (let j = 0; j < intervals.length; j++) {
        if (i === j) continue;
        
        const other = intervals[j];
        const otherStartMins = timeToMinutes(other.start);
        const otherEndMins = timeToMinutes(other.end);
        
        // Skip if other interval has reverse times
        if (otherStartMins >= otherEndMins) continue;
        
        // Check for overlap
        if (startMins < otherEndMins && endMins > otherStartMins) {
          if (!errors[day]) errors[day] = {};
          errors[day]![current.id] = {
            type: 'overlap',
            message: 'Time slots cannot overlap'
          };
          break;
        }
      }
    }
  }
  
  return errors;
};

// Availability Modal Component - Calendly-style with multiple intervals per day
function AvailabilityModal({ isVisible, onClose, userId }: { isVisible: boolean; onClose: () => void; userId?: string }) {
  const [availability, setAvailability] = useState<WeeklyAvailability>(createDefaultAvailability);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [barberId, setBarberId] = useState<string | null>(null);

  // Compute validation errors whenever availability changes
  const validationErrors = useMemo(() => validateAvailability(availability), [availability]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

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
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setBarberId(data.data.id);
          if (data.data.weekly_schedule) {
            // Migrate old format to new format if needed
            const migratedSchedule = migrateSchedule(data.data.weekly_schedule);
            setAvailability(migratedSchedule);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const days: { key: DayKey; label: string; shortLabel: string }[] = [
    { key: 'sunday', label: 'Sunday', shortLabel: 'S' },
    { key: 'monday', label: 'Monday', shortLabel: 'M' },
    { key: 'tuesday', label: 'Tuesday', shortLabel: 'T' },
    { key: 'wednesday', label: 'Wednesday', shortLabel: 'W' },
    { key: 'thursday', label: 'Thursday', shortLabel: 'T' },
    { key: 'friday', label: 'Friday', shortLabel: 'F' },
    { key: 'saturday', label: 'Saturday', shortLabel: 'S' },
  ];

  const addInterval = (day: DayKey) => {
    setAvailability(prev => {
      const dayData = prev[day];
      const lastInterval = dayData.intervals[dayData.intervals.length - 1];
      
      // Calculate next interval start (end of last interval + 1 hour)
      let newStart = '09:00';
      if (lastInterval && lastInterval.end && lastInterval.end.includes(':')) {
        const [hours] = lastInterval.end.split(':').map(Number);
        if (!isNaN(hours)) {
          const nextHour = Math.min(hours + 1, 23);
          newStart = `${nextHour.toString().padStart(2, '0')}:00`;
        }
      }
      
      // End time is 2 hours after start
      const [startHours] = newStart.split(':').map(Number);
      const endHour = Math.min(startHours + 2, 23);
      const newEnd = `${endHour.toString().padStart(2, '0')}:00`;
      
      return {
        ...prev,
        [day]: {
          enabled: true,
          intervals: [
            ...dayData.intervals,
            { id: generateId(), start: newStart, end: newEnd }
          ]
        }
      };
    });
  };

  const removeInterval = (day: DayKey, intervalId: string) => {
    setAvailability(prev => {
      const newIntervals = prev[day].intervals.filter(i => i.id !== intervalId);
      return {
        ...prev,
        [day]: {
          enabled: newIntervals.length > 0,
          intervals: newIntervals
        }
      };
    });
  };

  const updateInterval = (day: DayKey, intervalId: string, field: 'start' | 'end', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        intervals: prev[day].intervals.map(i => 
          i.id === intervalId ? { ...i, [field]: value } : i
        )
      }
    }));
  };

  const handleSave = async () => {
    if (!barberId) {
      console.error('No barber ID found');
      return;
    }
    
    // Safety check - should be disabled in UI but double-check
    if (hasValidationErrors) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/barbers/${barberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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

  // Format time for display (12-hour format)
  const formatTime = (time24: string | undefined | null): string => {
    if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) {
      return 'N/A';
    }
    const [hourStr, minuteStr] = time24.split(':');
    const hour = parseInt(hourStr, 10);
    if (isNaN(hour)) return 'N/A';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'am' : 'pm';
    return `${displayHour}:${minuteStr}${period}`;
  };

  return (
    <div 
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${isVisible ? 'bg-black/50' : 'bg-black/0'}`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Set Your Availability</h2>
            <p className="text-white/80 text-sm">Add multiple time slots per day</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {days.map(({ key, label, shortLabel }) => (
                <div 
                  key={key}
                  className={`rounded-xl border-2 transition-all overflow-hidden ${
                    availability[key].enabled && availability[key].intervals.length > 0
                      ? 'border-primary-200 bg-primary-50/50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-center gap-3 p-3 sm:p-4">
                    {/* Day letter badge */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      availability[key].enabled && availability[key].intervals.length > 0
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {shortLabel}
                    </div>
                    
                    {/* Day name and intervals or unavailable */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 hidden sm:block">{label}</div>
                      
                      {availability[key].intervals.length === 0 ? (
                        <span className="text-gray-400 text-sm">Unavailable</span>
                      ) : (
                        <div className="space-y-2 mt-2">
                          {availability[key].intervals.map((interval, idx) => {
                            const intervalError = validationErrors[key]?.[interval.id];
                            return (
                              <div key={interval.id}>
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <TimeInput
                                    value={interval.start}
                                    onChange={(value) => updateInterval(key, interval.id, 'start', value)}
                                    aria-label={`${label} start time`}
                                    className="w-[5.5rem] sm:w-28"
                                    error={!!intervalError}
                                  />
                                  <span className="text-gray-400 text-sm">-</span>
                                  <TimeInput
                                    value={interval.end}
                                    onChange={(value) => updateInterval(key, interval.id, 'end', value)}
                                    aria-label={`${label} end time`}
                                    className="w-[5.5rem] sm:w-28"
                                    error={!!intervalError}
                                  />
                                  <button
                                    onClick={() => removeInterval(key, interval.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    title={`Remove ${label} interval ${idx + 1}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                {intervalError && (
                                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {intervalError.message}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {/* Add interval button */}
                      <button
                        onClick={() => addInterval(key)}
                        className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                        title={`Add time slot for ${label}`}
                      >
                        <svg viewBox="0 0 10 10" className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="5" cy="5" r="4.5" />
                          <path d="M5 3v4M3 5h4" />
                        </svg>
                      </button>
                      
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || hasValidationErrors}>
            {isSaving ? 'Saving...' : hasValidationErrors ? 'Fix Errors to Save' : 'Save Availability'}
          </Button>
        </div>
      </div>
    </div>
  );
}
