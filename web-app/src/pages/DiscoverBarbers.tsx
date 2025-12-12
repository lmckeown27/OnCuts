/**
 * Discover Barbers Page
 * 
 * Dating app-style interface for browsing barbers
 * Swipe through barber profiles and schedule bookings
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Star, Award, Clock, MessageSquare, Calendar } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Barber {
  barberId: string;
  name: string;
  bio?: string;
  profileImageUrl?: string;
  avgRating: number;
  totalReviews: number;
  totalBookings: number;
  verified: boolean;
  specialties: string[];
  priceRange: string;
  location: string;
  availability: string;
  responseTime: string;
}

interface Props {
  customerId: string;
  customerName: string;
}

export default function DiscoverBarbers({ customerId, customerName }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    try {
      // For now, using mock data - replace with actual API call
      const mockBarbers: Barber[] = [
        {
          barberId: 'barber-1',
          name: 'Marcus Johnson',
          bio: 'Specializing in fades and modern cuts. 10+ years experience. Your hair, your style, perfected.',
          profileImageUrl: null,
          avgRating: 4.9,
          totalReviews: 127,
          totalBookings: 450,
          verified: true,
          specialties: ['Fades', 'Tapers', 'Beard Trim'],
          priceRange: '$25-$40',
          location: 'Cal Poly SLO',
          availability: 'Available this week',
          responseTime: 'Usually responds in 2 hours',
        },
        {
          barberId: 'barber-2',
          name: 'Alex Rivera',
          bio: 'Creative cuts and classic styles. I listen to what you want and deliver excellence every time.',
          profileImageUrl: null,
          avgRating: 4.8,
          totalReviews: 95,
          totalBookings: 320,
          verified: true,
          specialties: ['Creative Cuts', 'Color', 'Styling'],
          priceRange: '$30-$50',
          location: 'Cal Poly SLO',
          availability: 'Available today',
          responseTime: 'Usually responds in 1 hour',
        },
        {
          barberId: 'barber-3',
          name: 'Jordan Lee',
          bio: 'Traditional barber with a modern twist. Clean cuts, great conversations, and affordable prices.',
          profileImageUrl: null,
          avgRating: 4.7,
          totalReviews: 78,
          totalBookings: 250,
          verified: false,
          specialties: ['Classic Cuts', 'Hot Towel Shave', 'Lineup'],
          priceRange: '$20-$35',
          location: 'Cal Poly SLO',
          availability: 'Available tomorrow',
          responseTime: 'Usually responds in 3 hours',
        },
      ];

      setBarbers(mockBarbers);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch barbers:', error);
      toast.error('Failed to load barbers');
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < barbers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleViewProfile = (barber: Barber) => {
    setSelectedBarber(barber);
  };

  const handleSchedule = () => {
    if (selectedBarber) {
      setShowBookingModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Finding great barbers...</p>
        </div>
      </div>
    );
  }

  if (barbers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="text-center max-w-md">
          <p className="text-gray-600">No barbers available in your area</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
        </Card>
      </div>
    );
  }

  const currentBarber = barbers[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {!selectedBarber ? (
        /* Browsing Mode */
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Discover Barbers</h1>
            <p className="text-gray-600">Find your perfect barber</p>
          </div>

          {/* Barber Card */}
          <div className="relative">
            <Card className="overflow-hidden shadow-2xl">
              {/* Profile Image Placeholder */}
              <div className="h-80 bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center relative">
                <div className="text-white text-8xl font-bold">
                  {currentBarber.name.charAt(0)}
                </div>
                {currentBarber.verified && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-semibold">
                    <Award className="w-4 h-4" />
                    Verified
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{currentBarber.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{currentBarber.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-500 fill-current" />
                      <span className="font-bold text-gray-900">{currentBarber.avgRating}</span>
                    </div>
                    <p className="text-xs text-gray-500">{currentBarber.totalReviews} reviews</p>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-gray-700 mb-4 leading-relaxed">{currentBarber.bio}</p>

                {/* Specialties */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {currentBarber.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Price Range</p>
                    <p className="font-semibold text-gray-900">{currentBarber.priceRange}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Cuts</p>
                    <p className="font-semibold text-gray-900">{currentBarber.totalBookings}</p>
                  </div>
                </div>

                {/* Availability */}
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">{currentBarber.availability}</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{currentBarber.responseTime}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleViewProfile(currentBarber)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    View Full Profile
                  </Button>
                  <Button
                    onClick={handleSchedule}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                </div>
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="secondary"
                size="lg"
                className="w-24"
              >
                ← Previous
              </Button>

              <span className="text-gray-600 font-medium">
                {currentIndex + 1} / {barbers.length}
              </span>

              <Button
                onClick={handleNext}
                disabled={currentIndex === barbers.length - 1}
                variant="secondary"
                size="lg"
                className="w-24"
              >
                Next →
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Profile View Mode */
        <BarberProfileView
          barber={selectedBarber}
          customerId={customerId}
          customerName={customerName}
          onBack={() => setSelectedBarber(null)}
          onSchedule={() => setShowBookingModal(true)}
        />
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedBarber && (
        <BookingScheduleModal
          barber={selectedBarber}
          customerId={customerId}
          customerName={customerName}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => {
            setShowBookingModal(false);
            toast.success('Booking request sent!');
          }}
        />
      )}
    </div>
  );
}

/**
 * Barber Profile View Component
 */
interface ProfileViewProps {
  barber: Barber;
  customerId: string;
  customerName: string;
  onBack: () => void;
  onSchedule: () => void;
}

function BarberProfileView({ barber, customerId, customerName, onBack, onSchedule }: ProfileViewProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Button onClick={onBack} variant="secondary" size="sm" className="mb-4">
        ← Back to Browse
      </Button>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="h-60 bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center relative">
          <div className="text-white text-9xl font-bold">
            {barber.name.charAt(0)}
          </div>
          {barber.verified && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2 font-semibold">
              <Award className="w-5 h-5" />
              Verified Barber
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{barber.name}</h1>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5" />
                <span className="text-lg">{barber.location}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-6 h-6 text-yellow-500 fill-current" />
                <span className="text-2xl font-bold text-gray-900">{barber.avgRating}</span>
              </div>
              <p className="text-sm text-gray-500">{barber.totalReviews} reviews</p>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">About</h3>
            <p className="text-gray-700 leading-relaxed">{barber.bio}</p>
          </div>

          {/* Specialties */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Specialties</h3>
            <div className="flex flex-wrap gap-2">
              {barber.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{barber.totalBookings}</p>
              <p className="text-sm text-gray-600">Total Cuts</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{barber.totalReviews}</p>
              <p className="text-sm text-gray-600">Reviews</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{barber.avgRating}</p>
              <p className="text-sm text-gray-600">Rating</p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Availability</p>
                <p className="text-sm text-gray-600">{barber.availability}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-medium text-gray-900">Response Time</p>
                <p className="text-sm text-gray-600">{barber.responseTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="font-medium text-gray-900">Price Range</p>
                <p className="text-sm text-gray-600">{barber.priceRange}</p>
              </div>
            </div>
          </div>

          {/* Schedule Button */}
          <Button
            onClick={onSchedule}
            className="w-full bg-green-600 hover:bg-green-700 text-lg py-4"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Schedule a Cut with {barber.name}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Booking Schedule Modal Component
 */
interface BookingModalProps {
  barber: Barber;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function BookingScheduleModal({ barber, customerId, customerName, onClose, onSuccess }: BookingModalProps) {
  const [formData, setFormData] = useState({
    serviceType: 'haircut',
    date: '',
    time: '',
    location: 'on-campus',
    locationDetails: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('http://localhost:3001/api/booking-requests', {
        customerId,
        barberId: barber.barberId,
        serviceType: formData.serviceType,
        requestedDate: formData.date,
        requestedTime: formData.time,
        price: 30.00, // This should be calculated based on service
        message: formData.message || `Location: ${formData.location}${formData.locationDetails ? ` - ${formData.locationDetails}` : ''}`,
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to send booking request:', error);
      toast.error('Failed to send booking request');
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Schedule with {barber.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <select
              value={formData.serviceType}
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="haircut">Haircut</option>
              <option value="fade">Fade</option>
              <option value="beard-trim">Beard Trim</option>
              <option value="full-service">Full Service (Cut + Beard)</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              min={getMinDate()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Time
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Where should the cut take place?
            </label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
              required
            >
              <option value="on-campus">On Campus</option>
              <option value="dorm">My Dorm/Apartment</option>
              <option value="barber-location">Barber's Location</option>
            </select>
            <input
              type="text"
              value={formData.locationDetails}
              onChange={(e) => setFormData({ ...formData, locationDetails: e.target.value })}
              placeholder="Specific location details (e.g., Building name, Room number)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Barber (Optional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell the barber what style you're looking for, or any special requests..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={4}
            />
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>How it works:</strong> Your booking request will be sent to {barber.name}. 
              They'll review your profile and request, then accept or provide alternative times. 
              You'll receive a notification when they respond!
            </p>
          </div>

          {/* Price Estimate */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Estimated Price:</span>
              <span className="text-2xl font-bold text-green-600">{barber.priceRange}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final price confirmed by barber upon acceptance</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

