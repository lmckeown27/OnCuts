import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Scissors, DollarSign, Instagram } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import toast from 'react-hot-toast';
import type { Barber } from '../types';
import type { FilterCriteria } from '../types/barber-filters';
import { CampusCutLogo } from '@assets';

// Mock barber data for fallback lookup (matches ConsumerPage)
function getMockBarbers(): Barber[] {
  return [
    {
      id: 'barber-1',
      user_id: 'user-1',
      campus_id: 'campus-1',
      bio: 'Specializing in modern fades and classic cuts. 5+ years experience.',
      specialties: ['Haircut', 'Fade', 'Beard Trim'],
      years_experience: 5,
      average_rating: 4.8,
      total_bookings: 156,
      instagram_handle: 'cutsbymark',
      portfolio: [{ id: 'p1', barber_id: 'barber-1', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+1' }],
      is_active: true,
      base_price: 25,
      max_price: 35,
      name: 'Mark Johnson',
      user: { id: 'user-1', email: 'mark@example.com', first_name: 'Mark', last_name: 'Johnson', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Haircut', price: 25, duration_minutes: 30 }],
    },
    {
      id: 'barber-2',
      user_id: 'user-2',
      campus_id: 'campus-1',
      bio: 'Expert in hot towel shaves and beard grooming.',
      specialties: ['Beard Trim', 'Hot Towel Shave', 'Full Service'],
      years_experience: 7,
      average_rating: 4.9,
      total_bookings: 203,
      instagram_handle: 'shavemaster',
      portfolio: [{ id: 'p2', barber_id: 'barber-2', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+2' }],
      is_active: true,
      base_price: 30,
      max_price: 45,
      name: 'David Chen',
      user: { id: 'user-2', email: 'david@example.com', first_name: 'David', last_name: 'Chen', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Beard Trim', price: 30, duration_minutes: 20 }],
    },
    {
      id: 'barber-3',
      user_id: 'user-3',
      campus_id: 'campus-1',
      bio: 'Creative stylist with expertise in color and modern cuts.',
      specialties: ['Haircut', 'Color', 'Styling'],
      years_experience: 4,
      average_rating: 4.7,
      total_bookings: 98,
      instagram_handle: 'stylebyalex',
      portfolio: [{ id: 'p3', barber_id: 'barber-3', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+3' }],
      is_active: true,
      base_price: 28,
      max_price: 40,
      name: 'Alex Rodriguez',
      user: { id: 'user-3', email: 'alex@example.com', first_name: 'Alex', last_name: 'Rodriguez', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Haircut', price: 28, duration_minutes: 30 }],
    },
    {
      id: 'barber-4',
      user_id: 'user-4',
      campus_id: 'campus-1',
      bio: 'Traditional barbering with a modern twist. Precision cuts guaranteed.',
      specialties: ['Haircut', 'Fade', 'Lineup'],
      years_experience: 6,
      average_rating: 4.6,
      total_bookings: 134,
      instagram_handle: 'precision_cuts',
      portfolio: [{ id: 'p4', barber_id: 'barber-4', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+4' }],
      is_active: true,
      base_price: 26,
      max_price: 36,
      name: 'Jordan Smith',
      user: { id: 'user-4', email: 'jordan@example.com', first_name: 'Jordan', last_name: 'Smith', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Haircut', price: 26, duration_minutes: 30 }],
    },
    {
      id: 'barber-5',
      user_id: 'user-5',
      campus_id: 'campus-1',
      bio: 'Specializing in textured hair and ethnic styles.',
      specialties: ['Haircut', 'Styling', 'Fade'],
      years_experience: 3,
      average_rating: 4.9,
      total_bookings: 76,
      instagram_handle: 'texturekingz',
      portfolio: [{ id: 'p5', barber_id: 'barber-5', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+5' }],
      is_active: true,
      base_price: 27,
      max_price: 38,
      name: 'Marcus Williams',
      user: { id: 'user-5', email: 'marcus@example.com', first_name: 'Marcus', last_name: 'Williams', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Haircut', price: 27, duration_minutes: 30 }],
    },
    {
      id: 'barber-6',
      user_id: 'user-6',
      campus_id: 'campus-1',
      bio: 'Full service barbering with a focus on customer experience.',
      specialties: ['Full Service', 'Haircut', 'Beard Trim', 'Hot Towel Shave'],
      years_experience: 8,
      average_rating: 4.8,
      total_bookings: 187,
      instagram_handle: 'fullservice_barber',
      portfolio: [{ id: 'p6', barber_id: 'barber-6', url: 'https://placehold.co/400x400/708d81/white?text=Portfolio+6' }],
      is_active: true,
      base_price: 32,
      max_price: 48,
      name: 'Tyler Anderson',
      user: { id: 'user-6', email: 'tyler@example.com', first_name: 'Tyler', last_name: 'Anderson', user_type: 'barber' as const, is_verified: true, created_at: new Date().toISOString() },
      pricing: [{ name: 'Full Service', price: 32, duration_minutes: 45 }],
    },
  ];
}

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
    if (!passedBarber && barberId) {
      // Try to find barber in mock data
      const mockBarbers = getMockBarbers();
      const foundBarber = mockBarbers.find(b => b.id === barberId);
      if (foundBarber) {
        setBarber(foundBarber);
      }
      setIsLoading(false);
    }
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

  // Available services based on barber's specialties (fallback to full list)
  const availableServices = barber?.specialties || [
    'Buzz Cut',
    'Line Up',
    'Beard Trim',
    'Haircut',
    'Taper',
    'Hot Shave',
    'Fade',
    'Haircut & Fade',
    'Design/Art',
    "Women's Cut",
    'Perm',
    'Color Treatment',
  ];

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

      // Navigate to payment page with booking details
      navigate('/web/student/booking/payment', {
        state: {
          barberId: barberId,
          barberName: barber?.user?.first_name 
            ? `${barber.user.first_name} ${barber.user.last_name}` 
            : 'Barber',
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
                  {barber.portfolio && barber.portfolio.length > 0 ? (
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date *
                      </div>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={today}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
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
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
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

