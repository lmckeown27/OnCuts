/**
 * ConsumerBookingStatusPage - Shows consumer their active booking status
 * Displays pending → accepted flow and any changes made by barber
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Clock, Check, X, Calendar, MapPin, DollarSign, User, 
  MessageCircle, AlertTriangle, Bell, CheckCircle, Edit3,
  ChevronDown, Settings, LogOut, Trash2
} from 'lucide-react';
import api from '../services/api.service';
import notificationService from '../services/notification.service';
import { useAuthStore } from '../store/useAuthStore';
import { CampusCutLogo } from '@assets';
import Avatar from '../components/Avatar';
import toast from 'react-hot-toast';

interface ActiveBooking {
  id: string;
  barberId: string;
  barberName: string;
  barberAvatar?: string;
  serviceName: string;
  serviceType: string;
  priceUsdCents: number;
  scheduledTime: string;
  location?: string;
  notes?: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  // Original values (for detecting edits)
  originalScheduledTime?: string;
  originalLocation?: string;
  // Flags
  hasEdits?: boolean;
  editsAcknowledged?: boolean;
}

export default function ConsumerBookingStatusPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const { user } = useAuthStore();
  
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
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

  useEffect(() => {
    fetchActiveBooking();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchActiveBooking, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveBooking = async () => {
    try {
      // Fetch consumer's active bookings (PENDING or ACCEPTED)
      const response = await api.get('/bookings-simple', { 
        role: 'consumer',
        status: 'PENDING,ACCEPTED' 
      });
      
      const bookings = response.bookings || [];
      
      // Get the most recent active booking
      const activeBooking = bookings
        .filter((b: any) => b.status === 'PENDING' || b.status === 'ACCEPTED')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (activeBooking) {
        // Fetch notifications to check for booking updates
        let hasEdits = false;
        let originalScheduledTime: string | undefined;
        
        try {
          const notifResponse = await notificationService.getNotifications();
          
          // Find the most recent booking_updated notification for this booking
          const updateNotification = notifResponse.notifications
            .filter((n: any) => 
              n.type === 'booking_updated' && 
              n.data?.bookingId === activeBooking.id
            )
            .sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
          
          if (updateNotification && updateNotification.data?.originalScheduledTime) {
            originalScheduledTime = updateNotification.data.originalScheduledTime;
            hasEdits = new Date(activeBooking.scheduledTime).getTime() !== 
                       new Date(originalScheduledTime).getTime();
          }
        } catch (notifError) {
          console.error('Failed to fetch notifications for edit detection:', notifError);
        }
        
        setBooking({
          ...activeBooking,
          originalScheduledTime,
          hasEdits,
          editsAcknowledged: !hasEdits, // If no edits, consider acknowledged
        });
      } else {
        setBooking(null);
      }
    } catch (error) {
      console.error('Failed to fetch active booking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDiscover = () => {
    navigate(`${platformPrefix}/consumer`);
  };

  const handleMessageBarber = () => {
    if (booking) {
      navigate(`${platformPrefix}/consumer/messages`);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    setIsSaving(true);
    
    try {
      await api.delete(`/bookings-simple/${booking.id}`, { reason: cancelReason || undefined });
      toast.success('Booking cancelled');
      setShowCancelConfirm(false);
      navigate(`${platformPrefix}/consumer`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!booking) return;
    
    // Initialize edit fields with current booking values
    const scheduledDate = new Date(booking.scheduledTime);
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const year = scheduledDate.getFullYear();
    setEditDate(`${month}/${day}/${year}`);
    
    const hours = scheduledDate.getHours();
    const minutes = scheduledDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    setEditTime(`${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`);
    
    setEditLocation(booking.location || '');
    setEditNotes(booking.notes || '');
    
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!booking) return;
    setIsSaving(true);
    
    try {
      // Parse the edited date and time
      const [month, day, year] = editDate.split('/').map(Number);
      const timeMatch = editTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      
      if (!timeMatch) {
        toast.error('Invalid time format');
        setIsSaving(false);
        return;
      }
      
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const newScheduledTime = new Date(year, month - 1, day, hours, minutes);
      
      await api.put(`/bookings-simple/${booking.id}`, {
        scheduledTime: newScheduledTime.toISOString(),
        location: editLocation,
        notes: editNotes,
      });
      
      toast.success('Booking updated!');
      setShowEditModal(false);
      fetchActiveBooking(); // Refresh booking data
    } catch (error: any) {
      toast.error(error.message || 'Failed to update booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcknowledgeEdits = async () => {
    if (!booking) return;
    
    toast.success('Changes acknowledged!');
    setBooking(prev => prev ? { ...prev, editsAcknowledged: true, hasEdits: false } : null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <img src={CampusCutLogo} alt="CampusCut" className="h-8" />
            <button
              onClick={handleBackToDiscover}
              className="text-primary-600 font-semibold hover:text-primary-700"
            >
              Find Barbers
            </button>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Booking</h2>
          <p className="text-gray-600 mb-6">You don't have any pending or confirmed bookings.</p>
          <button
            onClick={handleBackToDiscover}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
          >
            Find a Barber
          </button>
        </div>
      </div>
    );
  }

  const isPending = booking.status === 'PENDING';
  const isAccepted = booking.status === 'ACCEPTED';

  const handleGoToMessages = () => {
    navigate(`${platformPrefix}/consumer/messages`);
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate(`${platformPrefix}`);
    setShowProfileDropdown(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleGoToMessages}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MessageCircle className="w-6 h-6 text-gray-600" />
          </button>
          <img src={CampusCutLogo} alt="CampusCut" className="h-10" />
          
          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-1 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Avatar src={user?.profile_picture_url} alt={user?.first_name || 'User'} size="md" />
              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 truncate">{user?.first_name} {user?.last_name}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
                
                {/* Notifications */}
                <button
                  onClick={() => {
                    navigate(`${platformPrefix}/consumer`);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                >
                  <Bell className="w-4 h-4 text-gray-500" />
                  Notifications
                </button>
                
                {/* Edit Profile */}
                <button
                  onClick={() => {
                    navigate(`${platformPrefix}/consumer`);
                    setShowProfileDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  Edit Profile
                </button>
                
                <div className="border-t border-gray-200 my-1"></div>
                
                {/* Sign Out */}
                <button
                  onClick={handleLogout}
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

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Status Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Booking Status</h2>
          
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-10 right-10 h-1 bg-gray-200 rounded-full">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isAccepted ? 'w-full bg-green-500' : 'w-0 bg-primary-500'
                }`}
              />
            </div>
            
            {/* Step 1: Pending */}
            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isPending 
                  ? 'bg-amber-100 text-amber-600 ring-4 ring-amber-50' 
                  : 'bg-green-100 text-green-600'
              }`}>
                {isPending ? <Clock className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              </div>
              <span className={`text-sm mt-2 font-medium ${isPending ? 'text-amber-600' : 'text-green-600'}`}>
                {isPending ? 'Pending' : 'Submitted'}
              </span>
            </div>
            
            {/* Step 2: Accepted */}
            <div className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isAccepted 
                  ? 'bg-green-100 text-green-600 ring-4 ring-green-50' 
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {isAccepted ? <CheckCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              </div>
              <span className={`text-sm mt-2 font-medium ${isAccepted ? 'text-green-600' : 'text-gray-400'}`}>
                Confirmed
              </span>
            </div>
          </div>
          
          {isPending && (
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Waiting for barber confirmation</p>
                  <p className="text-sm text-amber-600 mt-1">
                    {booking.barberName} will review and confirm your booking request.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {isAccepted && (
            <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800">Booking Confirmed!</p>
                  <p className="text-sm text-green-600 mt-1">
                    Your appointment with {booking.barberName} is confirmed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edits Alert */}
        {booking.hasEdits && !booking.editsAcknowledged && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-amber-300 p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Edit3 className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2">Barber Made Changes</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {booking.barberName} has updated some details of your booking. Please review the changes below.
                </p>
                
                {/* Show what changed */}
                <div className="space-y-2 mb-4">
                  {booking.originalScheduledTime && 
                   new Date(booking.scheduledTime).getTime() !== new Date(booking.originalScheduledTime).getTime() && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span className="text-gray-500 line-through">
                        {formatDate(booking.originalScheduledTime)} at {formatTime(booking.originalScheduledTime)}
                      </span>
                      <span className="text-gray-900 font-medium">
                        → {formatDate(booking.scheduledTime)} at {formatTime(booking.scheduledTime)}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleAcknowledgeEdits}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    OK with Changes
                  </button>
                  <button
                    onClick={handleMessageBarber}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message Barber
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Booking Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Booking Details</h3>
          
          {/* Barber Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
              {booking.barberAvatar ? (
                <img src={booking.barberAvatar} alt={booking.barberName} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-primary-600" />
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900">{booking.barberName}</p>
              <p className="text-sm text-gray-500">Your Barber</p>
            </div>
          </div>
          
          {/* Service & Price */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl mb-4">
            <div>
              <p className="font-semibold text-gray-900">{booking.serviceName || booking.serviceType}</p>
              <p className="text-sm text-gray-500">Service</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatPrice(booking.priceUsdCents)}</p>
          </div>
          
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-gray-500">Date</span>
              </div>
              <p className="font-semibold text-gray-900">{formatDate(booking.scheduledTime)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-gray-500">Time</span>
              </div>
              <p className="font-semibold text-gray-900">{formatTime(booking.scheduledTime)}</p>
            </div>
          </div>
          
          {/* Location */}
          {booking.location && (
            <div className="p-4 bg-gray-50 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-gray-500">Location</span>
              </div>
              <p className="font-semibold text-gray-900">{booking.location}</p>
            </div>
          )}
          
          {/* Notes */}
          {booking.notes && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Your Notes</p>
              <p className="text-gray-700 italic">"{booking.notes}"</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleMessageBarber}
            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Message {booking.barberName}
          </button>
          
          {/* Edit and Cancel buttons for pending and accepted bookings */}
          {(isPending || isAccepted) && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleOpenEditModal}
                className="py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-amber-200"
              >
                <Edit3 className="w-4 h-4" />
                Edit Booking
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-200"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
        
        {/* Booking Reference */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">Booking Reference</p>
          <p className="font-mono text-sm text-gray-600">{booking.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary-500" />
              Edit Booking
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date (MM/DD/YYYY)</label>
                <input
                  type="text"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time (e.g., 9:00 AM)</label>
                <input
                  type="text"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  placeholder="9:00 AM"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Where should the appointment take place?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any special requests or notes for your barber..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Cancel Booking
            </h3>
            <p className="text-gray-600 mb-4">Are you sure you want to cancel this booking? This action cannot be undone.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the barber know why you're cancelling..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelReason('');
                }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={isSaving}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

