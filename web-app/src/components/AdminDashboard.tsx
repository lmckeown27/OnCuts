import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Crown, Search, ChevronDown, Loader2, AlertCircle,
  Calendar, DollarSign, TrendingUp, Scissors
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import Button from './Button';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
  // Average metrics
  averageBookingsPerDay: number;
  averageBookingsPerWeek: number;
  averageBookingsPerMonth: number;
  averageRevenuePerDay: number;
  averageRevenuePerWeek: number;
  averageRevenuePerMonth: number;
  averageCostPerAppointment: number;
}

interface MetricsDataPoint {
  date: string;
  bookings: number;
  revenue: number;
}

interface MetricsResponse {
  period: string;
  data: MetricsDataPoint[];
}

type MetricsPeriod = 'daily' | 'weekly' | 'monthly';
type MetricsView = 'revenue' | 'bookings';

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
  const [campusLoadError, setCampusLoadError] = useState<string | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(false);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  
  // Metrics chart state
  const [metrics, setMetrics] = useState<MetricsDataPoint[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('daily');
  const [metricsView, setMetricsView] = useState<MetricsView>('revenue');
  
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [barberSearchQuery, setBarberSearchQuery] = useState('');
  
  const campusDropdownRef = useRef<HTMLDivElement>(null);
  
  // Close campus dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (campusDropdownRef.current && !campusDropdownRef.current.contains(event.target as Node)) {
        setShowCampusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Fetch all campuses
  const fetchCampuses = async () => {
    setIsLoadingCampuses(true);
    setCampusLoadError(null);
    try {
      const response = await api.get<{ campuses: Campus[] } | Campus[]>('/admin/campuses');
      const campusList = Array.isArray(response) ? response : response.campuses || [];
      setCampuses(campusList);
      // Don't auto-select first campus - admin should choose
    } catch (error: any) {
      console.error('Failed to fetch campuses:', error);
      setCampusLoadError(error.message || 'Failed to load campuses. The backend may need to be restarted.');
    } finally {
      setIsLoadingCampuses(false);
    }
  };
  
  useEffect(() => {
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
  
  // Fetch metrics when campus or period changes
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!selectedCampusId) return;
      
      setIsLoadingMetrics(true);
      try {
        const response = await api.get<MetricsResponse>(`/admin/campuses/${selectedCampusId}/metrics?period=${metricsPeriod}`);
        setMetrics(response.data || []);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setMetrics([]);
      } finally {
        setIsLoadingMetrics(false);
      }
    };
    
    fetchMetrics();
  }, [selectedCampusId, metricsPeriod]);
  
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
  
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = metrics.map(m => {
      const date = new Date(m.date);
      if (metricsPeriod === 'daily') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (metricsPeriod === 'weekly') {
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
    });
    
    const dataValues = metrics.map(m => 
      metricsView === 'revenue' ? m.revenue / 100 : m.bookings
    );
    
    return {
      labels,
      datasets: [
        {
          label: metricsView === 'revenue' ? 'Revenue ($)' : 'Bookings',
          data: dataValues,
          borderColor: metricsView === 'revenue' ? '#f59e0b' : '#10b981',
          backgroundColor: metricsView === 'revenue' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [metrics, metricsPeriod, metricsView]);
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            return metricsView === 'revenue' 
              ? `$${value.toFixed(2)}` 
              : `${value} bookings`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            return metricsView === 'revenue' ? `$${value}` : value;
          },
        },
      },
    },
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Campus Selector */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Select University</h3>
        
        {isLoadingCampuses ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : campusLoadError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Failed to load campuses</p>
                <p className="text-xs text-red-600 mt-1">{campusLoadError}</p>
                <button
                  onClick={fetchCampuses}
                  className="mt-2 text-xs font-medium text-red-700 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative" ref={campusDropdownRef}>
            <input
              type="text"
              value={showCampusDropdown ? campusSearchQuery : (selectedCampus?.name || '')}
              onChange={(e) => {
                setCampusSearchQuery(e.target.value);
                if (!showCampusDropdown) setShowCampusDropdown(true);
              }}
              onFocus={() => setShowCampusDropdown(true)}
              placeholder="Search campuses..."
              className="w-full text-base text-gray-700 bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-primary-500 px-3 py-2.5 pr-8 rounded-lg transition-colors border border-transparent focus:border-primary-300 outline-none"
            />
            <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${showCampusDropdown ? 'rotate-180' : ''}`} />
            
            {showCampusDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                {campusSearchQuery.trim() === '' ? (
                  // Show "Start typing to search" when no query
                  <div className="p-4 text-center text-gray-500">
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>Start typing to search</p>
                    <p className="text-xs mt-1 text-gray-400">{campuses.length} universities available</p>
                  </div>
                ) : filteredCampuses.length > 0 ? (
                  filteredCampuses.map(campus => (
                    <button
                      key={campus.id}
                      onClick={() => {
                        setSelectedCampusId(campus.id);
                        setShowCampusDropdown(false);
                        setCampusSearchQuery('');
                      }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-gray-100 flex items-center justify-between text-sm ${
                        campus.id === selectedCampusId ? 'bg-primary-50' : ''
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
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-gray-500 text-center">No campuses found</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Performance Chart & Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Performance Trends</h3>
        </div>
        
        {/* Period & View Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setMetricsView('revenue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsView === 'revenue' 
                  ? 'bg-amber-500 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setMetricsView('bookings')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsView === 'bookings' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bookings
            </button>
          </div>
          
          {/* Period Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setMetricsPeriod('daily')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsPeriod === 'daily' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setMetricsPeriod('weekly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsPeriod === 'weekly' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setMetricsPeriod('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsPeriod === 'monthly' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        
        {/* Performance Summary - Based on Selected Period */}
        {selectedCampusId && performance && (
          <div className="mb-4 space-y-3">
            {/* Average Cost Per Appointment - Always visible */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Scissors className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Avg Cost Per Appointment</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatCurrency(performance.averageCostPerAppointment)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-500">
                  {performance.completedBookings} completed
                </p>
              </div>
            </div>

            {/* Period-specific metrics */}
            <div className="grid grid-cols-2 gap-2">
              {/* Bookings metric based on period */}
              <div className={`p-3 rounded-xl text-center ${
                metricsPeriod === 'daily' ? 'bg-blue-50' :
                metricsPeriod === 'weekly' ? 'bg-indigo-50' : 'bg-purple-50'
              }`}>
                <Calendar className={`w-4 h-4 mx-auto mb-1 ${
                  metricsPeriod === 'daily' ? 'text-blue-500' :
                  metricsPeriod === 'weekly' ? 'text-indigo-500' : 'text-purple-500'
                }`} />
                <p className={`text-2xl font-bold ${
                  metricsPeriod === 'daily' ? 'text-blue-700' :
                  metricsPeriod === 'weekly' ? 'text-indigo-700' : 'text-purple-700'
                }`}>
                  {metricsPeriod === 'daily' 
                    ? performance.averageBookingsPerDay.toFixed(1)
                    : metricsPeriod === 'weekly'
                    ? performance.averageBookingsPerWeek.toFixed(1)
                    : performance.averageBookingsPerMonth.toFixed(1)
                  }
                </p>
                <p className={`text-xs font-medium ${
                  metricsPeriod === 'daily' ? 'text-blue-500' :
                  metricsPeriod === 'weekly' ? 'text-indigo-500' : 'text-purple-500'
                }`}>
                  Avg Cuts/{metricsPeriod === 'daily' ? 'Day' : metricsPeriod === 'weekly' ? 'Week' : 'Month'}
                </p>
              </div>

              {/* Revenue metric based on period */}
              <div className={`p-3 rounded-xl text-center ${
                metricsPeriod === 'daily' ? 'bg-amber-50' :
                metricsPeriod === 'weekly' ? 'bg-orange-50' : 'bg-rose-50'
              }`}>
                <DollarSign className={`w-4 h-4 mx-auto mb-1 ${
                  metricsPeriod === 'daily' ? 'text-amber-500' :
                  metricsPeriod === 'weekly' ? 'text-orange-500' : 'text-rose-500'
                }`} />
                <p className={`text-2xl font-bold ${
                  metricsPeriod === 'daily' ? 'text-amber-700' :
                  metricsPeriod === 'weekly' ? 'text-orange-700' : 'text-rose-700'
                }`}>
                  {metricsPeriod === 'daily' 
                    ? formatCurrency(performance.averageRevenuePerDay)
                    : metricsPeriod === 'weekly'
                    ? formatCurrency(performance.averageRevenuePerWeek)
                    : formatCurrency(performance.averageRevenuePerMonth)
                  }
                </p>
                <p className={`text-xs font-medium ${
                  metricsPeriod === 'daily' ? 'text-amber-500' :
                  metricsPeriod === 'weekly' ? 'text-orange-500' : 'text-rose-500'
                }`}>
                  Avg Revenue/{metricsPeriod === 'daily' ? 'Day' : metricsPeriod === 'weekly' ? 'Week' : 'Month'}
                </p>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">Total Revenue</p>
                    <p className="text-xl font-bold text-green-700">
                      {formatCurrency(performance.totalRevenue)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-green-500">
                  All time
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Chart */}
        {!selectedCampusId ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            Select a university to view performance data
          </div>
        ) : isLoadingMetrics ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : metrics.length > 0 ? (
          <div className="h-48 sm:h-56">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            No data available for this period
          </div>
        )}
      </div>
      
      {/* Campus Manager Assignment - Always visible */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Campus Manager</h3>
          {selectedCampus?.managerName && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Current: {selectedCampus.managerName}
            </span>
          )}
        </div>
        
        {!selectedCampusId ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            Select a university to manage campus managers
          </div>
        ) : (
          <>
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
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {/* Active Barbers */}
              {filteredBarbers.filter(b => b.isActive).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                    Active ({filteredBarbers.filter(b => b.isActive).length})
                  </p>
                  <div className="space-y-2">
                    {filteredBarbers.filter(b => b.isActive).map(barber => (
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
                              disabled={isAssigning === barber.id}
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
                </div>
              )}
              
              {/* Inactive Barbers */}
              {filteredBarbers.filter(b => !b.isActive).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Inactive ({filteredBarbers.filter(b => !b.isActive).length})
                  </p>
                  <div className="space-y-2">
                    {filteredBarbers.filter(b => !b.isActive).map(barber => (
                      <div 
                        key={barber.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50 opacity-60"
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
                            <p className="font-medium text-gray-600 text-sm flex items-center gap-1.5 truncate">
                              {barber.firstName} {barber.lastName}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{barber.email}</p>
                          </div>
                        </div>
                        
                        <span className="text-xs text-gray-400 px-2 py-1">Inactive</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Users className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm">No barbers found</p>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

