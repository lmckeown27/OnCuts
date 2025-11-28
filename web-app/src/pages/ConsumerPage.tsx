import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Star, DollarSign, Award, Filter, Users } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
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
      score += barber.years_of_experience * 5;
      
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
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    minRating: 0,
    maxPrice: 1000,
    instantBookOnly: false,
    specialties: [] as string[],
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
      
      // Mock data for demonstration (no backend required)
      const mockBarbers = [
        {
          id: '1',
          user_id: 'barber-1',
          campus_id: '1',
          bio: 'Specializing in modern cuts and fades. 5+ years experience.',
          years_of_experience: 5,
          instant_book_enabled: true,
          vacation_mode: false,
          average_rating: 4.8,
          total_bookings: 234,
          specialties: ['Fades', 'Modern Cuts', 'Beard Trim'],
          created_at: new Date(Date.now() - 86400000 * 365).toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            id: 'barber-1',
            first_name: 'Marcus',
            last_name: 'Johnson',
            email: 'marcus@calpoly.edu',
          },
          portfolio: [
            { id: '1', image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400', uploaded_at: new Date().toISOString() },
            { id: '2', image_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400', uploaded_at: new Date().toISOString() },
          ],
          services: [
            { id: '1', name: 'Classic Fade', price_cents: 2500, duration_minutes: 30 },
            { id: '2', name: 'Beard Trim', price_cents: 1500, duration_minutes: 15 },
          ],
        },
        {
          id: '2',
          user_id: 'barber-2',
          campus_id: '1',
          bio: 'Expert in textured cuts and natural styles. Your hair, your way.',
          years_of_experience: 3,
          instant_book_enabled: true,
          vacation_mode: false,
          average_rating: 4.9,
          total_bookings: 189,
          specialties: ['Textured Cuts', 'Natural Hair', 'Braids'],
          created_at: new Date(Date.now() - 86400000 * 730).toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            id: 'barber-2',
            first_name: 'Jasmine',
            last_name: 'Williams',
            email: 'jasmine@calpoly.edu',
          },
          portfolio: [
            { id: '3', image_url: 'https://images.unsplash.com/photo-1560869713-bf165a6e2e66?w=400', uploaded_at: new Date().toISOString() },
            { id: '4', image_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400', uploaded_at: new Date().toISOString() },
          ],
          services: [
            { id: '3', name: 'Natural Hair Cut', price_cents: 3000, duration_minutes: 45 },
            { id: '4', name: 'Braiding', price_cents: 5000, duration_minutes: 90 },
          ],
        },
        {
          id: '3',
          user_id: 'barber-3',
          campus_id: '2',
          bio: 'Classic barbering meets modern style. Walk-ins welcome!',
          years_of_experience: 7,
          instant_book_enabled: false,
          vacation_mode: false,
          average_rating: 4.7,
          total_bookings: 412,
          specialties: ['Classic Cuts', 'Hot Towel Shave', 'Gentleman\'s Cut'],
          created_at: new Date(Date.now() - 86400000 * 1095).toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            id: 'barber-3',
            first_name: 'David',
            last_name: 'Chen',
            email: 'david@ucsb.edu',
          },
          portfolio: [
            { id: '5', image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400', uploaded_at: new Date().toISOString() },
            { id: '6', image_url: 'https://images.unsplash.com/photo-1599351431613-151b5dee8c90?w=400', uploaded_at: new Date().toISOString() },
          ],
          services: [
            { id: '5', name: 'Classic Cut', price_cents: 2800, duration_minutes: 35 },
            { id: '6', name: 'Hot Towel Shave', price_cents: 3500, duration_minutes: 40 },
          ],
        },
        {
          id: '4',
          user_id: 'barber-4',
          campus_id: '1',
          bio: 'Precision cuts, attention to detail. Book now for the best look on campus.',
          years_of_experience: 4,
          instant_book_enabled: true,
          vacation_mode: false,
          average_rating: 4.6,
          total_bookings: 156,
          specialties: ['Precision Cuts', 'Line-ups', 'Design Work'],
          created_at: new Date(Date.now() - 86400000 * 800).toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            id: 'barber-4',
            first_name: 'Tyler',
            last_name: 'Rodriguez',
            email: 'tyler@calpoly.edu',
          },
          portfolio: [
            { id: '7', image_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=400', uploaded_at: new Date().toISOString() },
            { id: '8', image_url: 'https://images.unsplash.com/photo-1620231419658-f2f4e175eb7d?w=400', uploaded_at: new Date().toISOString() },
          ],
          services: [
            { id: '7', name: 'Precision Cut + Line-up', price_cents: 3200, duration_minutes: 40 },
            { id: '8', name: 'Design Work', price_cents: 4000, duration_minutes: 50 },
          ],
        },
      ];

      const rankedBarbers = rankBarbers(mockBarbers as any);
      setBarbers(rankedBarbers);
    } catch (error) {
      console.error('Failed to load barbers:', error);
      toast.error('Failed to load barbers');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...barbers];

    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((b) => 
        b.user?.first_name?.toLowerCase().includes(query) ||
        b.user?.last_name?.toLowerCase().includes(query) ||
        b.bio?.toLowerCase().includes(query) ||
        b.specialties.some(s => s.toLowerCase().includes(query))
      );
    }

    // Rating filter
    if (filters.minRating > 0) {
      result = result.filter((b) => b.average_rating >= filters.minRating);
    }

    // Price filter
    if (filters.maxPrice < 1000) {
      result = result.filter((b) => {
        const minPrice = Math.min(...b.pricing.map(p => p.price));
        return minPrice <= filters.maxPrice;
      });
    }

    // Instant book filter
    if (filters.instantBookOnly) {
      result = result.filter((b) => b.instant_book_enabled);
    }

    // Specialties filter
    if (filters.specialties.length > 0) {
      result = result.filter((b) =>
        filters.specialties.some(spec => b.specialties.includes(spec))
      );
    }

    setFilteredBarbers(result);
  };

  const getLowestPrice = (barber: Barber) => {
    if (!barber.pricing || barber.pricing.length === 0) return null;
    return Math.min(...barber.pricing.map(p => p.price));
  };

  const clearFilters = () => {
    setFilters({
      minRating: 0,
      maxPrice: 1000,
      instantBookOnly: false,
      specialties: [],
    });
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-gray-900">Find a Barber</h1>
          </div>
          <Button onClick={() => navigate('/')} variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search barbers, styles, specialties..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'primary' : 'secondary'}
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mb-6 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700">
                Clear All
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="0">Any Rating</option>
                  <option value="3">3+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                </select>
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price: ${filters.maxPrice}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Instant Book Filter */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="instant-book"
                  checked={filters.instantBookOnly}
                  onChange={(e) => setFilters({ ...filters, instantBookOnly: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="instant-book" className="ml-2 text-sm font-medium text-gray-700">
                  Instant Book Only
                </label>
              </div>
            </div>
          </Card>
        )}

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredBarbers.length} {filteredBarbers.length === 1 ? 'barber' : 'barbers'}
          </p>
        </div>

        {/* Barber Grid (Pinterest-style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBarbers.map((barber) => {
            const lowestPrice = getLowestPrice(barber);
            const fullName = `${barber.user?.first_name || ''} ${barber.user?.last_name || ''}`.trim();
            const initials = fullName.split(' ').map(n => n[0]).join('');

            return (
              <Card
                key={barber.id}
                hoverable
                className="overflow-hidden cursor-pointer transition-transform hover:scale-105"
                onClick={() => navigate(`/student/barbers/${barber.id}`)}
              >
                {/* Portfolio Image or Placeholder */}
                <div className="relative w-full h-56 bg-gradient-to-br from-primary-400 to-primary-600">
                  {barber.portfolio_images && barber.portfolio_images.length > 0 ? (
                    <img
                      src={barber.portfolio_images[0].image_url}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-5xl font-bold">
                      {initials}
                    </div>
                  )}
                  
                  {/* Instant Book Badge */}
                  {barber.instant_book_enabled && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      Instant Book
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Name & Rating */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{fullName}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-semibold text-gray-900">{barber.average_rating.toFixed(1)}</span>
                    <span className="text-sm text-gray-600">({barber.total_bookings} bookings)</span>
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {barber.specialties.slice(0, 2).map((specialty, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                    {barber.specialties.length > 2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{barber.specialties.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Price & Experience */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    {lowestPrice && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>From ${lowestPrice}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      <span>{barber.years_of_experience} yrs</span>
                    </div>
                  </div>

                  {/* Book Button */}
                  <Button className="w-full mt-4" onClick={(e) => {
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
      </div>
    </div>
  );
}

