/**
 * Barber Dashboard Page - Version 4.0 (Cache Buster)
 * Last updated: 2025-12-18 00:15:00
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, DollarSign, TrendingUp, Settings, LogOut, ChevronDown, ChevronLeft, ChevronRight, Scissors, Inbox, Shield, MapPin, MessageCircle, MessageSquare, Search, Filter, X, Clock, Zap, ArrowLeft, Bell, AlertCircle, Check } from 'lucide-react';
import notificationService, { Notification } from '../services/notification.service';
import api from '../services/api.service';
import Avatar from '../components/Avatar';
import Button from '../components/Button';
import Card from '../components/Card';
import TimePickerDropdown from '../components/TimePickerDropdown';
import BarberProfileEditor from '../components/BarberProfileEditor';
import BarberServiceSpecialties from '../components/BarberServiceSpecialties';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusManagerBadge } from '../components/CampusManagerBadge';
import { CampusManagerDashboard } from '../components/CampusManagerDashboard';
import ServiceDetailsModal from '../components/ServiceDetailsModal';
import WalkInPaymentModal from '../components/WalkInPaymentModal';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';
import { useMessageStore } from '../store/useMessageStore';
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
  
  const [showBookings, setShowBookings] = useState(false);
  const [isBookingsVisible, setIsBookingsVisible] = useState(false);
  
  const [showAvailability, setShowAvailability] = useState(false);
  
  const [showWalkInPayment, setShowWalkInPayment] = useState(false);
  const [isAvailabilityVisible, setIsAvailabilityVisible] = useState(false);
  
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Lock body scroll when any modal is open
  const isAnyModalOpen = showProfileEditor || showServiceSpecialties || showCampusManagerDashboard || showBookings || showAvailability || showServiceDetails || showWalkInPayment || showNotifications;
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
  
  const openBookings = () => openModal(setShowBookings, setIsBookingsVisible);
  const closeBookings = () => closeModal(setShowBookings, setIsBookingsVisible);
  
  const openAvailability = () => openModal(setShowAvailability, setIsAvailabilityVisible);
  const closeAvailability = () => closeModal(setShowAvailability, setIsAvailabilityVisible);
  
  // Get barber data from auth - in production this would come from API
  const { user } = useAuthStore();
  const barberId = user?.id || '';
  const isCampusManager = user?.is_campus_manager || user?.user_type === 'campus_manager';
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
            {/* Left section - Switch to Consumer + Campus Manager Badge */}
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
            
            {/* Right section - Messages, Booking Requests + Profile */}
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Messages Button */}
              <button
                onClick={() => navigate(`${platformPrefix}/barber/messages`)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                title="Messages"
              >
                <MessageCircle className="w-5 h-5 text-gray-600" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
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

      {/* Campus Manager Dashboard Modal (conditional) */}
      {isCampusManager && showCampusManagerDashboard && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isCampusManagerVisible ? 'bg-black/50' : 'bg-black/0'}`}
          onClick={closeCampusManager}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-3xl w-full h-[95vh] sm:h-[92vh] overflow-y-auto transition-all duration-150 ease-out
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
            <div className="p-4 sm:p-6">
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

      {/* Bookings Modal */}
      {showBookings && (
        <BookingsModal 
          isVisible={isBookingsVisible} 
          onClose={closeBookings}
          barberId={barberId}
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

      {/* Notifications Modal */}
      {showNotifications && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNotifications(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden transform transition-all"
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
    </div>
  );
}

interface DashboardViewProps {
  navigate: any;
  barberId: string;
  onViewDetails: (appointmentId: string) => void;
  onWalkInClick: () => void;
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
  };
}

function DashboardView({ navigate, barberId, onViewDetails, onWalkInClick }: DashboardViewProps) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Full date for modal
  const [showDayModal, setShowDayModal] = useState(false);
  const [isDayModalVisible, setIsDayModalVisible] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, 1 = next month, etc.
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, etc.
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const modalRef = useRef<HTMLDivElement>(null);
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  
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
        // Fetch ACCEPTED bookings for the barber's schedule
        const response = await api.get<{ bookings: ConfirmedBooking[] }>('/bookings-simple', {
          role: 'barber',
          status: 'ACCEPTED',
        });
        
        setConfirmedBookings(response.bookings || []);
      } catch (error) {
        console.error('Error fetching confirmed bookings:', error);
      } finally {
        setIsLoadingBookings(false);
      }
    };
    
    fetchConfirmedBookings();
  }, []);

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
          {/* View Toggle Buttons with Walk-in aligned above Weekly */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 justify-items-center">
            {/* Empty cell above Daily */}
            <div></div>
            {/* Walk-in Button - aligned above Weekly */}
            <button
              onClick={onWalkInClick}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors text-sm sm:text-base font-semibold min-w-[5rem] sm:min-w-[6rem] text-center"
              title="Quick payment for walk-in customers"
            >
              Walk-in
            </button>
            {/* Empty cell above Monthly */}
            <div></div>
            
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
        </div>

        {/* Daily View */}
        {scheduleView === 'daily' && (() => {
          // Filter bookings for the selected day (using dayOffset)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
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
          const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const dayLabel = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : dayOffset === -1 ? 'Yesterday' : '';
          const dateFormatted = displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

          return (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setDayOffset(prev => prev - 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[200px] sm:min-w-[280px] text-center">
                    {dayLabel ? `${dayLabel} - ` : ''}{dateFormatted}
                  </h3>
                  <button 
                    onClick={() => setDayOffset(prev => prev + 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                  {dayOffset !== 0 && (
                    <button 
                      onClick={() => setDayOffset(0)}
                      className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                      Today
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">{dailyAppointments.length} appointment{dailyAppointments.length !== 1 ? 's' : ''}</p>
              </div>
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
                  {dailyAppointments.map((apt) => (
                    <div 
                      key={apt.id} 
                      onClick={() => onViewDetails(apt.id)}
                      className="p-5 sm:p-6 bg-gray-50 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-gray-100 active:scale-98 transition-all cursor-pointer"
                    >
                      {/* Top row: Client name + Price */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="font-bold text-gray-900 text-lg sm:text-xl">{apt.consumer.firstName} {apt.consumer.lastName}</p>
                        <p className="font-bold text-green-600 text-xl sm:text-2xl">{formatPrice(apt.priceUsdCents)}</p>
                      </div>
                      {/* Service - prefer serviceName from input, fallback to serviceType */}
                      <p className="text-base sm:text-lg text-gray-600 mb-2">
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
                        <p className="font-bold text-primary-400 text-base sm:text-lg">{formatTime(apt.scheduledTime)}</p>
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
          // Get the week based on weekOffset
          const today = new Date();
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setWeekOffset(prev => prev - 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[180px] sm:min-w-[240px] text-center">Week of {weekRangeText}</h3>
                  <button 
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                  {weekOffset !== 0 && (
                    <button 
                      onClick={() => setWeekOffset(0)}
                      className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                      This Week
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">{totalWeekAppointments} appointment{totalWeekAppointments !== 1 ? 's' : ''} this week</p>
              </div>
              
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
                          <div className={`text-sm ${isToday ? 'text-white/70' : 'text-gray-500'}`}>
                            {dayBookings.length === 0 ? 'No appointments' : `${dayBookings.length} appointment${dayBookings.length > 1 ? 's' : ''}`}
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
          const today = new Date();
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 mb-4 sm:mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setMonthOffset(prev => prev - 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 min-w-[160px] text-center">{monthName}</h3>
                  <button 
                    onClick={() => setMonthOffset(prev => prev + 1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                  {monthOffset !== 0 && (
                    <button 
                      onClick={() => setMonthOffset(0)}
                      className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                    >
                      Today
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">{totalMonthAppointments} appointment{totalMonthAppointments !== 1 ? 's' : ''} this month</p>
              </div>
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
                  const isToday = day === today.getDate();
                  
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
                      {/* Mobile: Show +X bookings count */}
                      <div className="sm:hidden flex justify-center">
                        {hasAppointments && (
                          <div className={`text-base font-bold ${isToday ? 'text-white' : 'text-primary-500'}`}>
                            +{dayBookings.length}
                          </div>
                        )}
                      </div>
                      {/* Desktop: Show names */}
                      <div className="hidden sm:block text-sm space-y-0.5 overflow-hidden">
                        {dayBookings.length === 0 ? (
                          <div className={isToday ? 'text-white/60' : 'text-gray-400'}>No apts</div>
                        ) : dayBookings.length === 1 ? (
                          <div className="truncate font-medium">
                            {dayBookings[0].serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - {dayBookings[0].consumer.firstName}
                          </div>
                        ) : (
                          <>
                            <div className="truncate font-medium">
                              {dayBookings[0].serviceType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - {dayBookings[0].consumer.firstName}
                            </div>
                            <div className={`font-semibold ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                              +{dayBookings.length - 1} more
                            </div>
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
                  <h2 className="text-2xl font-bold">
                    {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p className="text-white/80">
                    {getAppointmentsForDate(selectedDate).length} appointment{getAppointmentsForDate(selectedDate).length !== 1 ? 's' : ''}
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
              {getAppointmentsForDate(selectedDate).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No appointments scheduled</h3>
                  <p className="text-gray-600">You have no appointments scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAppointmentsForDate(selectedDate).map((apt) => (
                    <div 
                      key={apt.id} 
                      onClick={() => {
                        closeDayModal();
                        onViewDetails(apt.id);
                      }}
                      className="p-5 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      {/* Top row: Client name + Price */}
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="font-bold text-gray-900 text-lg">{apt.consumer.firstName} {apt.consumer.lastName}</p>
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

// Bookings Modal Component - View and manage all bookings
function BookingsModal({ isVisible, onClose, barberId }: { isVisible: boolean; onClose: () => void; barberId: string }) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'past'>('today');
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);

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
      if (response.data?.bookings) {
        // Filter to only show ACCEPTED and COMPLETED bookings
        const relevantBookings = response.data.bookings.filter(
          (b: any) => b.status === 'ACCEPTED' || b.status === 'COMPLETED'
        );
        setBookings(relevantBookings);
      }
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
      // Past: completed bookings OR past accepted bookings
      return booking.status === 'COMPLETED' || (booking.status === 'ACCEPTED' && isPast(booking.scheduledTime) && !isToday(booking.scheduledTime));
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
    if (booking.status === 'COMPLETED') {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Completed</span>;
    }
    if (isPaymentDue(booking)) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold animate-pulse">Payment Due</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Confirmed</span>;
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
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
            <p className="text-white/80 text-sm">{bookings.filter(b => b.status === 'ACCEPTED').length} active, {bookings.filter(b => b.status === 'COMPLETED').length} completed</p>
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
                const showMarkComplete = booking.status === 'ACCEPTED' && (activeTab === 'today' || isPaymentDue(booking));
                
                return (
                  <div 
                    key={booking.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isPaymentDue(booking) 
                        ? 'bg-amber-50 border-amber-200' 
                        : booking.status === 'COMPLETED'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    {/* Top Row: Customer + Status */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600 font-semibold text-sm">
                            {booking.consumer?.firstName?.[0]}{booking.consumer?.lastName?.[0]}
                          </span>
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
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {time}
                      </span>
                      {booking.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {booking.location}
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
                        onClick={() => handleMarkComplete(booking.id)}
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

                    {/* Review display for completed bookings */}
                    {booking.status === 'COMPLETED' && booking.review && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-green-100">
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
                  </div>
                );
              })}
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
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
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
