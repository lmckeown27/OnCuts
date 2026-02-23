import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Building2, Users, Calendar, DollarSign, TrendingUp, 
  UserCheck, Crown, Search, ChevronDown, Loader2, AlertCircle,
  CheckCircle, XCircle, BarChart3
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import Button from '../components/Button';

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const platformPrefix = '/web';
  
  // Check admin access
  const isAdmin = user?.is_admin || user?.user_type === 'admin';
  
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [performance, setPerformance] = useState<CampusPerformance | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  
  const [isLoadingCampuses, setIsLoadingCampuses] = useState(true);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(false);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [barberSearchQuery, setBarberSearchQuery] = useState('');
  
  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      navigate(`${platformPrefix}/barber`);
    }
  }, [isAdmin, navigate]);
  
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
    
    if (isAdmin) {
      fetchCampuses();
    }
  }, [isAdmin]);
  
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
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`${platformPrefix}/barber`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Platform Administration</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Campus Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Select University</h2>
          </div>
          
          {isLoadingCampuses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="relative">
              <div 
                className="flex items-center justify-between p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
                onClick={() => setShowCampusDropdown(!showCampusDropdown)}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">
                    {selectedCampus ? selectedCampus.name : 'Select a university...'}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCampusDropdown ? 'rotate-180' : ''}`} />
              </div>
              
              {showCampusDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-hidden">
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
                  <div className="max-h-60 overflow-y-auto">
                    {filteredCampuses.map(campus => (
                      <button
                        key={campus.id}
                        onClick={() => {
                          setSelectedCampusId(campus.id);
                          setShowCampusDropdown(false);
                          setCampusSearchQuery('');
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center justify-between ${
                          campus.id === selectedCampusId ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{campus.name}</p>
                          <p className="text-sm text-gray-500">{campus.city}, {campus.state}</p>
                        </div>
                        {campus.managerName && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
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
        </Card>
        
        {/* Performance Metrics */}
        {selectedCampusId && (
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Performance Metrics
                {selectedCampus && <span className="text-gray-500 font-normal"> - {selectedCampus.name}</span>}
              </h2>
            </div>
            
            {isLoadingPerformance ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : performance ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-600 font-medium">Barbers</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{performance.activeBarbers}</p>
                  <p className="text-xs text-blue-500">{performance.totalBarbers} total</p>
                </div>
                
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Bookings</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{performance.completedBookings}</p>
                  <p className="text-xs text-green-500">{performance.totalBookings} total</p>
                </div>
                
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-600 font-medium">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{formatCurrency(performance.totalRevenue)}</p>
                  <p className="text-xs text-amber-500">Total processed</p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-600 font-medium">Rating</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">
                    {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : 'N/A'}
                  </p>
                  <p className="text-xs text-purple-500">{performance.totalReviews} reviews</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <AlertCircle className="w-5 h-5 mr-2" />
                No performance data available
              </div>
            )}
          </Card>
        )}
        
        {/* Campus Manager Assignment */}
        {selectedCampusId && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Campus Manager Assignment</h2>
              </div>
              {selectedCampus?.managerName && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                  Current: {selectedCampus.managerName}
                </span>
              )}
            </div>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={barberSearchQuery}
                onChange={(e) => setBarberSearchQuery(e.target.value)}
                placeholder="Search barbers by name or email..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            {isLoadingBarbers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : filteredBarbers.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredBarbers.map(barber => (
                  <div 
                    key={barber.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      barber.isCampusManager 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {barber.profileImageUrl ? (
                          <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-gray-500">
                            {barber.firstName.charAt(0)}{barber.lastName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {barber.firstName} {barber.lastName}
                          {barber.isCampusManager && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{barber.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {barber.isActive ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                      )}
                      
                      {barber.isCampusManager ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleAssignManager(barber.id, false)}
                          disabled={isAssigning === barber.id}
                        >
                          {isAssigning === barber.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Remove
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAssignManager(barber.id, true)}
                          disabled={isAssigning === barber.id || !barber.isActive}
                        >
                          {isAssigning === barber.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Users className="w-12 h-12 text-gray-300 mb-3" />
                <p>No barbers found for this campus</p>
                <p className="text-sm text-gray-400">Barbers need to sign up and be approved first</p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

