import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, DollarSign, Users as UsersIcon, User as UserIcon, Calendar, Settings, LogOut, ChevronDown, Instagram } from 'lucide-react';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ConsumerProfileEditor from '../components/ConsumerProfileEditor';
import BarberFilterQuestionnaire from '../components/BarberFilterQuestionnaire';
import type { FilterCriteria } from '../types/barber-filters';
import barberService from '../services/barber.service';
import type { Barber } from '../types';
import toast from 'react-hot-toast';
import { CampusCutsLogo } from '@assets';

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
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mock consumer ID - in production this would come from auth
  const consumerId = 'consumer-1';

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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-400 rounded-full flex items-center justify-center text-white font-semibold">
                  S
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setShowProfileEditor(true);
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
                      navigate('/web');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4 text-gray-500" />
                    Back to Roles
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <DiscoveryView navigate={navigate} />
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileEditor(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
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
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    serviceType: null,
    date: null,
    time: null,
    location: null,
    locationDetails: null,
  });

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
      
      // Apply algorithmic ranking
      const rankedBarbers = rankBarbers(barbersData);
      setBarbers(rankedBarbers);
      setFilteredBarbers(rankedBarbers);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load barbers:', error);
      toast.error('Failed to load barbers');
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

  const availableServices = [
    'Haircut',
    'Fade',
    'Beard Trim',
    'Full Service',
    'Hot Towel Shave',
    'Color',
    'Styling',
    'Lineup',
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
        <div className="mb-6 text-center text-sm text-gray-600">
          Sorted by top performers first
        </div>
      )}

      {/* No Results */}
      {filteredBarbers.length === 0 && filterCriteria.serviceType && (
        <Card className="text-center py-12">
          <p className="text-gray-600 text-lg mb-2">No barbers match your criteria</p>
          <p className="text-sm text-gray-500">Try adjusting your filters or check back later</p>
        </Card>
      )}


      {/* Barbers Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredBarbers.map((barber) => {
          const lowestPrice = barber.pricing && barber.pricing.length > 0
            ? Math.min(...barber.pricing.map(p => p.price))
            : null;

          return (
            <Card
              key={barber.id}
              className="cursor-pointer hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-200 h-full flex flex-col rounded-lg overflow-hidden"
              onClick={() => navigate(`/student/barbers/${barber.id}`)}
            >
              {/* Portfolio Image with Name & Price Overlays */}
              <div className="relative mb-3 h-64 overflow-hidden rounded-lg bg-gray-200">
                {barber.portfolio && barber.portfolio.length > 0 ? (
                  <img
                    src={barber.portfolio[0].url}
                    alt="Portfolio"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UsersIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                {/* Name Overlay - Top */}
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3">
                  <h3 className="text-lg font-bold text-white">
                    {barber.user?.first_name} {barber.user?.last_name}
                  </h3>
                </div>
                {/* Price Overlay - Bottom Left */}
                {lowestPrice && (
                  <div className="absolute bottom-0 left-0 bg-primary-400/90 backdrop-blur-sm px-3 py-2 rounded-tr-lg">
                    <div className="flex items-center text-white">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold text-sm">{lowestPrice}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Barber Info */}
              <div className="flex-1 flex flex-col pb-2">

                {/* Rating & Bookings */}
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{barber.average_rating.toFixed(1)}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600">
                    {barber.total_bookings} booking{barber.total_bookings !== 1 ? 's' : ''}
                  </span>
                </div>

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

                {/* Instagram Handle (if available) */}
                {barber.instagram_handle && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Instagram className="w-4 h-4" />
                    <span>@{barber.instagram_handle}</span>
                  </div>
                )}
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
    </>
  );
}
