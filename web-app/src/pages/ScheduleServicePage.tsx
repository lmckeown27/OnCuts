import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Scissors, DollarSign, Instagram } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import TimePickerDropdown from '../components/TimePickerDropdown';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import barberService from '../services/barber.service';
import type { Barber } from '../types';
import type { FilterCriteria } from '../types/barber-filters';
import { CampusCutLogo } from '@assets';
import { SPECIALTY_OPTIONS } from '../config/services';

export default function ScheduleServicePage() {
  const navigate = useNavigate();
  const { barberId } = useParams<{ barberId: string }>();
  const location = useLocation();
  
  // Get passed data from state
  const passedBarber = location.state?.barber as Barber | undefined;
  const passedFilters = location.state?.filters as FilterCriteria | undefined;
  const preservedFormData = location.state?.preservedFormData;

  const [barber, setBarber] = useState<Barber | null>(passedBarber || null);
  const [isLoading, setIsLoading] = useState(!passedBarber);

  // Fetch barber by ID if not passed in state (e.g., when navigating back)
  useEffect(() => {
    const fetchBarber = async () => {
      if (!passedBarber && barberId) {
        try {
          const barberData = await barberService.getBarberById(barberId);
          if (barberData) {
            setBarber(barberData);
          }
        } catch (error) {
          console.error('Failed to fetch barber:', error);
        }
        setIsLoading(false);
      }
    };
    fetchBarber();
  }, [barberId, passedBarber]);
  const [serviceType, setServiceType] = useState<string>(
    preservedFormData?.serviceType || passedFilters?.serviceType || ''
  );
  const [date, setDate] = useState<string>(
    preservedFormData?.date || passedFilters?.date || ''
  );
  const [time, setTime] = useState<string>(
    preservedFormData?.time || passedFilters?.time || ''
  );
  const [location_, setLocation] = useState<string>(
    preservedFormData?.location || passedFilters?.location || ''
  );
  const [locationDetails, setLocationDetails] = useState<string>(
    preservedFormData?.locationDetails || passedFilters?.locationDetails || ''
  );
  const [notes, setNotes] = useState<string>(preservedFormData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available services based on barber's specialties (fallback to shared config)
  const availableServices = (Array.isArray(barber?.specialties) && barber.specialties.length > 0)
    ? barber.specialties 
    : SPECIALTY_OPTIONS;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!serviceType) {
      toast.error('Please select a service type');
      return;
    }
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    if (!time) {
      toast.error('Please select a time');
      return;
    }
    if (!location_) {
      toast.error('Please select a location');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get service price from barber's pricing
      const servicePrice = barber?.pricing?.find(
        p => p.name?.toLowerCase() === serviceType.toLowerCase()
      )?.price || 30;

      // Combine date and time for scheduled datetime
      const scheduledAt = new Date(`${date}T${time}`).toISOString();

      // Build barber name from available properties
      const barberName = barber?.name 
        || barber?.display_name 
        || (barber?.user?.first_name ? `${barber.user.first_name} ${barber.user.last_name || ''}`.trim() : null)
        || (barber?.first_name ? `${barber.first_name} ${barber.last_name || ''}`.trim() : null)
        || 'Barber';

      // Navigate to payment page with booking details
      navigate('/web/student/booking/payment', {
        state: {
          barberId: barberId,
          barberUserId: barber?.user_id, // User ID for messaging
          barberName: barberName,
          barberProfilePicture: barber?.profile_picture_url || barber?.profile_photo_url,
          serviceName: serviceType,
          servicePrice: servicePrice,
          scheduledAt: scheduledAt,
          duration: 30, // Default 30 minutes
          location: location_,
          locationDetails: locationDetails,
          notes: notes,
        }
      });
    } catch (error) {
      console.error('Failed to create booking:', error);
      toast.error('Failed to create booking. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading barber info...</p>
        </div>
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Barber not found</p>
          <Button onClick={() => navigate('/web/consumer')}>
            Back to Discovery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/web/consumer', {
                state: {
                  preservedFormData: {
                    barberId,
                    serviceType,
                    date,
                    time,
                    location: location_,
                    locationDetails,
                    notes
                  }
                }
              })}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src={CampusCutLogo} alt="CampusCut" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Schedule Service</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Barber Info Sidebar */}
          <div className="md:col-span-1">
            <Card className="sticky top-4">
              <div className="p-6">
                <div className="w-48 h-64 mx-auto rounded-lg overflow-hidden bg-gray-200 mb-4">
                  {barber.profile_picture_url || barber.profile_photo_url ? (
                    <img
                      src={barber.profile_picture_url || barber.profile_photo_url}
                      alt="Barber"
                      className="w-full h-full object-cover"
                    />
                  ) : barber.portfolio && barber.portfolio.length > 0 ? (
                    <img
                      src={barber.portfolio[0].url}
                      alt="Barber"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Scissors className="w-24 h-24 text-gray-400" />
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {barber.user?.first_name} {barber.user?.last_name}
                </h2>


                {barber.instagram_handle && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Instagram className="w-4 h-4" />
                    <a
                      href={`https://instagram.com/${barber.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600 transition-colors"
                    >
                      @{barber.instagram_handle}
                    </a>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-4">{barber.bio}</p>

                <div className="flex flex-wrap gap-2">
                  {barber.specialties?.map((specialty, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-primary-100 text-primary-600 text-xs rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="md:col-span-2">
            <Card>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Service Details</h3>

                  {/* Service Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4" />
                        Service Type *
                      </div>
                    </label>
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a service</option>
                      {availableServices.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div className="mb-6">
                    <DatePicker
                      label="Date"
                      value={date}
                      onChange={(newDate) => {
                        setDate(newDate);
                        // Reset time when date changes
                        setTime('');
                      }}
                      minDate={today}
                      required
                      weeklySchedule={barber.weekly_schedule}
                    />
                  </div>

                  {/* Time */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time *
                      </div>
                    </label>
                    <TimePickerDropdown
                      value={time}
                      onChange={(value) => setTime(value)}
                      minTime={(() => {
                        if (!date || !barber.weekly_schedule) return undefined;
                        const selectedDate = new Date(date + 'T00:00:00');
                        const dayOfWeek = selectedDate.getDay();
                        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
                        const daySchedule = barber.weekly_schedule[dayKeys[dayOfWeek]];
                        return daySchedule?.enabled ? daySchedule.start : undefined;
                      })()}
                      maxTime={(() => {
                        if (!date || !barber.weekly_schedule) return undefined;
                        const selectedDate = new Date(date + 'T00:00:00');
                        const dayOfWeek = selectedDate.getDay();
                        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
                        const daySchedule = barber.weekly_schedule[dayKeys[dayOfWeek]];
                        return daySchedule?.enabled ? daySchedule.end : undefined;
                      })()}
                    />
                  </div>

                  {/* Location */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Location *
                      </div>
                    </label>
                    <input
                      type="text"
                      value={locationDetails}
                      onChange={(e) => {
                        setLocationDetails(e.target.value);
                        setLocation(e.target.value);
                      }}
                      placeholder="Enter service location (e.g., My Dorm, Student Union, etc.)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Where would you like the service to take place?
                    </p>
                  </div>

                  {/* Additional Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      placeholder="Any special requests or details for the barber..."
                    />
                  </div>
                </div>

                {/* Pricing Info */}
                {barber.pricing && barber.pricing.length > 0 && (
                  <div className="flex items-center gap-2 text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-bold text-lg">
                      {Math.min(...barber.pricing.map(p => p.price))}
                    </span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/web/consumer')}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Processing...' : 'Continue to Payment'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  The barber will review your request and confirm availability
                </p>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

