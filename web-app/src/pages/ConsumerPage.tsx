// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, Users as UsersIcon, User as UserIcon, Calendar, Settings, LogOut, ChevronDown, Instagram, Scissors, ArrowLeft, Menu } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ConsumerProfileEditor from '../components/ConsumerProfileEditor';
import BarberFilterQuestionnaire from '../components/BarberFilterQuestionnaire';
import type { FilterCriteria } from '../types/barber-filters';
import barberService from '../services/barber.service';
import type { Barber } from '../types';
import toast from 'react-hot-toast';
import { CampusCutLogo } from '@assets';
import { useAuthStore } from '../store/useAuthStore';
import { useViewport, useBodyScrollLock } from '../hooks';

// Mock data for demo
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+1'],
      is_active: true,
      base_price: 25,
      max_price: 35,
      name: 'Mark Johnson',
      user: { first_name: 'Mark', last_name: 'Johnson' },
      pricing: [{ service: 'Haircut', price: 25 }],
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+2'],
      is_active: true,
      base_price: 30,
      max_price: 45,
      name: 'David Chen',
      user: { first_name: 'David', last_name: 'Chen' },
      pricing: [{ service: 'Beard Trim', price: 30 }],
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+3'],
      is_active: true,
      base_price: 28,
      max_price: 40,
      name: 'Alex Rodriguez',
      user: { first_name: 'Alex', last_name: 'Rodriguez' },
      pricing: [{ service: 'Haircut', price: 28 }],
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+4'],
      is_active: true,
      base_price: 26,
      max_price: 36,
      name: 'Jordan Smith',
      user: { first_name: 'Jordan', last_name: 'Smith' },
      pricing: [{ service: 'Haircut', price: 26 }],
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+5'],
      is_active: true,
      base_price: 27,
      max_price: 38,
      name: 'Marcus Williams',
      user: { first_name: 'Marcus', last_name: 'Williams' },
      pricing: [{ service: 'Haircut', price: 27 }],
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
      portfolio_images: ['https://placehold.co/400x400/708d81/white?text=Portfolio+6'],
      is_active: true,
      base_price: 32,
      max_price: 48,
      name: 'Tyler Anderson',
      user: { first_name: 'Tyler', last_name: 'Anderson' },
      pricing: [{ service: 'Full Service', price: 32 }],
    },
  ];
}

// Algorithmic ranking function (capitalistic-but-fair)
function rankBarbers(barbers: Barber[]): Barber[] {
  return barbers
    .map((barber) => {
      // Base score: rating weighted heavily
      let score = barber.average_rating * 100;
      
      // Bonus for experience and bookings
      score += Math.log(barber.total_bookings + 1) * 10;
      score += barber.years_experience * 5;
      
      // Newcomer adjustment: if low bookings but high rating, boost slightly
      if (barber.total_bookings < 20 && barber.average_rating >= 4.5) {
        score += 20; // Give new high-rated barbers a chance
      }
      
      return { barber, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ barber }) => barber);
}

export default function ConsumerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isProfileEditorVisible, setIsProfileEditorVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Preserve form data from ScheduleServicePage when user clicks back
  const preservedFormData = location.state?.preservedFormData;
  
  // Viewport detection for responsive behavior
  const { isMobile, isTablet, viewport } = useViewport();
  
  // Lock body scroll when profile editor is open
  useBodyScrollLock(showProfileEditor);
  
  // Profile editor open/close with animation
  const openProfileEditor = () => {
    setShowProfileEditor(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsProfileEditorVisible(true);
      });
    });
  };
  
  const closeProfileEditor = () => {
    setIsProfileEditorVisible(false);
    setTimeout(() => {
      setShowProfileEditor(false);
    }, 150);
  };
  
  // Determine platform prefix based on current route
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  
  // Mock consumer ID - in production this would come from auth
  const consumerId = 'consumer-1';
  
  // Debug viewport in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Viewport:', viewport, { isMobile, isTablet });
    }
  }, [viewport, isMobile, isTablet]);

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
            {/* Left section - Switch button on mobile, Logo + Switch on desktop */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Switch to Barber - always on left */}
              <button
                onClick={() => navigate(`${platformPrefix}/barber`)}
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                title="Switch to Barber view"
              >
                <Scissors className="w-4 h-4 text-primary-600" />
                <span className="hidden sm:inline text-sm font-medium text-primary-700">Switch to Barber</span>
              </button>
            </div>
            
            {/* Center section - Logo (centered on all screen sizes) */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img src={CampusCutLogo} alt="CampusCut" className="h-10 sm:h-12 w-auto" />
            </div>
            
            {/* Right section - Profile only */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    S
                  </div>
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
                    <div className="border-t border-gray-200 my-1"></div>
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
                    <button
                      onClick={() => {
                        useAuthStore.getState().logout();
                        navigate(`${platformPrefix}`);
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <DiscoveryView navigate={navigate} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${
            isProfileEditorVisible ? 'bg-black/50' : 'bg-black/0'
          }`}
          onClick={closeProfileEditor}
        >
          <div 
            className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto transition-all duration-150 ease-out ${
              isProfileEditorVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={closeProfileEditor}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ConsumerProfileEditor userId={consumerId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoveryView({ navigate }: { navigate: any }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    serviceType: null,
    date: null,
    time: null,
    location: null,
    locationDetails: null,
  });
  
  // Viewport detection for responsive grid
  const { isMobile, isMobilePortrait, viewport } = useViewport();

  useEffect(() => {
    loadBarbers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [barbers, filterCriteria]);

  const loadBarbers = async () => {
    try {
      setLoading(true);
      const response = await barberService.getBarbers();
      const barbersData = response.data || [];
      
      // If no data from API, use mock data
      const finalData = barbersData.length > 0 ? barbersData : getMockBarbers();
      
      // Apply algorithmic ranking
      const rankedBarbers = rankBarbers(finalData);
      setBarbers(rankedBarbers);
      setFilteredBarbers(rankedBarbers);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load barbers:', error);
      // Use mock data on error
      const mockData = getMockBarbers();
      const rankedBarbers = rankBarbers(mockData);
      setBarbers(rankedBarbers);
      setFilteredBarbers(rankedBarbers);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...barbers];

    // Filter by service type
    if (filterCriteria.serviceType) {
      filtered = filtered.filter(barber =>
        barber.specialties?.some(specialty =>
          specialty.toLowerCase().includes(filterCriteria.serviceType!.toLowerCase()) ||
          filterCriteria.serviceType!.toLowerCase().includes(specialty.toLowerCase())
        )
      );
    }

    // Filter by availability (date/time)
    // For now, mock logic - in production, check actual availability
    if (filterCriteria.date && filterCriteria.time) {
      // All barbers available in demo
      filtered = filtered.filter(() => true);
    }

    // Filter by location
    if (filterCriteria.location) {
      // All barbers support all locations in demo
      filtered = filtered.filter(() => true);
    }

    // Sort by rating (highest first)
    filtered.sort((a, b) => b.average_rating - a.average_rating);

    setFilteredBarbers(filtered);
  };

  const handleFilterChange = (filters: FilterCriteria) => {
    setFilterCriteria(filters);
  };

  const clearFilters = () => {
    setFilterCriteria({
      serviceType: null,
      date: null,
      time: null,
      location: null,
      locationDetails: null,
    });
  };

  // Services that match what barbers can offer in BarberServiceSpecialties
  const availableServices = [
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

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      {/* Progressive Filter Questionnaire */}
      <BarberFilterQuestionnaire
        onFilterChange={handleFilterChange}
        availableServices={availableServices}
        availableCount={filteredBarbers.length}
      />

      {/* Sort Info */}
      {filterCriteria.serviceType && filteredBarbers.length > 0 && (
        <div className="mb-4 sm:mb-6 text-center text-xs sm:text-sm text-gray-600">
          Sorted by top performers first
        </div>
      )}

      {/* No Results */}
      {filteredBarbers.length === 0 && filterCriteria.serviceType && (
        <Card className="text-center py-8 sm:py-12">
          <p className="text-gray-600 text-base sm:text-lg mb-2">No barbers match your criteria</p>
          <p className="text-xs sm:text-sm text-gray-500">Try adjusting your filters or check back later</p>
        </Card>
      )}


      {/* Barbers Grid - Responsive: 1 col portrait mobile, 2 col landscape/tablet, 3-5 col desktop */}
      <div className={`grid gap-3 sm:gap-4 mt-8 sm:mt-10 ${
        isMobilePortrait 
          ? 'grid-cols-1' 
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      }`}>
        {filteredBarbers.map((barber) => {
          const lowestPrice = barber.pricing && barber.pricing.length > 0
            ? Math.min(...barber.pricing.map(p => p.price))
            : undefined;

          // Mobile portrait: Horizontal card layout
          if (isMobilePortrait) {
            return (
              <Card
                key={barber.id}
                className="cursor-pointer active:scale-98 transition-all duration-200 flex flex-row rounded-xl overflow-hidden"
                onClick={() => setSelectedBarber(barber)}
              >
                {/* Portfolio Image - Left Side */}
                <div className="relative w-28 h-28 flex-shrink-0 bg-gray-200">
                  {barber.portfolio && barber.portfolio.length > 0 ? (
                    <img
                      src={barber.portfolio[0].url}
                      alt="Portfolio"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UsersIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                {/* Info - Right Side */}
                <div className="flex-1 p-3 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {barber.user?.first_name} {barber.user?.last_name}
                    </h3>
                    {lowestPrice && (
                      <span className="text-primary-500 font-bold text-2xl flex-shrink-0 mr-2">${lowestPrice}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm text-gray-500">{barber.total_bookings} cuts</span>
                    {barber.instagram_handle && (
                      <>
                        <span className="text-gray-400 text-sm">•</span>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Instagram className="w-4 h-4 flex-shrink-0" />
                          <span>@{barber.instagram_handle}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {barber.specialties?.slice(0, 2).map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          }

          // Default: Vertical card layout (tablet, desktop)
          return (
            <Card
              key={barber.id}
              className="cursor-pointer hover:shadow-2xl sm:hover:scale-105 active:scale-98 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col rounded-lg overflow-hidden"
              onClick={() => setSelectedBarber(barber)}
            >
              {/* Portfolio Image with Name & Price Overlays */}
              <div className="relative mb-2 sm:mb-3 h-40 sm:h-64 overflow-hidden rounded-lg bg-gray-200">
                {barber.portfolio && barber.portfolio.length > 0 ? (
                  <img
                    src={barber.portfolio[0].url}
                    alt="Portfolio"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UsersIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
                  </div>
                )}
                {/* Name Overlay - Top */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 sm:p-3">
                  <h3 className="text-sm sm:text-lg font-bold text-white">
                    {barber.user?.first_name} {barber.user?.last_name}
                  </h3>
                </div>
                {/* Price Overlay - Bottom Left */}
                {lowestPrice && (
                  <div className="absolute bottom-0 left-0 bg-primary-400/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-tr-lg rounded-bl-lg">
                    <div className="flex items-center text-white">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-bold text-base sm:text-lg">{lowestPrice}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Barber Info */}
              <div className="flex-1 flex flex-col pb-2">

                {/* Instagram */}
                {barber.instagram_handle && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 mt-1 mb-2">
                    <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate max-w-[80px] sm:max-w-none">@{barber.instagram_handle}</span>
                  </div>
                )}

                {/* Specialties */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {barber.specialties?.slice(0, 3).map((specialty, idx) => (
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
          );
        })}
      </div>

      {/* Empty State */}
      {filteredBarbers.length === 0 && (
        <div className="text-center py-12">
          <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No barbers found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your filters or search query</p>
          <Button onClick={clearFilters} variant="secondary">
            Clear Filters
          </Button>
        </div>
      )}

      {/* Barber Profile Modal */}
      {selectedBarber && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSelectedBarber(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {selectedBarber.user?.first_name} {selectedBarber.user?.last_name}
              </h2>
              <button
                onClick={() => setSelectedBarber(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</span>
              </button>
            </div>
            <div className="p-6">
              {/* Barber Profile Content */}
              <div className="space-y-6">
                {/* Profile Header - Image on top, info below */}
                <div className="flex flex-col gap-4">
                  {/* Barber Image - same size as cards */}
                  <div className="relative h-40 sm:h-64 overflow-hidden rounded-lg bg-gray-200">
                    {selectedBarber.portfolio && selectedBarber.portfolio.length > 0 ? (
                      <img
                        src={selectedBarber.portfolio[0].url}
                        alt="Portfolio"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UsersIcon className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Schedule Button */}
                  <div className="flex justify-center">
                    <Button
                      onClick={() => {
                        const formData = location.state?.preservedFormData;
                        navigate(`/web/consumer/book/${selectedBarber.id}`, {
                          state: {
                            barber: selectedBarber,
                            filters: filterCriteria,
                            preservedFormData: formData?.barberId === selectedBarber.id ? formData : undefined,
                          },
                        });
                      }}
                      className="px-6 py-2 text-base"
                    >
                      Schedule Service
                    </Button>
                  </div>
                  
                  {/* Barber Info */}
                  <div className="text-center">
                    <p className="text-gray-700 mb-4">{selectedBarber.bio}</p>
                    <div className="flex flex-wrap justify-center gap-2 mb-4">
                      {selectedBarber.specialties?.map((specialty, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary-100 text-primary-600 text-sm rounded-full font-medium"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                    {selectedBarber.instagram_handle && (
                      <div className="flex items-center justify-center gap-2 text-gray-600">
                        <Instagram className="w-5 h-5" />
                        <a
                          href={`https://instagram.com/${selectedBarber.instagram_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary-600 transition-colors"
                        >
                          @{selectedBarber.instagram_handle}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
