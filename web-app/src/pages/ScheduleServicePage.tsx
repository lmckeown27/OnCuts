import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Scissors, DollarSign, Star, Instagram } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import toast from 'react-hot-toast';
import type { Barber } from '../types';
import type { FilterCriteria } from '../types/barber-filters';
import { CampusCutsLogo } from '@assets';

export default function ScheduleServicePage() {
  const navigate = useNavigate();
  const { barberId } = useParams<{ barberId: string }>();
  const location = useLocation();
  
  // Get passed data from state
  const passedBarber = location.state?.barber as Barber | undefined;
  const passedFilters = location.state?.filters as FilterCriteria | undefined;

  const [barber, setBarber] = useState<Barber | null>(passedBarber || null);
  const [serviceType, setServiceType] = useState<string>(passedFilters?.serviceType || '');
  const [date, setDate] = useState<string>(passedFilters?.date || '');
  const [time, setTime] = useState<string>(passedFilters?.time || '');
  const [location_, setLocation] = useState<string>(passedFilters?.location || '');
  const [locationDetails, setLocationDetails] = useState<string>(passedFilters?.locationDetails || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available services based on barber's specialties
  const availableServices = barber?.specialties || [
    'Haircut',
    'Fade',
    'Beard Trim',
    'Full Service',
    'Hot Towel Shave',
    'Color',
    'Styling',
    'Lineup',
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
      // TODO: Implement actual booking API call
      // await bookingService.createBooking({
      //   barberId,
      //   serviceType,
      //   date,
      //   time,
      //   location: location_,
      //   locationDetails,
      //   notes,
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Booking request sent! The barber will review your request.');
      navigate('/web/consumer');
    } catch (error) {
      console.error('Failed to create booking:', error);
      toast.error('Failed to create booking. Please try again.');
      setIsSubmitting(false);
    }
  };

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
              onClick={() => navigate('/web/consumer')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
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
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-200 mb-4">
                  {barber.portfolio && barber.portfolio.length > 0 ? (
                    <img
                      src={barber.portfolio[0].url}
                      alt="Barber"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Scissors className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {barber.user?.first_name} {barber.user?.last_name}
                </h2>

                <div className="flex items-center gap-1 mb-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{barber.average_rating.toFixed(1)}</span>
                </div>

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
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-primary-700">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-semibold">
                        Starting at ${Math.min(...barber.pricing.map(p => p.price))}
                      </span>
                    </div>
                    <p className="text-sm text-primary-600 mt-1">
                      Final price may vary based on service complexity
                    </p>
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
                    {isSubmitting ? 'Sending Request...' : 'Send Booking Request'}
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

