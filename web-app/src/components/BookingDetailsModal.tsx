/**
 * BookingDetailsModal - In-depth booking details popup for barbers
 * Allows viewing all booking details and editing/cancelling bookings
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Calendar, Clock, MapPin, User, DollarSign, FileText, 
  Edit3, Trash2, Check, AlertTriangle, Star, MessageSquare,
  Phone, Mail, Save, CreditCard
} from 'lucide-react';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import TimePickerDropdown from './TimePickerDropdown';

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onBookingUpdated?: () => void;
}

export default function BookingDetailsModal({ 
  isOpen, 
  onClose, 
  booking, 
  onBookingUpdated 
}: BookingDetailsModalProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  // Editable fields (notes are read-only - set by consumer)
  const [editedDate, setEditedDate] = useState(''); // MM/DD/YYYY
  const [editedTime, setEditedTime] = useState(''); // HH:MM (24-hour for TimePickerDropdown)
  const [editedLocation, setEditedLocation] = useState('');
  
  // Store original date parts for smart autocomplete
  const [originalDateParts, setOriginalDateParts] = useState<{ month: number; day: number; year: number } | null>(null);

  // Format date as MM/DD/YYYY
  const formatDateForDisplay = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Format time as HH:MM (24-hour) for TimePickerDropdown
  const formatTimeFor24Hour = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Auto-format date input (MM/DD/YYYY)
  const handleDateChange = (value: string) => {
    // Remove all non-digits
    let digits = value.replace(/\D/g, '');
    
    // Limit to 8 digits
    digits = digits.slice(0, 8);
    
    // Auto-format with slashes
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += '/' + digits.slice(2, 4);
    }
    if (digits.length > 4) {
      formatted += '/' + digits.slice(4, 8);
    }
    
    setEditedDate(formatted);
  };

  // Parse date input with smart autocomplete from original date
  // - Just month (MM) → use original day and year
  // - Month and day (MM/DD) → use original year
  // - Full date (MM/DD/YYYY) → use as-is
  const parseDateInput = (dateStr: string): { month: number; day: number; year: number } | null => {
    const parts = dateStr.split('/').filter(p => p.length > 0);
    
    if (parts.length === 0) return null;
    
    const month = parseInt(parts[0]);
    if (isNaN(month) || month < 1 || month > 12) return null;
    
    // Get day - from input or original
    let day: number;
    if (parts.length >= 2 && parts[1].length > 0) {
      day = parseInt(parts[1]);
      if (isNaN(day) || day < 1 || day > 31) return null;
    } else if (originalDateParts) {
      day = originalDateParts.day;
    } else {
      return null;
    }
    
    // Get year - from input or original
    let year: number;
    if (parts.length >= 3 && parts[2].length === 4) {
      year = parseInt(parts[2]);
      if (isNaN(year) || year < 2024 || year > 2099) return null;
    } else if (originalDateParts) {
      year = originalDateParts.year;
    } else {
      return null;
    }
    
    return { month, day, year };
  };

  // Parse HH:MM (24-hour) to hours and minutes
  const parseTimeInput = (timeStr: string): { hours: number; minutes: number } | null => {
    const [hourStr, minuteStr] = timeStr.split(':');
    const hours = parseInt(hourStr);
    const minutes = parseInt(minuteStr);
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
  };

  // Initialize editable fields when booking changes
  useEffect(() => {
    if (booking) {
      const scheduledTime = new Date(booking.scheduledTime);
      setEditedDate(formatDateForDisplay(scheduledTime));
      setEditedTime(formatTimeFor24Hour(scheduledTime));
      setEditedLocation(booking.location || '');
      // Store original date parts for smart autocomplete
      setOriginalDateParts({
        month: scheduledTime.getMonth() + 1,
        day: scheduledTime.getDate(),
        year: scheduledTime.getFullYear(),
      });
    }
  }, [booking]);

  // All hooks must be called before any early returns
  const handleSaveChanges = useCallback(async () => {
    if (!booking) return;
    
    // Validate date format
    const dateParts = parseDateInput(editedDate);
    if (!dateParts) {
      toast.error('Please enter a valid date (MM/DD/YYYY)');
      return;
    }

    // Validate time format (HH:MM from dropdown)
    const timeParts = parseTimeInput(editedTime);
    if (!timeParts) {
      toast.error('Please select a valid time');
      return;
    }

    setIsSaving(true);
    try {
      // Combine date and time into scheduledTime
      const newScheduledTime = new Date(
        dateParts.year,
        dateParts.month - 1, // months are 0-indexed
        dateParts.day,
        timeParts.hours,
        timeParts.minutes
      );
      
      await api.put(`/bookings-simple/${booking.id}`, {
        scheduledTime: newScheduledTime.toISOString(),
        location: editedLocation || null,
      });

      toast.success('Booking updated successfully!');
      setIsEditing(false);
      onBookingUpdated?.();
    } catch (error: any) {
      console.error('Failed to update booking:', error);
      toast.error(error.message || 'Failed to update booking');
    } finally {
      setIsSaving(false);
    }
  }, [editedDate, editedTime, editedLocation, booking, onBookingUpdated]);

  // Handle Enter key to save changes
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isEditing && !isSaving) {
      e.preventDefault();
      handleSaveChanges();
    }
  }, [isEditing, isSaving, handleSaveChanges]);

  // Early return AFTER all hooks
  if (!isOpen || !booking) return null;

  const scheduledTime = new Date(booking.scheduledTime);
  const formattedDate = scheduledTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = scheduledTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'bg-blue-100 text-blue-700';
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleCancelBooking = async () => {
    setIsSaving(true);
    try {
      await api.delete(`/bookings-simple/${booking.id}`, {
        reason: cancelReason || undefined,
      });

      toast.success('Booking cancelled successfully');
      setIsDeleting(false);
      onClose();
      onBookingUpdated?.();
    } catch (error: any) {
      console.error('Failed to cancel booking:', error);
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteBooking = async () => {
    try {
      // Request payment from consumer - this sends them a notification
      await api.post(`/bookings-simple/${booking.id}/request-payment`, {});
      toast.success('Payment request sent to customer');
      onClose();
      // Navigate to barber's payment waiting page
      navigate(`/web/payment/${booking.id}`);
    } catch (error: any) {
      console.error('Failed to request payment:', error);
      toast.error(error.message || 'Failed to request payment');
    }
  };

  const canEdit = booking.status === 'ACCEPTED';
  const canCancel = booking.status === 'ACCEPTED' || booking.status === 'PENDING';
  const canComplete = booking.status === 'ACCEPTED';

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-[60] flex items-start sm:items-center justify-center p-2 pt-4 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Booking Details</h2>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
              {booking.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(92dvh-80px)] sm:max-h-[calc(90vh-80px)]">
          {/* Delete Confirmation View */}
          {isDeleting ? (
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
                  onClick={() => setIsDeleting(false)}
                  className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
                  disabled={isSaving}
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelBooking}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
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
          ) : isEditing ? (
            /* Edit View */
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary-500" />
                Edit Booking
              </h3>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/DD/YYYY"
                    value={editedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <TimePickerDropdown
                    value={editedTime}
                    onChange={setEditedTime}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editedLocation}
                  onChange={(e) => setEditedLocation(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter location..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>

              {/* Consumer Notes - Read-only display */}
              {booking.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                  <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 italic">
                    "{booking.notes}"
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
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
            /* View Mode */
            <div className="space-y-5">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                  {booking.consumer?.profileImageUrl ? (
                    <img 
                      src={booking.consumer.profileImageUrl} 
                      alt="Customer" 
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-primary-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {booking.consumer?.firstName} {booking.consumer?.lastName}
                  </h3>
                  {booking.consumer?.email && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {booking.consumer.email}
                    </p>
                  )}
                  {booking.consumer?.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {booking.consumer.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Service Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Service</h4>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                  <span className="font-semibold text-gray-900">
                    {booking.serviceName || booking.serviceType}
                  </span>
                  <span className="font-bold text-green-600 text-lg">
                    {formatPrice(booking.priceUsdCents)}
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
                      <p className="font-semibold text-gray-900">{formattedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 text-primary-500" />
                    <div>
                      <p className="text-xs text-gray-500">Time</p>
                      <p className="font-semibold text-gray-900">{formattedTime}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              {booking.location && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Where</h4>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    <p className="font-medium text-gray-900">{booking.location}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {booking.notes && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Notes</h4>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700 italic">"{booking.notes}"</p>
                  </div>
                </div>
              )}

              {/* Review (for completed bookings) */}
              {booking.status === 'COMPLETED' && booking.reviewRating && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Review</h4>
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${star <= booking.reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="ml-2 font-semibold text-gray-700">
                        {booking.reviewRating.toFixed(1)}
                      </span>
                    </div>
                    {booking.reviewComment && (
                      <p className="text-gray-700 italic">"{booking.reviewComment}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Info (for completed bookings) */}
              {booking.status === 'COMPLETED' && booking.paidAt && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Payment</h4>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-gray-700">Total Paid</span>
                      </div>
                      <span className="font-bold text-green-600 text-lg">
                        {formatPrice(booking.totalPaidCents || booking.priceUsdCents)}
                      </span>
                    </div>
                    {booking.tipAmountCents > 0 && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-200">
                        <span className="text-sm text-gray-600">Includes tip</span>
                        <span className="font-semibold text-green-600">
                          +{formatPrice(booking.tipAmountCents)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Booking Reference */}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-400">Booking Reference</p>
                <p className="font-mono text-sm text-gray-600 font-medium">
                  {booking.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Action Buttons */}
              {(canComplete || canEdit || canCancel) && (
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  {/* Complete Booking Button - Navigates to Payment Page */}
                  {canComplete && (
                    <button
                      onClick={handleCompleteBooking}
                      className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      Complete Booking
                    </button>
                  )}
                  
                  {/* Edit & Cancel Buttons */}
                  {(canEdit || canCancel) && (
                    <div className="flex gap-3">
                      {canEdit && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit Booking
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => setIsDeleting(true)}
                          className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 border border-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

