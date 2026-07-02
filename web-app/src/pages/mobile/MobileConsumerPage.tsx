/**
 * Mobile Consumer Page
 * 
 * Touch-optimized mobile interface for discovering and booking barbers.
 * Features:
 * - University-based barber discovery
 * - Swipeable barber cards (Tinder-style)
 * - Bottom sheet for booking
 * - Touch-friendly filters
 * - Bottom navigation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useMessageStore } from '../../store/useMessageStore';
import toast from 'react-hot-toast';
import MobilePhotoUpload from '../../components/MobilePhotoUpload';
import ConsumerProfileEditor from '../../components/ConsumerProfileEditor';
import BlockedProvidersModal from '../../components/BlockedProvidersModal';
import userService from '../../services/user.service';
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
  Loader2,
  GraduationCap,
  ArrowLeft,
  LogOut,
  UserX
} from 'lucide-react';
import {
  getBrowseMaxDistanceMiles,
  getBrowseConstrainByDistance,
  milesToKmForBrowse,
  formatBarberDistanceFromUser,
  getBarberDistanceMilesFromTown,
} from '../../utils/consumerBrowseDistancePreference';
import {
  getBrowseProviderCategory,
  setBrowseProviderCategory,
} from '../../utils/consumerBrowseCategoryPreference';
import {
  BROWSE_PROVIDER_CATEGORIES,
  browseCategoryApiParam,
  type BrowseProviderCategory,
} from '../../config/providerCategories';
import providerService from '../../services/provider.service';
import type { Barber } from '../../types';
import type { CollegeTown } from '../../types';
import {
  resolveInitialCollegeTown,
} from '../../utils/collegeTowns';

export default function MobileConsumerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const { user, setUser, logout, isLoading: isAuthLoading } = useAuthStore();
  const { unreadCount: unreadMessages, loadUnreadCount } = useMessageStore();
  
  // ALL useState hooks must be declared before any early returns (React Rules of Hooks)
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollegeTown, setSelectedCollegeTown] = useState<CollegeTown | null>(null);
  const [currentBarberIndex, setCurrentBarberIndex] = useState(0);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [browseProviderCategory, setBrowseProviderCategoryState] = useState<BrowseProviderCategory>(
    getBrowseProviderCategory,
  );
  const [pendingBrowseCategory, setPendingBrowseCategory] = useState<BrowseProviderCategory>(
    getBrowseProviderCategory,
  );
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'bookings' | 'profile'>('home');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showFullEditor, setShowFullEditor] = useState(false);
  const [showBlockedProvidersModal, setShowBlockedProvidersModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [townHydrated, setTownHydrated] = useState(false);

  const currentBarber = barbers[currentBarberIndex];
  const minSwipeDistance = 50;

  // Optional college town; without one, load all providers
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const savedTown = await resolveInitialCollegeTown({ campusId: user?.campus_id });
      if (cancelled) return;

      if (savedTown) {
        setSelectedCollegeTown(savedTown);
      }
      setTownHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.campus_id]);

  useEffect(() => {
    if (!townHydrated) return;
    loadBarbers();
  }, [townHydrated, selectedCollegeTown, browseProviderCategory]);

  // Load unread message count on mount
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Load barbers — uses college town for distance when set; otherwise all providers
  const loadBarbers = async () => {
    try {
      setIsLoading(true);
      const constrainByDistance = getBrowseConstrainByDistance();
      const maxDistanceMiles = getBrowseMaxDistanceMiles();
      const latitude = selectedCollegeTown?.latitude ?? null;
      const longitude = selectedCollegeTown?.longitude ?? null;
      const listFilters = browseCategoryApiParam(browseProviderCategory);

      let response;
      if (latitude != null && longitude != null && constrainByDistance) {
        response = await providerService.getProvidersByLocation(
          latitude,
          longitude,
          { constrainListByDistance: true, ...listFilters },
          milesToKmForBrowse(maxDistanceMiles)
        );
      } else {
        response = await providerService.getProviders(listFilters);
      }

      setBarbers(response?.data || []);
      setCurrentBarberIndex(0);
    } catch (error) {
      console.error('Failed to load barbers:', error);
      setBarbers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDistanceString = (barber: Barber): string | null => {
    if (!getBrowseConstrainByDistance()) return null;
    const miles = getBarberDistanceMilesFromTown(
      barber,
      selectedCollegeTown?.latitude,
      selectedCollegeTown?.longitude
    );
    return formatBarberDistanceFromUser(miles);
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

  // Handle profile photo upload
  const handlePhotoUpload = async (file: File) => {
    console.log('[MobileConsumerPage] handlePhotoUpload called with file:', { name: file.name, size: file.size, type: file.type });
    
    if (!user?.id) {
      console.error('[MobileConsumerPage] User not found');
      toast.error('Please sign in to update your photo');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      console.log('[MobileConsumerPage] Calling userService.uploadProfilePhoto');
      const result = await userService.uploadProfilePhoto(user.id, file);
      console.log('[MobileConsumerPage] Upload result:', result);
      
      // Update user profile with new photo URL
      console.log('[MobileConsumerPage] Updating user profile with new URL');
      await userService.updateUserProfile(user.id, { profile_picture_url: result.url });
      
      // Update auth store
      setUser({
        ...user,
        profile_picture_url: result.url,
      });
      
      toast.success('Profile photo updated!');
    } catch (error: any) {
      console.error('[MobileConsumerPage] Failed to upload photo:', error);
      console.error('[MobileConsumerPage] Error details:', error.response?.data || error.message);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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

  // Show loading while resolving browse area or fetching providers
  if (isAuthLoading || !townHydrated || isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-gray-800 animate-spin mb-4" />
        <p className="text-gray-600 text-center">
          {isAuthLoading || !townHydrated
            ? 'Loading...'
            : selectedCollegeTown
              ? `Finding barbers near ${selectedCollegeTown.shortName}...`
              : 'Finding providers...'}
        </p>
      </div>
    );
  }

  if (!currentBarber) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center p-6">
        <GraduationCap className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Barbers Found</h2>
        <p className="text-gray-600 text-center mb-4">
          {selectedCollegeTown
            ? `We couldn't find any barbers near ${selectedCollegeTown.shortName}.`
            : 'No providers are available yet.'}
        </p>
        <p className="text-sm text-gray-500 text-center mb-6">
          {selectedCollegeTown
            ? 'Check back later or try a different college town.'
            : 'Check back soon as more providers join the platform.'}
        </p>
        {selectedCollegeTown && (
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-brand-500 text-white rounded-lg font-semibold"
          >
            Change Town
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Header - changes based on active tab */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between safe-area-inset-top">
        {activeTab === 'profile' && showFullEditor ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFullEditor(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
          </div>
        ) : activeTab === 'profile' ? (
          <div className="flex items-center gap-2">
            <img src="/src/assets/logos/Logo1.png" alt="PismoPlatforms" className="h-8" />
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Profile</h1>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <img src="/src/assets/logos/Logo1.png" alt="PismoPlatforms" className="h-8" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Discover</h1>
                <p className="text-xs text-gray-500 leading-tight">
                  {selectedCollegeTown?.shortName ?? 'All providers'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPendingBrowseCategory(browseProviderCategory);
                  setShowFilters(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Filter className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Profile Tab Content */}
      {activeTab === 'profile' && !showFullEditor && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {user ? (
            <>
              {/* Profile Photo with Camera/Gallery Upload */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <MobilePhotoUpload
                  currentPhotoUrl={user?.profile_picture_url}
                  onPhotoSelected={handlePhotoUpload}
                  isUploading={isUploadingPhoto}
                />
                <h2 className="text-xl font-bold text-gray-900 text-center mt-4">
                  {user?.first_name} {user?.last_name}
                </h2>
                <p className="text-gray-500 text-sm text-center mt-1">{user?.email}</p>
              </div>

              <div className="space-y-2">
                <button 
                  onClick={() => setShowFullEditor(true)}
                  className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform"
                >
                  <span className="font-medium text-gray-900">Edit Full Profile</span>
                  <X className="w-5 h-5 text-gray-400 rotate-45" />
                </button>
                
                <button 
                  onClick={() => navigate(`${platformPrefix}/consumer/bookings`)}
                  className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform"
                >
                  <span className="font-medium text-gray-900">My Bookings</span>
                  <Calendar className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => setShowBlockedProvidersModal(true)}
                  className="w-full bg-white p-4 rounded-xl border border-gray-200 text-left flex items-center justify-between active:scale-98 transition-transform"
                >
                  <span className="font-medium text-gray-900">Blocked providers</span>
                  <UserX className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 text-red-600 font-medium"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <UserIcon className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 text-center mb-4">Sign in to manage your profile</p>
              <button
                onClick={() => navigate('/web')}
                className="px-6 py-3 bg-brand-500 text-white rounded-lg font-semibold"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Profile Editor */}
      {activeTab === 'profile' && showFullEditor && user && (
        <div className="flex-1 overflow-y-auto p-4">
          <ConsumerProfileEditor userId={user.id} />
        </div>
      )}

      {/* Home Tab - Swipeable Card Area */}
      {activeTab === 'home' && (
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
                <div className="absolute bottom-4 left-4 bg-gray-900 text-white px-4 py-2 rounded-full font-bold shadow-lg">
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
                {getDistanceString(currentBarber) && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{getDistanceString(currentBarber)}</span>
                  </div>
                )}
                
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
      )}

      {/* Action Buttons - only show on home tab */}
      {activeTab === 'home' && (
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
              className="w-20 h-20 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl"
            >
              <Heart className="w-10 h-10 text-white" />
            </button>
          </div>
          
          <p className="text-center text-sm text-gray-500 mt-4">
            Swipe left to pass, right to book
          </p>
        </div>
      )}

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
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors relative ${
              activeTab === 'messages' ? 'text-primary-600 bg-primary-50' : 'text-gray-600'
            }`}
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </div>
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
                {getDistanceString(currentBarber) && (
                  <p className="text-gray-500">{getDistanceString(currentBarber)}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                // Navigate to booking page
                setShowBookingSheet(false);
                navigate(`/app/consumer/book/${currentBarber.id}`);
              }}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-4 rounded-xl transition-colors active:scale-98 shadow-lg"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Provider type</label>
                <div className="flex flex-wrap gap-2">
                  {BROWSE_PROVIDER_CATEGORIES.map((option) => {
                    const isSelected = pendingBrowseCategory === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPendingBrowseCategory(option.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-gray-900 text-white'
                            : 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {
                    (BROWSE_PROVIDER_CATEGORIES.find((option) => option.id === pendingBrowseCategory) ??
                      BROWSE_PROVIDER_CATEGORIES[0]).description
                  }
                </p>
              </div>

              <button
                onClick={() => {
                  setBrowseProviderCategoryState(pendingBrowseCategory);
                  setBrowseProviderCategory(pendingBrowseCategory);
                  setShowFilters(false);
                }}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-4 rounded-xl transition-colors active:scale-98 shadow-lg mt-6"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <BlockedProvidersModal open={showBlockedProvidersModal} onClose={() => setShowBlockedProvidersModal(false)} />
    </div>
  );
}

