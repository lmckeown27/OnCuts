import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, DollarSign, Award, Users as UsersIcon, User as UserIcon, Home, TrendingUp, Calendar } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ConsumerProfileEditor from '../components/ConsumerProfileEditor';
import { ConsumerScoreDashboard } from '../components/ConsumerScoreDashboard';
import BarberFilterQuestionnaire from '../components/BarberFilterQuestionnaire';
import type { FilterCriteria } from '../types/barber-filters';
import barberService from '../services/barber.service';
import type { Barber } from '../types';
import toast from 'react-hot-toast';
import { CampusCutsLogo } from '@assets';

type TabType = 'discovery' | 'score' | 'profile';

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
      
      // Instant book bonus (convenience factor)
      if (barber.instant_book_enabled) {
        score += 15;
      }
      
      return { barber, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ barber }) => barber);
}

export default function ConsumerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('discovery');
  
  // Mock consumer ID - in production this would come from auth
  const consumerId = 'consumer-1';

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
            <Button onClick={() => navigate('/web')} variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Button>
          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('discovery')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'discovery'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Home className="w-4 h-4 inline mr-2" />
                Find Barbers
              </button>
              <button
                onClick={() => setActiveTab('score')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'score'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                My Score
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserIcon className="w-4 h-4 inline mr-2" />
                My Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'discovery' && <DiscoveryView navigate={navigate} />}
        {activeTab === 'score' && <ConsumerScoreDashboard userId={consumerId} />}
        {activeTab === 'profile' && <ConsumerProfileEditor userId={consumerId} />}
      </div>
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
      />

      {/* Results Count */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            {filteredBarbers.length} {filteredBarbers.length === 1 ? 'Barber' : 'Barbers'} Available
          </h2>
        </div>
        {filterCriteria.serviceType && (
          <div className="text-sm text-gray-600">
            Sorted by top performers first
          </div>
        )}
      </div>

      {/* No Results */}
      {filteredBarbers.length === 0 && filterCriteria.serviceType && (
        <Card className="text-center py-12">
          <p className="text-gray-600 text-lg mb-2">No barbers match your criteria</p>
          <p className="text-sm text-gray-500">Try adjusting your filters or check back later</p>
        </Card>
      )}


      {/* Barbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBarbers.map((barber) => {
          const lowestPrice = barber.pricing && barber.pricing.length > 0
            ? Math.min(...barber.pricing.map(p => p.price))
            : null;

          return (
            <Card
              key={barber.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/student/barbers/${barber.id}`)}
            >
              {/* Portfolio Grid (Pinterest-style) */}
              <div className="grid grid-cols-3 gap-1 mb-4 h-48 overflow-hidden rounded-lg">
                {barber.portfolio?.slice(0, 6).map((img, idx) => (
                  <img
                    key={idx}
                    src={img.url}
                    alt={`Portfolio ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ))}
                {(!barber.portfolio || barber.portfolio.length === 0) && (
                  <div className="col-span-3 bg-gray-200 flex items-center justify-center h-full">
                    <Users className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Barber Info */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {barber.user?.first_name} {barber.user?.last_name}
                </h3>

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
                      className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>

                {/* Price & Experience */}
                <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                  {lowestPrice && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span>From ${lowestPrice}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    <span>{barber.years_experience} yrs</span>
                  </div>
                </div>

                {/* Instant Book Badge */}
                {barber.instant_book_enabled && (
                  <div className="mb-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      Instant Book
                    </span>
                  </div>
                )}

                {/* Book Button */}
                <Button className="w-full mt-2" onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/student/barbers/${barber.id}`);
                }}>
                  View Profile
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredBarbers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
