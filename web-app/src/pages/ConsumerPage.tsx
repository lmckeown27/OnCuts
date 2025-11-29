import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Star, DollarSign, Award, Filter, Users, User as UserIcon, Home, TrendingUp } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import ConsumerProfileEditor from '../components/ConsumerProfileEditor';
import { ConsumerScoreDashboard } from '../components/ConsumerScoreDashboard';
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
            <Button onClick={() => navigate('/')} variant="secondary" size="sm">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    minRating: 0,
    maxPrice: 1000,
    instantBook: false,
    specialty: '',
  });

  useEffect(() => {
    loadBarbers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [barbers, searchQuery, filters]);

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

    // Search query
    if (searchQuery) {
      filtered = filtered.filter(barber =>
        barber.user?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barber.user?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barber.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barber.specialties?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Rating filter
    if (filters.minRating > 0) {
      filtered = filtered.filter(b => b.average_rating >= filters.minRating);
    }

    // Price filter
    if (filters.maxPrice < 1000) {
      filtered = filtered.filter(b => {
        if (!b.pricing || b.pricing.length === 0) return true;
        const minPrice = Math.min(...b.pricing.map(p => p.price));
        return minPrice <= filters.maxPrice;
      });
    }

    // Instant book filter
    if (filters.instantBook) {
      filtered = filtered.filter(b => b.instant_book_enabled);
    }

    // Specialty filter
    if (filters.specialty) {
      filtered = filtered.filter(b =>
        b.specialties?.some(s => s.toLowerCase().includes(filters.specialty.toLowerCase()))
      );
    }

    setFilteredBarbers(filtered);
  };

  const clearFilters = () => {
    setFilters({
      minRating: 0,
      maxPrice: 1000,
      instantBook: false,
      specialty: '',
    });
    setSearchQuery('');
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search barbers by name, style, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <Button onClick={() => setShowFilters(!showFilters)} variant="secondary">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                >
                  <option value={0}>Any</option>
                  <option value={3}>3+ Stars</option>
                  <option value={4}>4+ Stars</option>
                  <option value={4.5}>4.5+ Stars</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price
                </label>
                <select
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                >
                  <option value={1000}>Any</option>
                  <option value={20}>Under $20</option>
                  <option value={30}>Under $30</option>
                  <option value={40}>Under $40</option>
                  <option value={50}>Under $50</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialty
                </label>
                <input
                  type="text"
                  placeholder="e.g., Fades"
                  value={filters.specialty}
                  onChange={(e) => setFilters({ ...filters, specialty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.instantBook}
                    onChange={(e) => setFilters({ ...filters, instantBook: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Instant Book Only</span>
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={clearFilters} variant="secondary" size="sm">
                Clear All Filters
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filteredBarbers.length} barber{filteredBarbers.length !== 1 ? 's' : ''} found
        </p>
      </div>

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
                      ⚡ Instant Book
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
