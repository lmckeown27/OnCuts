import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Search, ChevronDown, Loader2, AlertCircle,
  Calendar, DollarSign, TrendingUp, Scissors, ChevronLeft,
  MessageSquare, Star, Clock, UserPlus, Mail, X
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
  slug?: string;
  city?: string;
  state?: string;
  managerId?: string;
  managerName?: string;
}

interface CampusPerformance {
  totalBarbers: number;
  activeBarbers: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number; // Total money in circulation (what customers paid)
  totalPlatformFees: number; // Platform's gross cut (15%)
  totalBarberEarnings: number; // What barbers earned (85%)
  estimatedStripeFees: number; // Stripe processing fees (2.9% + $0.30/txn)
  netPlatformRevenue: number; // Platform's actual take after Stripe fees
  completedTransactionCount: number; // Number of completed transactions
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

type MetricsPeriod = '1w' | '4w' | '1y' | 'mtd' | 'qtd' | 'ytd' | 'all';
type MetricsView = 'revenue' | 'bookings';
type AdminView = 'performance' | 'barbers' | 'users';

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
  campusName?: string;
  hasStripeSetup?: boolean; // Stripe fully complete (visible to consumers)
  hasStripeAccountOnly?: boolean; // Stripe account created but payouts not enabled (NOT visible to consumers)
  createdAt?: string;
}

interface BarberBooking {
  id: string;
  service_type: string;
  price_cents: number;
  tip_cents: number;
  total_paid_cents: number;
  status: string;
  scheduled_time: string;
  created_at: string;
  paid_at: string | null;
  review_rating: number | null;
  review_text: string | null;
  consumer_id: string;
  consumer_first_name: string;
  consumer_last_name: string;
  consumer_email: string;
  consumer_avatar: string | null;
  message_count: number;
}

interface BookingMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  sender_first_name: string;
  sender_last_name: string;
  sender_avatar: string | null;
  sender_role: string;
}

interface PlatformUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  campus_name: string | null;
  created_at: string;
  is_active: boolean;
  customer_number: number;
}

interface AdminDashboardProps {
  campuses?: Campus[];
  selectedCampusId?: string;
  onCampusIdChange?: (campusId: string | null) => void;
  isLoadingCampuses?: boolean;
  hideHeader?: boolean;
}

export function AdminDashboard({ 
  campuses: externalCampuses,
  selectedCampusId: externalCampusId,
  onCampusIdChange,
  isLoadingCampuses: externalIsLoading,
  hideHeader = false
}: AdminDashboardProps) {
  // Internal state for uncontrolled mode
  const [internalCampuses, setInternalCampuses] = useState<Campus[]>([]);
  const [internalSelectedCampusId, setInternalSelectedCampusId] = useState<string>('');
  const [internalIsLoadingCampuses, setInternalIsLoadingCampuses] = useState(true);
  
  // Use external or internal state
  const campuses = externalCampuses || internalCampuses;
  const selectedCampusId = externalCampusId !== undefined ? externalCampusId : internalSelectedCampusId;
  const isLoadingCampuses = externalIsLoading !== undefined ? externalIsLoading : internalIsLoadingCampuses;
  const isControlled = externalCampuses !== undefined;
  
  const setSelectedCampusId = (id: string | null) => {
    if (onCampusIdChange) {
      onCampusIdChange(id);
    } else {
      setInternalSelectedCampusId(id || '');
    }
  };
  
  const setCampuses = (campusList: Campus[]) => {
    if (!isControlled) {
      setInternalCampuses(campusList);
    }
  };
  
  const setIsLoadingCampuses = (loading: boolean) => {
    if (!isControlled) {
      setInternalIsLoadingCampuses(loading);
    }
  };
  const [performance, setPerformance] = useState<CampusPerformance | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  
  const [campusLoadError, setCampusLoadError] = useState<string | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(false);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  
  // Metrics chart state
  const [metrics, setMetrics] = useState<MetricsDataPoint[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('4w');
  const [metricsView, setMetricsView] = useState<MetricsView>('revenue');
  const [isChartHovered, setIsChartHovered] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ label: string; revenue: number; bookings: number } | null>(null);
  
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [barberSearchQuery, setBarberSearchQuery] = useState('');
  const [adminView, setAdminView] = useState<AdminView>('performance');
  
  // Barber detail view state
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [barberBookings, setBarberBookings] = useState<BarberBooking[]>([]);
  const [isLoadingBarberBookings, setIsLoadingBarberBookings] = useState(false);
  const [selectedBookingMessages, setSelectedBookingMessages] = useState<BookingMessage[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // Consumers view state
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // All barbers view state (when no campus selected)
  const [allBarbersTab, setAllBarbersTab] = useState<'managers' | 'active' | 'inactive'>('active');
  const [activeBarberStripeFilter, setActiveBarberStripeFilter] = useState<'all' | 'setup' | 'not-setup'>('all');
  const [allBarberSearchQuery, setAllBarberSearchQuery] = useState('');
  
  const campusDropdownRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Lock scroll when actively hovering chart
  useEffect(() => {
    if (!isChartHovered) return;
    
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    // Lock body scroll on touch devices while chart is being interacted with
    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [isChartHovered]);
  
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
  
  // Fetch campus performance when campus changes (or aggregate when none selected)
  useEffect(() => {
    const fetchPerformance = async () => {
      setIsLoadingPerformance(true);
      try {
        // Use aggregate endpoint when no campus selected, otherwise campus-specific
        const url = selectedCampusId 
          ? `/admin/campuses/${selectedCampusId}/performance`
          : '/admin/campuses/aggregate/performance';
        const response = await api.get<CampusPerformance>(url);
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
  
  // Fetch barbers for campus when campus changes (or all barbers if no campus selected)
  useEffect(() => {
    const fetchBarbers = async () => {
      setIsLoadingBarbers(true);
      try {
        // If no campus selected, fetch all barbers; otherwise fetch campus-specific
        const url = selectedCampusId 
          ? `/admin/campuses/${selectedCampusId}/barbers`
          : '/admin/barbers';
        const response = await api.get<{ barbers: Barber[] } | Barber[]>(url);
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
  
  // Fetch metrics when campus or period changes (or aggregate when none selected)
  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        // Use aggregate endpoint when no campus selected, otherwise campus-specific
        const url = selectedCampusId 
          ? `/admin/campuses/${selectedCampusId}/metrics?period=${metricsPeriod}`
          : `/admin/campuses/aggregate/metrics?period=${metricsPeriod}`;
        // api.get already extracts response.data.data, so we get the array directly
        const metricsData = await api.get<MetricsDataPoint[]>(url);
        setMetrics(Array.isArray(metricsData) ? metricsData : []);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setMetrics([]);
      } finally {
        setIsLoadingMetrics(false);
      }
    };
    
    fetchMetrics();
  }, [selectedCampusId, metricsPeriod]);
  
  // Fetch total user count whenever campus changes (for summary stats)
  useEffect(() => {
    const fetchUserCount = async () => {
      setIsLoadingUsers(true);
      try {
        // If no campus selected, fetch all consumers; otherwise filter by campus
        const url = selectedCampusId 
          ? `/admin/users?campusId=${selectedCampusId}`
          : '/admin/users';
        const response = await api.get<{ users: PlatformUser[]; pagination: { total: number } }>(url);
        setTotalUsersCount(response.pagination?.total || response.users?.length || 0);
      } catch (error) {
        console.error('Failed to fetch user count:', error);
        setTotalUsersCount(0);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    fetchUserCount();
  }, [selectedCampusId]);
  
  // Fetch full user list when Users tab is selected
  useEffect(() => {
    const fetchUsers = async () => {
      if (adminView !== 'users') return;
      
      setIsLoadingUsers(true);
      try {
        // If no campus selected, fetch all consumers; otherwise filter by campus
        const url = selectedCampusId 
          ? `/admin/users?campusId=${selectedCampusId}`
          : '/admin/users';
        const response = await api.get<{ users: PlatformUser[]; pagination: { total: number } }>(url);
        setUsers(response.users || []);
        setTotalUsersCount(response.pagination?.total || response.users?.length || 0);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
        setTotalUsersCount(0);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    fetchUsers();
  }, [adminView, selectedCampusId]);
  
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
  
  // Filtered barbers for the "all barbers" view (when no campus selected)
  const filteredAllBarbers = useMemo(() => {
    if (!allBarberSearchQuery) return barbers;
    const query = allBarberSearchQuery.toLowerCase();
    return barbers.filter(b => 
      b.firstName.toLowerCase().includes(query) || 
      b.lastName.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query) ||
      (b.campusName && b.campusName.toLowerCase().includes(query))
    );
  }, [barbers, allBarberSearchQuery]);
  
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    
    const query = userSearchQuery.toLowerCase();
    return users.filter(u => 
      u.first_name.toLowerCase().includes(query) || 
      u.last_name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, userSearchQuery]);
  
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
  
  // Format campus name for display - remove trailing "University" except for "University of X" names
  const formatCampusName = (name: string) => {
    // Keep "University of X" names intact
    if (name.startsWith('University of ')) return name;
    // Remove trailing " University" from other names
    if (name.endsWith(' University')) return name.slice(0, -11);
    return name;
  };
  
  // Format service type from SNAKE_CASE to Title Case (e.g., "HAIRCUT" -> "Haircut")
  const formatServiceType = (service: string) => {
    if (!service) return 'Service';
    return service.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };
  
  // Handle barber card click - fetch their bookings
  const handleBarberClick = async (barber: Barber) => {
    setSelectedBarber(barber);
    setBarberBookings([]);
    setSelectedBookingId(null);
    setSelectedBookingMessages([]);
    setIsLoadingBarberBookings(true);
    
    try {
      const response = await api.get<{ bookings: BarberBooking[] }>(`/admin/barbers/${barber.barberRecordId}/bookings`);
      setBarberBookings(response.bookings || []);
    } catch (error) {
      console.error('Failed to fetch barber bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoadingBarberBookings(false);
    }
  };
  
  // Handle booking click - fetch messages
  const handleBookingClick = async (bookingId: string) => {
    if (selectedBookingId === bookingId) {
      // Toggle off
      setSelectedBookingId(null);
      setSelectedBookingMessages([]);
      return;
    }
    
    setSelectedBookingId(bookingId);
    setSelectedBookingMessages([]);
    setIsLoadingMessages(true);
    
    try {
      const response = await api.get<{ messages: BookingMessage[] }>(`/admin/bookings/${bookingId}/messages`);
      setSelectedBookingMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };
  
  // Go back from barber detail view
  const handleBackToBarbers = () => {
    setSelectedBarber(null);
    setBarberBookings([]);
    setSelectedBookingId(null);
    setSelectedBookingMessages([]);
  };
  
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = metrics.map(m => {
      const date = new Date(m.date);
      // Daily granularity periods: 1w, 4w, mtd, qtd
      if (['1w', '4w', 'mtd', 'qtd'].includes(metricsPeriod)) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      // Weekly granularity periods: 1y, ytd
      } else if (['1y', 'ytd'].includes(metricsPeriod)) {
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      // Monthly granularity: all
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
          borderColor: '#708d81', // primary color for both views
          backgroundColor: 'rgba(112, 141, 129, 0.15)', // primary color with opacity
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [metrics, metricsPeriod, metricsView]);
  
  // Custom crosshair plugin for vertical line on hover
  const crosshairPlugin = useMemo(() => ({
    id: 'crosshair',
    afterDraw: (chart: any) => {
      if (chart.tooltip?._active?.length) {
        const activePoint = chart.tooltip._active[0];
        const ctx = chart.ctx;
        const x = activePoint.element.x;
        const topY = chart.scales.y.top;
        const bottomY = chart.scales.y.bottom;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(112, 141, 129, 0.5)'; // Primary color with opacity
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    },
  }), []);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 0,
        right: 8, // Small padding so last point is easily hoverable
        top: 8,
        bottom: 0,
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false, // Disabled - showing data in header instead
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: (value: any) => {
            return metricsView === 'revenue' ? `$${value}` : value;
          },
        },
      },
    },
    hover: {
      mode: 'index' as const,
      intersect: false,
    },
    onHover: (_event: any, activeElements: any[], chart: any) => {
      if (activeElements.length > 0) {
        setIsChartHovered(true);
        const index = activeElements[0].index;
        if (metrics[index]) {
          const m = metrics[index];
          setHoveredDataPoint({
            label: chart.data.labels[index] || m.date,
            revenue: m.revenue,
            bookings: m.bookings,
          });
        }
      } else {
        setIsChartHovered(false);
        setHoveredDataPoint(null);
      }
    },
  }), [metrics, metricsView]);
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* All Universities Button - Show when campus is selected */}
      {selectedCampusId && (
        <button
          onClick={() => {
            setSelectedCampusId(null);
            setSelectedBarber(null);
            setBarberBookings([]);
          }}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All Universities
        </button>
      )}
      
      {/* Campus Manager Selector - Show above tabs when campus is selected */}
      {selectedCampusId && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Campus Manager
          </p>
          <select
            value={barbers.find(b => b.isCampusManager)?.id || ''}
            onChange={(e) => {
              const currentManager = barbers.find(b => b.isCampusManager);
              if (currentManager && e.target.value !== currentManager.id) {
                handleAssignManager(currentManager.id, false);
              }
              if (e.target.value) {
                handleAssignManager(e.target.value, true);
              }
            }}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">No campus manager assigned</option>
            {barbers.filter(b => b.isActive).map(barber => (
              <option key={barber.id} value={barber.id}>
                {barber.firstName} {barber.lastName}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* View Tabs - Performance / Barbers / Users */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setAdminView('performance')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            adminView === 'performance'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Performance
        </button>
        <button
          onClick={() => setAdminView('barbers')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            adminView === 'barbers'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Barbers
        </button>
        <button
          onClick={() => setAdminView('users')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            adminView === 'users'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Consumers
        </button>
      </div>
      
      {/* Campus Selector - hidden when rendered in header */}
      {!hideHeader && (
      <div>
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
              value={showCampusDropdown ? campusSearchQuery : (selectedCampus ? formatCampusName(selectedCampus.name) : '')}
              onChange={(e) => {
                setCampusSearchQuery(e.target.value);
                if (!showCampusDropdown) setShowCampusDropdown(true);
              }}
              onFocus={() => setShowCampusDropdown(true)}
              placeholder="All Universities"
              className={`w-full text-base bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-primary-500 px-3 py-2.5 rounded-lg transition-colors border border-transparent focus:border-primary-300 outline-none ${
                selectedCampus ? 'text-gray-900 pr-16' : 'text-gray-700 pr-8'
              }`}
            />
            {selectedCampus && !showCampusDropdown && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCampusId(null);
                  setCampusSearchQuery('');
                }}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-300 rounded-full transition-colors"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
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
                        <p className="font-medium text-gray-900">{formatCampusName(campus.name)}</p>
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
      )}
      
      {/* Performance Chart & Summary */}
      {adminView === 'performance' && (
      <>
      {/* Summary Stats - Only visible on Performance tab */}
      <div className="grid grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
        <div>
          <p className="text-gray-500 text-xs">
            {selectedCampus ? `${formatCampusName(selectedCampus.name)} Revenue` : 'Total Revenue'}
          </p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : formatCurrency(performance?.totalRevenue ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Platform Revenue</p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : formatCurrency(performance?.netPlatformRevenue ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">
            {selectedCampus ? `${formatCampusName(selectedCampus.name)} Barbers` : 'Total Barbers'}
          </p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : performance?.totalBarbers ?? 0}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">
            {selectedCampus ? `${formatCampusName(selectedCampus.name)} Consumers` : 'Total Consumers'}
          </p>
          <p className="font-semibold text-gray-900">
            {isLoadingUsers ? '...' : totalUsersCount}
          </p>
        </div>
      </div>
      <div>
        {/* Stats Header - shows hovered data or period totals */}
        <div className="flex items-center justify-center gap-6 mb-3">
          <div className="text-center">
            <p className="text-gray-500 text-xs">
              {hoveredDataPoint ? 'Date' : 'Period'}
            </p>
            <p className="text-base font-semibold text-gray-900">
              {hoveredDataPoint ? hoveredDataPoint.label : 
               metricsPeriod === '1w' ? '1 Week' : 
               metricsPeriod === '4w' ? '4 Weeks' : 
               metricsPeriod === 'mtd' ? 'MTD' : 
               metricsPeriod === 'qtd' ? 'QTD' : 
               metricsPeriod === 'ytd' ? 'YTD' : 
               metricsPeriod === '1y' ? '1 Year' : 'All Time'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">Revenue</p>
            <p className="text-base font-semibold text-gray-900">
              ${hoveredDataPoint 
                ? (hoveredDataPoint.revenue / 100).toFixed(2)
                : (metrics.reduce((sum, m) => sum + m.revenue, 0) / 100).toFixed(2)
              }
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">Bookings</p>
            <p className="text-base font-semibold text-gray-900">
              {hoveredDataPoint 
                ? hoveredDataPoint.bookings
                : metrics.reduce((sum, m) => sum + m.bookings, 0)
              }
            </p>
          </div>
        </div>
        
        {/* Period & View Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setMetricsView('revenue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsView === 'revenue' 
                  ? 'bg-primary-500 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setMetricsView('bookings')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                metricsView === 'bookings' 
                  ? 'bg-primary-500 text-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bookings
            </button>
          </div>
          
          {/* Period Toggle */}
          <div className="flex flex-wrap rounded-lg bg-gray-100 p-0.5 gap-0.5">
            {[
              { key: '1w', label: '1W' },
              { key: '4w', label: '4W' },
              { key: 'mtd', label: 'MTD' },
              { key: 'qtd', label: 'QTD' },
              { key: 'ytd', label: 'YTD' },
              { key: '1y', label: '1Y' },
              { key: 'all', label: 'All' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMetricsPeriod(key as MetricsPeriod)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metricsPeriod === key 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chart - directly under toggles */}
        {isLoadingMetrics ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : metrics.length > 0 ? (
          <div 
            ref={chartContainerRef} 
            className="h-40 sm:h-48 mb-4 max-w-2xl"
            onMouseLeave={() => { setIsChartHovered(false); setHoveredDataPoint(null); }}
            onTouchEnd={() => { setIsChartHovered(false); setHoveredDataPoint(null); }}
          >
            <Line data={chartData} options={chartOptions} plugins={[crosshairPlugin]} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />
            No data available for this period
          </div>
        )}
        
        {/* Performance Summary - Below chart */}
        {performance && (
          <div className="space-y-4 text-sm">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-gray-500 text-xs">Gross Revenue</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(performance.totalRevenue)}</p>
                <p className="text-xs text-gray-400">{performance.completedTransactionCount || 0} transactions</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Barber Earnings (85%)</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(performance.totalBarberEarnings || 0)}</p>
              </div>
            </div>
            
            {/* Platform Revenue */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-3">Platform Revenue (15%)</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Gross</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(performance.totalPlatformFees || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stripe Fees</p>
                  <p className="font-semibold text-gray-900">-{formatCurrency(performance.estimatedStripeFees || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(performance.netPlatformRevenue || 0)}</p>
                </div>
              </div>
            </div>

            {/* Averages */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-gray-500 text-xs">Avg/Appointment</p>
                <p className="font-semibold text-gray-900">{formatCurrency(performance.averageCostPerAppointment)}</p>
                <p className="text-xs text-gray-400">{performance.completedBookings} completed</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">
                  Avg Cuts/{['1w', '4w', 'mtd'].includes(metricsPeriod) ? 'Day' : ['1y', 'ytd', 'qtd'].includes(metricsPeriod) ? 'Week' : 'Month'}
                </p>
                <p className="font-semibold text-gray-900">
                  {['1w', '4w', 'mtd'].includes(metricsPeriod)
                    ? performance.averageBookingsPerDay.toFixed(1)
                    : ['1y', 'ytd', 'qtd'].includes(metricsPeriod)
                    ? performance.averageBookingsPerWeek.toFixed(1)
                    : performance.averageBookingsPerMonth.toFixed(1)
                  }
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">
                  Avg Revenue/{['1w', '4w', 'mtd'].includes(metricsPeriod) ? 'Day' : ['1y', 'ytd', 'qtd'].includes(metricsPeriod) ? 'Week' : 'Month'}
                </p>
                <p className="font-semibold text-gray-900">
                  {['1w', '4w', 'mtd'].includes(metricsPeriod)
                    ? formatCurrency(performance.averageRevenuePerDay)
                    : ['1y', 'ytd', 'qtd'].includes(metricsPeriod)
                    ? formatCurrency(performance.averageRevenuePerWeek)
                    : formatCurrency(performance.averageRevenuePerMonth)
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
      
      {/* Barber Management */}
      {adminView === 'barbers' && (
      <div>
        {selectedBarber ? (
          /* Barber Detail View */
          <div>
            {/* Back button and barber header */}
            <button 
              onClick={handleBackToBarbers}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-3 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to barbers
            </button>
            
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedBarber.profileImageUrl ? (
                  <img src={selectedBarber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-500">{selectedBarber.firstName.charAt(0)}{selectedBarber.lastName.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedBarber.firstName} {selectedBarber.lastName}
                </p>
                <p className="text-xs text-gray-500">{selectedBarber.email}</p>
              </div>
            </div>
            
            {/* Bookings list */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Booking History</h3>
              <span className="text-xs text-gray-500">{barberBookings.length} bookings</span>
            </div>
            
            {isLoadingBarberBookings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : barberBookings.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {barberBookings.map(booking => (
                  <div 
                    key={booking.id} 
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleBookingClick(booking.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          booking.status === 'COMPLETED' || booking.status === 'PAID' 
                            ? 'bg-green-100 text-green-700' 
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status}
                        </span>
                        {booking.review_rating && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-600">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {booking.review_rating}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        ${(booking.total_paid_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    
                    <p className="font-medium text-sm text-gray-900 mb-1">
                      {booking.consumer_first_name} {booking.consumer_last_name}
                    </p>
                    <p className="text-xs text-gray-500">{formatServiceType(booking.service_type)}</p>
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(booking.scheduled_time).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </span>
                      {booking.message_count > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {booking.message_count}
                        </span>
                      )}
                    </div>
                    
                    {/* Expandable messages section */}
                    {selectedBookingId === booking.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Messages</p>
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                          </div>
                        ) : selectedBookingMessages.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {selectedBookingMessages.map(msg => (
                              <div key={msg.id} className="text-xs p-2 bg-gray-100 rounded">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                                    msg.sender_role === 'BARBER' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {msg.sender_role === 'BARBER' ? 'Barber' : 'Customer'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 ml-auto">
                                    {new Date(msg.created_at).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="text-gray-700">{msg.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No messages</p>
                        )}
                        
                        {booking.review_text && (
                          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                            <p className="text-xs font-semibold text-amber-700 mb-1">Review</p>
                            <p className="text-xs text-gray-700">{booking.review_text}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-sm">No bookings found</p>
              </div>
            )}
          </div>
        ) : !selectedCampusId ? (
          /* All Barbers View - organized by status with tabs */
          <div>
            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search barbers by name, email, or campus..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={allBarberSearchQuery}
                onChange={(e) => setAllBarberSearchQuery(e.target.value)}
              />
            </div>
            
            <p className="text-xs text-gray-500 mb-2">Click on a barber to view their booking activity</p>
            
            {/* Main category tabs */}
            <nav className="flex justify-center gap-1 border-b border-gray-200 mb-4">
              <button
                onClick={() => setAllBarbersTab('managers')}
                className={`py-2 px-3 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  allBarbersTab === 'managers'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Managers ({filteredAllBarbers.filter(b => b.isCampusManager).length})
              </button>
              <button
                onClick={() => setAllBarbersTab('active')}
                className={`py-2 px-3 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  allBarbersTab === 'active'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Visible ({filteredAllBarbers.filter(b => b.isActive && !b.isCampusManager).length})
              </button>
              <button
                onClick={() => setAllBarbersTab('inactive')}
                className={`py-2 px-3 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  allBarbersTab === 'inactive'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Hidden ({filteredAllBarbers.filter(b => !b.isActive && !b.isCampusManager).length})
              </button>
            </nav>
            
            {/* Stripe filter for Active tab */}
            {allBarbersTab === 'active' && (
              <div className="flex rounded-lg bg-gray-100 p-1 mb-3">
                <button
                  onClick={() => setActiveBarberStripeFilter('all')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeBarberStripeFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({filteredAllBarbers.filter(b => b.isActive && !b.isCampusManager).length})
                </button>
                <button
                  onClick={() => setActiveBarberStripeFilter('setup')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeBarberStripeFilter === 'setup'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Stripe ({filteredAllBarbers.filter(b => b.isActive && !b.isCampusManager && b.hasStripeSetup).length})
                </button>
                <button
                  onClick={() => setActiveBarberStripeFilter('not-setup')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeBarberStripeFilter === 'not-setup'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  No Stripe ({filteredAllBarbers.filter(b => b.isActive && !b.isCampusManager && !b.hasStripeSetup).length})
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">
                {allBarbersTab === 'managers' ? 'Campus Managers' : allBarbersTab === 'active' ? 'Visible Barbers' : 'Hidden Barbers'}
              </h3>
              <span className="text-xs text-gray-500">{filteredAllBarbers.length} total barbers</span>
            </div>
            
            {isLoadingBarbers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {/* Campus Managers Tab */}
                {allBarbersTab === 'managers' && (
                  filteredAllBarbers.filter(b => b.isCampusManager).length > 0 ? (
                    filteredAllBarbers.filter(b => b.isCampusManager).map(barber => (
                      <button
                        key={barber.id}
                        onClick={() => handleBarberClick(barber)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left border-gray-200 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {barber.profileImageUrl ? (
                              <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-500">{barber.firstName.charAt(0)}{barber.lastName.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">
                              {barber.firstName} {barber.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{barber.campusName ? formatCampusName(barber.campusName) : ''}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <p className="text-sm">No campus managers</p>
                    </div>
                  )
                )}
                
                {/* Active Barbers Tab */}
                {allBarbersTab === 'active' && (() => {
                  const activeBarbers = filteredAllBarbers.filter(b => b.isActive && !b.isCampusManager);
                  const stripeFilteredBarbers = activeBarberStripeFilter === 'all' 
                    ? activeBarbers
                    : activeBarberStripeFilter === 'setup'
                    ? activeBarbers.filter(b => b.hasStripeSetup)
                    : activeBarbers.filter(b => !b.hasStripeSetup);
                  
                  return stripeFilteredBarbers.length > 0 ? (
                    stripeFilteredBarbers.map(barber => (
                      <button
                        key={barber.id}
                        onClick={() => handleBarberClick(barber)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left border-gray-200 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {barber.profileImageUrl ? (
                              <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-500">{barber.firstName.charAt(0)}{barber.lastName.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">{barber.firstName} {barber.lastName}</p>
                            <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{barber.campusName ? formatCampusName(barber.campusName) : ''}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Scissors className="w-8 h-8 mb-2" />
                      <p className="text-sm">No {activeBarberStripeFilter === 'setup' ? 'barbers with Stripe' : activeBarberStripeFilter === 'not-setup' ? 'barbers without Stripe' : 'active barbers'}</p>
                    </div>
                  );
                })()}
                
                {/* Inactive Barbers Tab */}
                {allBarbersTab === 'inactive' && (
                  filteredAllBarbers.filter(b => !b.isActive && !b.isCampusManager).length > 0 ? (
                    filteredAllBarbers.filter(b => !b.isActive && !b.isCampusManager).map(barber => (
                      <button
                        key={barber.id}
                        onClick={() => handleBarberClick(barber)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50 opacity-60 hover:opacity-80 text-left transition-opacity"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {barber.profileImageUrl ? (
                              <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-500">{barber.firstName.charAt(0)}{barber.lastName.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-600 text-sm flex items-center gap-1.5 truncate">{barber.firstName} {barber.lastName}</p>
                            <p className="text-xs text-gray-400 truncate">{barber.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{barber.campusName ? formatCampusName(barber.campusName) : ''}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Scissors className="w-8 h-8 mb-2" />
                      <p className="text-sm">No inactive barbers</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          /* Barber List View (Campus-specific) */
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Barber Management</h3>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={barberSearchQuery}
                onChange={(e) => setBarberSearchQuery(e.target.value)}
                placeholder="Search barbers..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <p className="text-xs text-gray-500 mb-2">Click on a barber to view their booking activity</p>
            
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
                        <button 
                          key={barber.id}
                          onClick={() => handleBarberClick(barber)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left ${
                            barber.isCampusManager 
                              ? 'border-gray-200 hover:bg-gray-50' 
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
                              </p>
                              <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </button>
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
                        <button 
                          key={barber.id}
                          onClick={() => handleBarberClick(barber)}
                          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50 opacity-60 hover:opacity-80 text-left transition-opacity"
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
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </button>
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
      )}
      
      {/* Consumers View */}
      {adminView === 'users' && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Consumer Signups</h3>
          <span className="text-xs text-gray-500">
            {totalUsersCount} total consumers
          </span>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            placeholder="Search consumers..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">
            {filteredUsers.map(user => (
              <div 
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 w-full"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <span className="text-xs font-bold text-primary-600">
                      #{user.customer_number}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(user.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit'
                    })}
                  </p>
                  {user.campus_name && (
                    <p className="text-[10px] text-gray-400 truncate max-w-28 mt-0.5">
                      {user.campus_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <UserPlus className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm">No consumers found</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

