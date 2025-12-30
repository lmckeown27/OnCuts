/**
 * Mobile Consumer Page
 * 
 * Touch-optimized mobile interface for discovering and booking barbers.
 * Features:
 * - Swipeable barber cards (Tinder-style)
 * - Bottom sheet for booking
 * - Touch-friendly filters
 * - Bottom navigation
 * - Pull-to-refresh
 * - Location-based barber discovery
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  X,
  MapPin,
  Calendar,
  Instagram,
  ChevronUp,
  Filter,
  Search,
  Home,
  MessageCircle,
  User as UserIcon,
  Clock,
  DollarSign,
  Loader2
} from 'lucide-react';
import { useGeolocation, calculateDistance, kmToMiles } from '../../hooks';
import LocationPermissionPrompt from '../../components/LocationPermissionPrompt';
import barberService from '../../services/barber.service';
import type { Barber } from '../../types';

export default function MobileConsumerPage() {
  const navigate = useNavigate();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBarberIndex, setCurrentBarberIndex] = useState(0);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'bookings' | 'profile'>('home');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Geolocation hook for location-based barber discovery
  const { 
    latitude, 
    longitude, 
    loading: locationLoading, 
    permissionStatus, 
    requestLocation 
  } = useGeolocation();

  const currentBarber = barbers[currentBarberIndex];
  const minSwipeDistance = 50;

  // Load barbers when location changes
  useEffect(() => {
    loadBarbers();
  }, [latitude, longitude]);

  // Show location prompt if permission not yet requested
  useEffect(() => {
    if (permissionStatus === 'prompt') {
      const timer = setTimeout(() => {
        setShowLocationPrompt(true);
      }, 1000); // Slightly faster for mobile
      return () => clearTimeout(timer);
    }
  }, [permissionStatus]);

  // Load barbers from API
  const loadBarbers = async () => {
    try {
      setIsLoading(true);
      const response = await barberService.getBarbers({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
      });
      
      // Handle paginated response
      const barberList = Array.isArray(response) ? response : response.data;
      
      // Sort by distance if we have user location
      if (latitude && longitude && barberList.length > 0) {
        barberList.sort((a: Barber, b: Barber) => {
          const distA = a.service_latitude && a.service_longitude
            ? calculateDistance(latitude, longitude, a.service_latitude, a.service_longitude)
            : Infinity;
          const distB = b.service_latitude && b.service_longitude
            ? calculateDistance(latitude, longitude, b.service_latitude, b.service_longitude)
            : Infinity;
          return distA - distB;
        });
      }
      
      setBarbers(barberList);
    } catch (error) {
      console.error('Failed to load barbers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle location permission request
  const handleAllowLocation = () => {
    requestLocation();
    setShowLocationPrompt(false);
  };

  // Handle location denial - go to landing page
  const handleDenyLocation = () => {
    setShowLocationPrompt(false);
    navigate('/');
  };

  // Get distance string for a barber
  const getDistanceString = (barber: Barber): string => {
    if (latitude && longitude && barber.service_latitude && barber.service_longitude) {
      const distKm = calculateDistance(latitude, longitude, barber.service_latitude, barber.service_longitude);
      const distMiles = kmToMiles(distKm);
      return distMiles < 0.1 ? 'Nearby' : `${distMiles.toFixed(1)} mi`;
    }
    return 'Distance unknown';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handlePass();
    }
    if (isRightSwipe) {
      handleLike();
    }
  };

  const handleLike = () => {
    setSwipeDirection('right');
    setTimeout(() => {
      setShowBookingSheet(true);
      setSwipeDirection(null);
    }, 300);
  };

  const handlePass = () => {
    setSwipeDirection('left');
    setTimeout(() => {
      if (currentBarberIndex < barbers.length - 1) {
        setCurrentBarberIndex(currentBarberIndex + 1);
      } else {
        setCurrentBarberIndex(0); // Loop back
      }
      setSwipeDirection(null);
    }, 300);
  };

  // Show loading state
  if (isLoading || locationLoading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-600">Finding barbers near you...</p>
        
        {/* Location Permission Prompt */}
        <LocationPermissionPrompt
          isOpen={showLocationPrompt}
          onClose={() => setShowLocationPrompt(false)}
          onAllow={handleAllowLocation}
          onDeny={handleDenyLocation}
          loading={locationLoading}
        />
      </div>
    );
  }

  if (!currentBarber) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center p-6">
        <MapPin className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Barbers Found</h2>
        <p className="text-gray-600 text-center mb-6">
          We couldn't find any barbers in your area. Try adjusting your location or check back later.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold"
        >
          Back to Home
        </button>
        
        {/* Location Permission Prompt */}
        <LocationPermissionPrompt
          isOpen={showLocationPrompt}
          onClose={() => setShowLocationPrompt(false)}
          onAllow={handleAllowLocation}
          onDeny={handleDenyLocation}
          loading={locationLoading}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Location Permission Prompt */}
      <LocationPermissionPrompt
        isOpen={showLocationPrompt}
        onClose={() => setShowLocationPrompt(false)}
        onAllow={handleAllowLocation}
        onDeny={handleDenyLocation}
        loading={locationLoading}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <div className="flex items-center gap-2">
          <img src="/src/assets/logos/Logo1.png" alt="CampusCut" className="h-8" />
          <h1 className="text-lg font-bold text-gray-900">Discover</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Filter className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Swipeable Card Area */}
      <div className="flex-1 relative overflow-hidden p-4">
        <div
          className={`relative w-full h-full transition-transform duration-300 ${
            swipeDirection === 'left' ? '-translate-x-full opacity-0' :
            swipeDirection === 'right' ? 'translate-x-full opacity-0' : ''
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Barber Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden h-full flex flex-col">
            {/* Profile Image */}
            <div className="relative h-2/3 bg-gradient-to-br from-primary-100 to-primary-200">
              {(currentBarber.profile_photo_url || currentBarber.profile_picture_url) ? (
                <img
                  src={currentBarber.profile_photo_url || currentBarber.profile_picture_url}
                  alt={currentBarber.user?.first_name || 'Barber'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-32 h-32 bg-primary-200 rounded-full flex items-center justify-center">
                    <span className="text-5xl font-bold text-primary-600">
                      {(currentBarber.user?.first_name || 'B')[0].toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Price Badge */}
              {currentBarber.pricing && currentBarber.pricing.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-primary-400 text-white px-4 py-2 rounded-full font-bold shadow-lg">
                  From ${Math.min(...currentBarber.pricing.map(p => p.price))}
                </div>
              )}

              {/* Instagram Badge */}
              {currentBarber.instagram_handle && (
                <a
                  href={`https://instagram.com/${currentBarber.instagram_handle.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg"
                >
                  <Instagram className="w-5 h-5 text-pink-600" />
                </a>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {currentBarber.user?.first_name || 'Barber'} {currentBarber.user?.last_name?.[0] || ''}.
                  </h2>
                  {currentBarber.years_experience && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">{currentBarber.years_experience} years experience</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{getDistanceString(currentBarber)}</span>
                </div>
                
                {currentBarber.bio && (
                  <p className="text-sm text-gray-600 line-clamp-2">{currentBarber.bio}</p>
                )}
              </div>

              {/* Specialties */}
              {currentBarber.specialties && currentBarber.specialties.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentBarber.specialties.slice(0, 4).map((specialty) => (
                      <span
                        key={specialty}
                        className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 bg-white border-t border-gray-200">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handlePass}
            className="w-16 h-16 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg"
          >
            <X className="w-8 h-8 text-red-500" />
          </button>
          
          <button
            onClick={handleLike}
            className="w-20 h-20 bg-primary-400 hover:bg-primary-500 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl"
          >
            <Heart className="w-10 h-10 text-white" />
          </button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          Swipe left to pass, right to book
        </p>
      </div>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 px-2 py-2 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'home' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'messages' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Messages</span>
          </button>
          
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'bookings' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs font-medium">Bookings</span>
          </button>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'profile' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <UserIcon className="w-6 h-6" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>

      {/* Booking Bottom Sheet */}
      {showBookingSheet && currentBarber && (
        <div
          className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
          onClick={() => setShowBookingSheet(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center gap-4 mb-6">
              {(currentBarber.profile_photo_url || currentBarber.profile_picture_url) ? (
                <img
                  src={currentBarber.profile_photo_url || currentBarber.profile_picture_url}
                  alt={currentBarber.user?.first_name || 'Barber'}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-600">
                    {(currentBarber.user?.first_name || 'B')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {currentBarber.user?.first_name || 'Barber'} {currentBarber.user?.last_name?.[0] || ''}.
                </h3>
                <p className="text-gray-500">{getDistanceString(currentBarber)}</p>
              </div>
            </div>

            <button
              onClick={() => {
                // Navigate to booking page
                setShowBookingSheet(false);
                navigate(`/app/consumer/book/${currentBarber.id}`);
              }}
              className="w-full bg-primary-400 hover:bg-primary-500 text-white font-semibold py-4 rounded-xl transition-colors active:scale-98 shadow-lg"
            >
              Book Appointment
            </button>
            
            <button
              onClick={() => setShowBookingSheet(false)}
              className="w-full text-gray-600 font-medium py-3 mt-2"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* Filters Bottom Sheet */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter options would go here */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Service Type</label>
                <div className="flex flex-wrap gap-2">
                  {['Haircut', 'Fade', 'Beard Trim', 'Full Service', 'Color'].map((service) => (
                    <button
                      key={service}
                      className="px-4 py-2 border-2 border-primary-400 text-primary-600 rounded-lg font-medium hover:bg-primary-50 active:scale-95 transition-all"
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full bg-primary-400 hover:bg-primary-500 text-white font-semibold py-4 rounded-xl transition-colors active:scale-98 shadow-lg mt-6"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

