import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, DollarSign, TrendingUp, 
  Crown, Search, ChevronDown, Loader2, AlertCircle
} from 'lucide-react';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import Card from './Card';
import Button from './Button';

interface Campus {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  managerId?: string;
  managerName?: string;
}

interface CampusPerformance {
  totalBarbers: number;
  activeBarbers: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

interface Barber {
  id: string;
  barberRecordId: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  isActive: boolean;
  isCampusManager: boolean;
  campusId?: string;
}

interface AdminDashboardProps {
  initialCampusId?: string;
}

export function AdminDashboard({ initialCampusId }: AdminDashboardProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>(initialCampusId || '');
  const [performance, setPerformance] = useState<CampusPerformance | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  
  const [isLoadingCampuses, setIsLoadingCampuses] = useState(true);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(false);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [barberSearchQuery, setBarberSearchQuery] = useState('');
  
  // Fetch all campuses
  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const response = await api.get<{ campuses: Campus[] } | Campus[]>('/admin/campuses');
        const campusList = Array.isArray(response) ? response : response.campuses || [];
        setCampuses(campusList);
        if (campusList.length > 0 && !selectedCampusId) {
          setSelectedCampusId(campusList[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch campuses:', error);
        toast.error('Failed to load campuses');
      } finally {
        setIsLoadingCampuses(false);
      }
    };
    
    fetchCampuses();
  }, []);
  
  // Fetch campus performance when campus changes
  useEffect(() => {
    const fetchPerformance = async () => {
      if (!selectedCampusId) return;
      
      setIsLoadingPerformance(true);
      try {
        const response = await api.get<CampusPerformance>(`/admin/campuses/${selectedCampusId}/performance`);
        setPerformance(response);
      } catch (error) {
        console.error('Failed to fetch performance:', error);
        setPerformance(null);
      } finally {
        setIsLoadingPerformance(false);
      }
    };
    
    fetchPerformance();
  }, [selectedCampusId]);
  
  // Fetch barbers for campus when campus changes
  useEffect(() => {
    const fetchBarbers = async () => {
      if (!selectedCampusId) return;
      
      setIsLoadingBarbers(true);
      try {
        const response = await api.get<{ barbers: Barber[] } | Barber[]>(`/admin/campuses/${selectedCampusId}/barbers`);
        const barberList = Array.isArray(response) ? response : response.barbers || [];
        setBarbers(barberList);
      } catch (error) {
        console.error('Failed to fetch barbers:', error);
        setBarbers([]);
      } finally {
        setIsLoadingBarbers(false);
      }
    };
    
    fetchBarbers();
  }, [selectedCampusId]);
  
  const selectedCampus = useMemo(() => {
    return campuses.find(c => c.id === selectedCampusId);
  }, [campuses, selectedCampusId]);
  
  const filteredCampuses = useMemo(() => {
    if (!campusSearchQuery) return campuses;
    const query = campusSearchQuery.toLowerCase();
    return campuses.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.city.toLowerCase().includes(query)
    );
  }, [campuses, campusSearchQuery]);
  
  const filteredBarbers = useMemo(() => {
    if (!barberSearchQuery) return barbers;
    const query = barberSearchQuery.toLowerCase();
    return barbers.filter(b => 
      b.firstName.toLowerCase().includes(query) || 
      b.lastName.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query)
    );
  }, [barbers, barberSearchQuery]);
  
  const handleAssignManager = async (barberUserId: string, assign: boolean) => {
    setIsAssigning(barberUserId);
    try {
      await api.post(`/admin/campuses/${selectedCampusId}/manager`, {
        barberUserId,
        action: assign ? 'assign' : 'remove'
      });
      
      toast.success(assign ? 'Campus manager assigned!' : 'Campus manager removed');
      
      // Refresh barbers list
      const response = await api.get<{ barbers: Barber[] } | Barber[]>(`/admin/campuses/${selectedCampusId}/barbers`);
      const barberList = Array.isArray(response) ? response : response.barbers || [];
      setBarbers(barberList);
      
      // Refresh campus list to update manager info
      const campusResponse = await api.get<{ campuses: Campus[] } | Campus[]>('/admin/campuses');
      const campusList = Array.isArray(campusResponse) ? campusResponse : campusResponse.campuses || [];
      setCampuses(campusList);
    } catch (error: any) {
      console.error('Failed to assign manager:', error);
      toast.error(error.message || 'Failed to update campus manager');
    } finally {
      setIsAssigning(null);
    }
  };
  
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Campus Selector */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Select University</h3>
        
        {isLoadingCampuses ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="relative">
            <div 
              className="flex items-center justify-between p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
              onClick={() => setShowCampusDropdown(!showCampusDropdown)}
            >
              <span className="font-medium text-sm">
                {selectedCampus ? selectedCampus.name : 'Select a university...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCampusDropdown ? 'rotate-180' : ''}`} />
            </div>
            
            {showCampusDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-hidden">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={campusSearchQuery}
                      onChange={(e) => setCampusSearchQuery(e.target.value)}
                      placeholder="Search universities..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredCampuses.map(campus => (
                    <button
                      key={campus.id}
                      onClick={() => {
                        setSelectedCampusId(campus.id);
                        setShowCampusDropdown(false);
                        setCampusSearchQuery('');
                      }}
                      className={`w-full px-4 py-2.5 text-left hover:bg-purple-50 flex items-center justify-between text-sm ${
                        campus.id === selectedCampusId ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{campus.name}</p>
                        <p className="text-xs text-gray-500">{campus.city}, {campus.state}</p>
                      </div>
                      {campus.managerName && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          CM: {campus.managerName}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Performance Metrics */}
      {selectedCampusId && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Performance Metrics</h3>
          
          {isLoadingPerformance ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          ) : performance ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Barbers</span>
                </div>
                <p className="text-xl font-bold text-blue-700">{performance.activeBarbers}</p>
                <p className="text-xs text-blue-500">{performance.totalBarbers} total</p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Bookings</span>
                </div>
                <p className="text-xl font-bold text-green-700">{performance.completedBookings}</p>
                <p className="text-xs text-green-500">{performance.totalBookings} total</p>
              </div>
              
              <div className="p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs text-amber-600 font-medium">Revenue</span>
                </div>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(performance.totalRevenue)}</p>
                <p className="text-xs text-amber-500">Total processed</p>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Rating</span>
                </div>
                <p className="text-xl font-bold text-purple-700">
                  {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : 'N/A'}
                </p>
                <p className="text-xs text-purple-500">{performance.totalReviews} reviews</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              No performance data available
            </div>
          )}
        </div>
      )}
      
      {/* Campus Manager Assignment */}
      {selectedCampusId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Campus Manager</h3>
            {selectedCampus?.managerName && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                Current: {selectedCampus.managerName}
              </span>
            )}
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={barberSearchQuery}
              onChange={(e) => setBarberSearchQuery(e.target.value)}
              placeholder="Search barbers..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          {isLoadingBarbers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          ) : filteredBarbers.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredBarbers.map(barber => (
                <div 
                  key={barber.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    barber.isCampusManager 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {barber.profileImageUrl ? (
                        <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-500">
                          {barber.firstName.charAt(0)}{barber.lastName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">
                        {barber.firstName} {barber.lastName}
                        {barber.isCampusManager && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {barber.isCampusManager ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleAssignManager(barber.id, false)}
                        disabled={isAssigning === barber.id}
                        className="text-xs px-2 py-1"
                      >
                        {isAssigning === barber.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Remove'
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAssignManager(barber.id, true)}
                        disabled={isAssigning === barber.id || !barber.isActive}
                        className="text-xs px-2 py-1"
                      >
                        {isAssigning === barber.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Users className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm">No barbers found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

