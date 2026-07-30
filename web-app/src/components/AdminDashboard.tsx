import { useState, useEffect, useMemo, useRef, useCallback, startTransition, useDeferredValue } from 'react';
import { 
  Users, Search, ChevronDown, Loader2, AlertCircle,
  Calendar, DollarSign, TrendingUp, Scissors, ChevronLeft, ChevronRight,
  MessageSquare, Star, Clock, UserPlus, Mail, X, CheckCircle, XCircle,
  Copy, Check, MapPin, Filter, Shield, Briefcase, Activity, Minus, Plus
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
import barberApplicationService, { BarberApplication } from '../services/barber-application.service';
import barberService from '../services/barber.service';
import toast from 'react-hot-toast';
import Button from './Button';
import PullToRefresh from './PullToRefresh';
import {
  ServicesManagementPanel,
} from './AdminCampusPanels';
import { useAuthStore } from '../store/useAuthStore';
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
}

interface CampusPerformance {
  totalBarbers: number;
  activeBarbers: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number; // Total money in circulation (what customers paid)
  totalPlatformFees: number; // Platform's gross cut (Admin-configured %)
  totalBarberEarnings: number; // What barbers earned (85%)
  // Stripe fee breakdown
  stripeProcessingFees: number; // 2.9% + $0.30 per transaction
  stripeConnectFees: number; // Active accounts + volume + payouts
  activeConnectAccounts: number; // Number of barbers who received payouts
  estimatedPayouts: number; // Number of payouts made
  activeAccountBilling: number; // $2/account monthly fee
  volumeBilling: number; // 0.25% volume fee
  payoutFees: number; // $0.25 + 0.25% per payout
  estimatedStripeFees: number; // Total Stripe fees (processing + connect)
  netPlatformRevenue: number; // Platform's actual take after ALL Stripe fees
  completedTransactionCount: number; // Number of completed transactions
  // Card vs Cash breakdown
  cardRevenue: number;
  cardCount: number;
  cashRevenue: number;
  cashCount: number;
  averageRating: number;
  totalReviews: number;
  totalTips: number;
  // Average metrics
  averageBookingsPerDay: number;
  averageBookingsPerWeek: number;
  averageBookingsPerMonth: number;
  averageRevenuePerDay: number;
  averageRevenuePerWeek: number;
  averageRevenuePerMonth: number;
  averageCostPerAppointment: number;
  // AWS Cost Estimates
  awsEc2Cost: number; // EC2 instance
  awsVpcCost: number; // VPC networking
  awsRoute53Cost: number; // DNS
  awsFixedCosts: number; // Total fixed AWS costs
  awsDataTransferCost: number; // Variable data transfer
  awsS3StorageCost: number; // S3 storage
  awsS3RequestsCost: number; // S3 requests
  awsVariableCosts: number; // Total variable AWS costs
  awsTotalCost: number; // Total AWS costs
}

interface MetricsDataPoint {
  date: string;
  bookings: number;
  revenue: number;
  users: number;
}

interface MetricsResponse {
  period: string;
  data: MetricsDataPoint[];
  totalUsers?: number;
}

type MetricsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type MetricsView = 'revenue' | 'bookings' | 'signups';
type AdminView = 'performance' | 'barbers' | 'users' | 'services' | 'moderation';

type UgcReportStatusFilter = 'open' | 'all' | 'dismissed' | 'resolved';

interface UgcContentReport {
  id: string;
  reporter_user_id: string;
  reported_user_id: string;
  conversation_id: number | null;
  message_id: number | null;
  reason: string;
  detail: string | null;
  status: string;
  resolved_at: string | null;
  resolver_admin_id: string | null;
  resolution_notes: string | null;
  created_at: string;
  reporter_email: string;
  reporter_first_name: string;
  reporter_last_name: string;
  reported_email: string;
  reported_first_name: string;
  reported_last_name: string;
  message_preview?: string | null;
  message_is_deleted?: boolean;
  /** Stored report.message_id or latest non-deleted message from reported user in thread */
  moderation_target_message_id?: number | null;
  /** Preview/target message was inferred (client did not send messageId) */
  message_context_is_inferred?: boolean;
}

type BannedAccountCategory = 'service_provider' | 'consumer' | 'admin' | 'other';

interface BannedPlatformUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  campus_name: string | null;
  updated_at: string;
  account_category: BannedAccountCategory;
  has_barber_profile: boolean;
  barber_is_active: boolean | null;
  open_report_count: number;
}

interface Barber {
  id: string;
  barberRecordId: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  isActive: boolean;
  campusId?: string | null;
  campusName?: string | null;
  serviceLocationLabel?: string | null;
  hasServiceLocation?: boolean;
  hasStripeSetup?: boolean; // Stripe fully complete (visible to consumers)
  hasStripeAccountOnly?: boolean; // Stripe account created but payouts not enabled (NOT visible to consumers)
  createdAt?: string;
  completedBookings?: number;
  totalVolumeCents?: number;
  /** Platform ban (e.g. UGC moderation); blocks sign-in */
  isBanned?: boolean;
  commissionFreeBookingsRemaining?: number;
  kickbackPercent?: number;
}

interface BarberBooking {
  id: string;
  service_type: string;
  price_cents: number;
  tip_cents: number;
  total_paid_cents: number;
  status: string;
  payment_method: string | null;
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

interface ConsumerBooking {
  id: string;
  service_type: string;
  price_cents: number;
  tip_cents: number;
  total_paid_cents: number;
  status: string;
  payment_method: string | null;
  scheduled_time: string;
  created_at: string;
  paid_at: string | null;
  review_rating: number | null;
  review_text: string | null;
  barber_record_id: string;
  barber_user_id: string;
  barber_first_name: string;
  barber_last_name: string;
  barber_email: string;
  barber_avatar: string | null;
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
  customer_number: number | null;
}

interface AdminDashboardProps {
  campuses?: Campus[];
  selectedCampusId?: string;
  onCampusIdChange?: (campusId: string | null) => void;
  isLoadingCampuses?: boolean;
  hideHeader?: boolean;
  /** Increment to re-fetch tabs after pull-to-refresh. */
  refreshSignal?: number;
  onRefresh?: () => Promise<void> | void;
}

export function AdminDashboard({ 
  campuses: externalCampuses,
  selectedCampusId: externalCampusId,
  onCampusIdChange,
  isLoadingCampuses: externalIsLoading,
  hideHeader = false,
  refreshSignal = 0,
  onRefresh,
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
  
  // Metrics chart state
  const [metrics, setMetrics] = useState<MetricsDataPoint[]>([]);
  const [metricsTotalUsers, setMetricsTotalUsers] = useState<number>(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('daily');
  const [metricsView, setMetricsView] = useState<MetricsView>('revenue');
  const [isChartHovered, setIsChartHovered] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ label: string; revenue: number; bookings: number; users: number } | null>(null);
  
  const [barberSearchQuery, setBarberSearchQuery] = useState('');
  const [adminView, setAdminView] = useState<AdminView>('performance');
  /** Defer heavy panel swaps so tab chrome stays responsive. */
  const deferredAdminView = useDeferredValue(adminView);
  const [servicesPanelMounted, setServicesPanelMounted] = useState(false);
  const [usersPanelMounted, setUsersPanelMounted] = useState(false);
  
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
  const [usersPage, setUsersPage] = useState(1);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false);
  const USERS_PAGE_SIZE = 40;
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'consumer' | 'admin'>('all');
  const [showUserFilters, setShowUserFilters] = useState(false);
  const [ugcReports, setUgcReports] = useState<UgcContentReport[]>([]);
  const [ugcReportStatusFilter, setUgcReportStatusFilter] = useState<UgcReportStatusFilter>('open');
  const [isLoadingUgcReports, setIsLoadingUgcReports] = useState(false);
  const [ugcReportsError, setUgcReportsError] = useState<string | null>(null);
  const [ugcResolveLoadingId, setUgcResolveLoadingId] = useState<string | null>(null);
  const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null);
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [demotingBarberId, setDemotingBarberId] = useState<string | null>(null);
  const [bannedUsers, setBannedUsers] = useState<BannedPlatformUser[]>([]);
  const [isLoadingBannedUsers, setIsLoadingBannedUsers] = useState(false);
  const [bannedUsersError, setBannedUsersError] = useState<string | null>(null);
  const [bannedCategoryFilter, setBannedCategoryFilter] = useState<'all' | BannedAccountCategory>('all');
  const [commissionFreeRemainingInput, setCommissionFreeRemainingInput] = useState('5');
  const [kickbackPercentInput, setKickbackPercentInput] = useState('0');
  const [isSavingCommission, setIsSavingCommission] = useState(false);
  /** Global platform commission % from /admin/platform-settings */
  const [platformFeePercent, setPlatformFeePercent] = useState(15);
  const [platformFeeInput, setPlatformFeeInput] = useState('15');
  const [isSavingPlatformFee, setIsSavingPlatformFee] = useState(false);
  const [isLoadingPlatformFee, setIsLoadingPlatformFee] = useState(true);
  /** Within Operators tab: list vs onboarding bulk tools */
  const [operatorsHubTab, setOperatorsHubTab] = useState<'operators' | 'onboarding'>('operators');
  const [onboardingScope, setOnboardingScope] = useState<'all' | 'selected'>('all');
  const [onboardingSelectedIds, setOnboardingSelectedIds] = useState<Set<string>>(new Set());
  const [onboardingFreeInput, setOnboardingFreeInput] = useState('0');
  const [onboardingKickbackInput, setOnboardingKickbackInput] = useState('0');
  const [onboardingStripeFilter, setOnboardingStripeFilter] = useState<'all' | 'ready' | 'not-ready'>('all');
  const [onboardingLocationFilter, setOnboardingLocationFilter] = useState<'all' | 'has-pin' | 'missing'>('all');
  const [onboardingFreeFilter, setOnboardingFreeFilter] = useState<'all' | 'with-free' | 'at-zero'>('all');
  const [onboardingKickbackFilter, setOnboardingKickbackFilter] = useState<'all' | 'with-kickback' | 'none'>('all');
  const [showOnboardingFilters, setShowOnboardingFilters] = useState(false);
  const [onboardingSearchQuery, setOnboardingSearchQuery] = useState('');
  const [isSavingOnboardingBulk, setIsSavingOnboardingBulk] = useState(false);
  const [savingOnboardingBarberId, setSavingOnboardingBarberId] = useState<string | null>(null);
  const [onboardingBulkConfirmField, setOnboardingBulkConfirmField] = useState<
    'free' | 'kickback' | null
  >(null);
  
  // Consumer detail view state
  const [selectedConsumer, setSelectedConsumer] = useState<PlatformUser | null>(null);
  const [consumerBookings, setConsumerBookings] = useState<ConsumerBooking[]>([]);
  const [isLoadingConsumerBookings, setIsLoadingConsumerBookings] = useState(false);
  const [isUpdatingUserRole, setIsUpdatingUserRole] = useState(false);
  const currentAdminId = useAuthStore((s) => s.user?.id);
  
  // Barber view state (shared between all-barbers and campus-specific views)
  const [barberViewTab, setBarberViewTab] = useState<'barbers' | 'applications' | 'availability'>('barbers');
  const [barberVisibilityFilter, setBarberVisibilityFilter] = useState<'visible' | 'hidden'>('visible');
  const [activeBarberStripeFilter, setActiveBarberStripeFilter] = useState<'all' | 'setup' | 'not-setup'>('all');
  /** All-universities only: filter by whether operator has a public service pin near a campus */
  const [barberLocationFilter, setBarberLocationFilter] = useState<'all' | 'near-campus' | 'unassigned'>('all');
  const [showBarberFilters, setShowBarberFilters] = useState(false);
  const [allBarberSearchQuery, setAllBarberSearchQuery] = useState('');
  
  // Barber applications state
  const [applications, setApplications] = useState<BarberApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationActionLoading, setApplicationActionLoading] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<BarberApplication | null>(null);
  const [pendingApplicationAction, setPendingApplicationAction] = useState<{ app: BarberApplication; action: 'approve' | 'reject' } | null>(null);
  const [showContactModal, setShowContactModal] = useState<BarberApplication | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);
  
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

  useEffect(() => {
    const fetchPlatformSettings = async () => {
      setIsLoadingPlatformFee(true);
      try {
        const data = await api.get<{ platformFeePercent: number }>('/admin/platform-settings');
        const percent = Number(data?.platformFeePercent);
        if (Number.isFinite(percent)) {
          setPlatformFeePercent(percent);
          setPlatformFeeInput(String(percent));
        }
      } catch (error) {
        console.error('Failed to fetch platform settings:', error);
      } finally {
        setIsLoadingPlatformFee(false);
      }
    };
    void fetchPlatformSettings();
  }, []);

  const handleSavePlatformFee = async () => {
    const percent = parseFloat(platformFeeInput.trim());
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error('Platform commission must be between 0 and 100');
      return;
    }
    setIsSavingPlatformFee(true);
    try {
      const data = await api.put<{ platformFeePercent: number }>('/admin/platform-settings', {
        platformFeePercent: percent,
      });
      const next = Number(data?.platformFeePercent ?? percent);
      setPlatformFeePercent(next);
      setPlatformFeeInput(String(next));
      toast.success(`Platform commission set to ${next}%`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update platform commission');
    } finally {
      setIsSavingPlatformFee(false);
    }
  };  
  // Fetch campus performance when campus changes (or aggregate when none selected)
  // Also poll every 30 seconds for real-time updates
  useEffect(() => {
    const fetchPerformance = async (showLoading = true) => {
      if (showLoading) setIsLoadingPerformance(true);
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
        if (showLoading) setIsLoadingPerformance(false);
      }
    };
    
    // Initial fetch with loading indicator
    fetchPerformance(true);
    
    // Poll every 30 seconds without showing loading indicator
    const intervalId = setInterval(() => fetchPerformance(false), 30000);
    
    return () => clearInterval(intervalId);
  }, [selectedCampusId, refreshSignal]);
  
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
  }, [selectedCampusId, refreshSignal]);
  
  // Fetch barber applications when campus changes (always fetch to show count)
  useEffect(() => {
    const fetchApplications = async () => {
      setIsLoadingApplications(true);
      try {
        // Pass campusId only if one is selected, otherwise fetch all applications
        const allApplications = await barberApplicationService.getAllApplications(selectedCampusId || undefined);
        // Filter to show actionable applications
        const actionableApplications = allApplications.filter(app => {
          if (app.status === 'pending') return true;
          if (app.status === 'approved' && app.application_type === 'guest' && !app.user_id) return true;
          return false;
        });
        setApplications(actionableApplications);
      } catch (error) {
        console.error('Failed to fetch applications:', error);
        setApplications([]);
      } finally {
        setIsLoadingApplications(false);
      }
    };
    
    fetchApplications();
  }, [selectedCampusId, refreshSignal]);
  
  // Show confirmation for application action
  const requestApplicationAction = (app: BarberApplication, action: 'approve' | 'reject') => {
    setPendingApplicationAction({ app, action });
  };

  // Handle application action (approve/reject) - called after confirmation
  const confirmApplicationAction = async () => {
    if (!pendingApplicationAction) return;
    
    const { app, action } = pendingApplicationAction;
    setApplicationActionLoading(app.id);
    setPendingApplicationAction(null);
    
    try {
      if (action === 'approve') {
        await barberApplicationService.updateApplicationStatus(app.id, 'approved');
        toast.success('Application approved!');
      } else {
        await barberApplicationService.updateApplicationStatus(app.id, 'rejected');
        toast.success('Application rejected');
      }
      // Remove from list
      setApplications(prev => prev.filter(a => a.id !== app.id));
      // Clear selected application if it was the one being actioned
      if (selectedApplication?.id === app.id) {
        setSelectedApplication(null);
      }
      // Refresh barbers list in case new barber was added
      if (selectedCampusId) {
        const response = await api.get<{ barbers: Barber[] } | Barber[]>(`/admin/campuses/${selectedCampusId}/barbers`);
        const barberList = Array.isArray(response) ? response : response.barbers || [];
        setBarbers(barberList);
      }
    } catch (error) {
      console.error(`Failed to ${action} application:`, error);
      toast.error(`Failed to ${action} application`);
    } finally {
      setApplicationActionLoading(null);
    }
  };
  
  // Fetch metrics when campus or period changes (or aggregate when none selected)
  // Also poll every 30 seconds for real-time updates
  useEffect(() => {
    const fetchMetrics = async (showLoading = true) => {
      if (showLoading) setIsLoadingMetrics(true);
      try {
        const periodParam = metricsPeriod === 'yearly' ? '1y' : metricsPeriod;
        const url = selectedCampusId 
          ? `/admin/campuses/${selectedCampusId}/metrics?period=${periodParam}`
          : `/admin/campuses/aggregate/metrics?period=${periodParam}`;
        // api.get extracts the data, which could be the full response or just the data array
        const response = await api.get<MetricsResponse | MetricsDataPoint[]>(url);
        
        // Handle both response formats
        if (Array.isArray(response)) {
          setMetrics(response);
          setMetricsTotalUsers(response.reduce((sum, m) => sum + (m.users || 0), 0));
        } else if (response && typeof response === 'object') {
          setMetrics(response.data || []);
          setMetricsTotalUsers(response.totalUsers || response.data?.reduce((sum: number, m: MetricsDataPoint) => sum + (m.users || 0), 0) || 0);
        } else {
          setMetrics([]);
          setMetricsTotalUsers(0);
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setMetrics([]);
        setMetricsTotalUsers(0);
      } finally {
        if (showLoading) setIsLoadingMetrics(false);
      }
    };
    
    // Initial fetch with loading indicator
    fetchMetrics(true);
    
    // Poll every 30 seconds without showing loading indicator
    const intervalId = setInterval(() => fetchMetrics(false), 30000);
    
    return () => clearInterval(intervalId);
  }, [selectedCampusId, metricsPeriod, refreshSignal]);
  
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

      // Soft refresh: only block the panel on the first load
      if (users.length === 0) setIsLoadingUsers(true);
      setUsersPage(1);
      try {
        const params: Record<string, string | number> = {
          page: 1,
          limit: USERS_PAGE_SIZE,
        };
        if (selectedCampusId) params.campusId = selectedCampusId;
        const response = await api.get<{
          users: PlatformUser[];
          pagination: { total: number; page: number; pages: number; limit: number };
        }>('/admin/users', params);
        const list = response.users || [];
        setUsers(list);
        const total = response.pagination?.total || list.length;
        setTotalUsersCount(total);
        setUsersHasMore(list.length < total);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
        setTotalUsersCount(0);
        setUsersHasMore(false);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    void fetchUsers();
    // users.length only gates the spinner; omit from deps to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminView, selectedCampusId, refreshSignal, USERS_PAGE_SIZE]);

  const loadMoreUsers = async () => {
    if (isLoadingMoreUsers || !usersHasMore) return;
    const nextPage = usersPage + 1;
    setIsLoadingMoreUsers(true);
    try {
      const params: Record<string, string | number> = {
        page: nextPage,
        limit: USERS_PAGE_SIZE,
      };
      if (selectedCampusId) params.campusId = selectedCampusId;
      const response = await api.get<{
        users: PlatformUser[];
        pagination: { total: number };
      }>('/admin/users', params);
      const list = response.users || [];
      const total = response.pagination?.total ?? totalUsersCount;
      setUsers((prev) => {
        const next = [...prev, ...list];
        setUsersHasMore(next.length < total);
        return next;
      });
      setUsersPage(nextPage);
    } catch (error) {
      console.error('Failed to load more users:', error);
      toast.error('Could not load more users');
    } finally {
      setIsLoadingMoreUsers(false);
    }
  };

  useEffect(() => {
    if (adminView !== 'moderation') return;
    let cancelled = false;
    const loadReports = async () => {
      setIsLoadingUgcReports(true);
      setUgcReportsError(null);
      try {
        const data = await api.get<{ reports: UgcContentReport[] }>('/admin/moderation/reports', {
          status: ugcReportStatusFilter,
          limit: 200,
        });
        if (!cancelled) {
          setUgcReports(data.reports || []);
        }
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Failed to load reports';
        if (!cancelled) {
          setUgcReports([]);
          setUgcReportsError(msg);
        }
      } finally {
        if (!cancelled) setIsLoadingUgcReports(false);
      }
    };
    loadReports();
    return () => {
      cancelled = true;
    };
  }, [adminView, ugcReportStatusFilter]);

  const loadBannedUsers = useCallback(async () => {
    setIsLoadingBannedUsers(true);
    setBannedUsersError(null);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      if (bannedCategoryFilter !== 'all') {
        params.category = bannedCategoryFilter;
      }
      const data = await api.get<{ users: BannedPlatformUser[] }>('/admin/moderation/banned-users', params);
      setBannedUsers(data.users || []);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to load banned users';
      setBannedUsers([]);
      setBannedUsersError(msg);
    } finally {
      setIsLoadingBannedUsers(false);
    }
  }, [bannedCategoryFilter]);

  useEffect(() => {
    if (adminView !== 'moderation') return;
    void loadBannedUsers();
  }, [adminView, loadBannedUsers]);

  const reloadBarberList = useCallback(async () => {
    try {
      const url = selectedCampusId
        ? `/admin/campuses/${selectedCampusId}/barbers`
        : '/admin/barbers';
      const response = await api.get<{ barbers: Barber[] } | Barber[]>(url);
      const barberList = Array.isArray(response) ? response : response.barbers || [];
      setBarbers(barberList);
      setSelectedBarber((prev) => {
        if (!prev) return null;
        return barberList.find((b) => b.id === prev.id) ?? prev;
      });
    } catch {
      /* keep existing barber list */
    }
  }, [selectedCampusId]);
  
  const selectedCampus = useMemo(() => {
    return campuses.find(c => c.id === selectedCampusId);
  }, [campuses, selectedCampusId]);

  // Campuses with active barbers — used for aggregate Locations/Bookings views
  const campusScopeList = useMemo(() => {
    const idsWithBarbers = new Set(
      barbers.map((b) => b.campusId).filter(Boolean) as string[]
    );
    return campuses
      .filter((c) => idsWithBarbers.has(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
  }, [campuses, barbers]);
  
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
    let list = barbers;
    if (barberLocationFilter === 'near-campus') {
      list = list.filter((b) => Boolean(b.campusId));
    } else if (barberLocationFilter === 'unassigned') {
      list = list.filter((b) => !b.hasServiceLocation || !b.campusId);
    }
    if (!allBarberSearchQuery) return list;
    const query = allBarberSearchQuery.toLowerCase();
    return list.filter(b => 
      b.firstName.toLowerCase().includes(query) || 
      b.lastName.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query) ||
      (b.campusName && b.campusName.toLowerCase().includes(query)) ||
      (b.serviceLocationLabel && b.serviceLocationLabel.toLowerCase().includes(query))
    );
  }, [barbers, allBarberSearchQuery, barberLocationFilter]);

  const onboardingOperators = useMemo(
    () =>
      [...barbers]
        .filter((b) => Boolean(b.barberRecordId))
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        ),
    [barbers]
  );

  const onboardingFiltersActive =
    onboardingStripeFilter !== 'all' ||
    onboardingLocationFilter !== 'all' ||
    onboardingFreeFilter !== 'all' ||
    onboardingKickbackFilter !== 'all';

  const filteredOnboardingOperators = useMemo(() => {
    const query = onboardingSearchQuery.trim().toLowerCase();
    return onboardingOperators.filter((b) => {
      if (onboardingStripeFilter === 'ready' && !b.hasStripeSetup) return false;
      if (onboardingStripeFilter === 'not-ready' && b.hasStripeSetup) return false;
      if (onboardingLocationFilter === 'has-pin' && !b.hasServiceLocation) return false;
      if (onboardingLocationFilter === 'missing' && b.hasServiceLocation) return false;
      const free = b.commissionFreeBookingsRemaining ?? 0;
      if (onboardingFreeFilter === 'with-free' && free <= 0) return false;
      if (onboardingFreeFilter === 'at-zero' && free > 0) return false;
      const kickback = b.kickbackPercent ?? 0;
      if (onboardingKickbackFilter === 'with-kickback' && kickback <= 0) return false;
      if (onboardingKickbackFilter === 'none' && kickback > 0) return false;
      if (!query) return true;
      return (
        b.firstName.toLowerCase().includes(query) ||
        b.lastName.toLowerCase().includes(query) ||
        b.email.toLowerCase().includes(query) ||
        (b.campusName && b.campusName.toLowerCase().includes(query)) ||
        (b.serviceLocationLabel && b.serviceLocationLabel.toLowerCase().includes(query))
      );
    });
  }, [
    onboardingOperators,
    onboardingSearchQuery,
    onboardingStripeFilter,
    onboardingLocationFilter,
    onboardingFreeFilter,
    onboardingKickbackFilter,
  ]);

  const onboardingStats = useMemo(() => {
    const total = onboardingOperators.length;
    let withFree = 0;
    let zeroFree = 0;
    let withKickback = 0;
    let stripeReady = 0;
    let withLocation = 0;
    let totalFreeSlots = 0;
    let kickbackSum = 0;
    for (const b of onboardingOperators) {
      const free = b.commissionFreeBookingsRemaining ?? 0;
      const kickback = b.kickbackPercent ?? 0;
      totalFreeSlots += free;
      kickbackSum += kickback;
      if (free > 0) withFree += 1;
      else zeroFree += 1;
      if (kickback > 0) withKickback += 1;
      if (b.hasStripeSetup) stripeReady += 1;
      if (b.hasServiceLocation) withLocation += 1;
    }
    return {
      total,
      withFree,
      zeroFree,
      withKickback,
      stripeReady,
      stripeNotReady: Math.max(0, total - stripeReady),
      withLocation,
      withoutLocation: Math.max(0, total - withLocation),
      totalFreeSlots,
      avgFreeSlots: total > 0 ? totalFreeSlots / total : 0,
      avgKickbackPercent: total > 0 ? kickbackSum / total : 0,
    };
  }, [onboardingOperators]);

  const stripeStatusBadge = (barber: Barber) =>
    barber.hasStripeSetup ? (
      <span className="text-[10px] text-white bg-purple-600 px-1.5 py-0.5 rounded shrink-0">
        Stripe
      </span>
    ) : (
      <span className="text-[10px] text-white bg-red-600 px-1.5 py-0.5 rounded shrink-0">
        No Stripe
      </span>
    );

  const barberLocationSubtitle = (barber: Barber) => {
    // City/town only — never street address
    let place: string | null = null;
    const raw = barber.serviceLocationLabel?.trim();
    if (raw) {
      const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
      const streetLike =
        /^\d/.test(segments[0] || '') ||
        /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|court)\.?$/i.test(
          segments[0] || ''
        );
      place = streetLike && segments.length >= 2 ? segments[1] : segments[0] || raw;
    } else if (barber.hasServiceLocation) {
      place = 'Location set';
    }

    const campus = barber.campusName?.trim();
    if (campus) {
      return place ? `Near ${campus} · ${place}` : `Near ${campus}`;
    }
    if (place) return place;
    return 'No public location';
  };
  
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userRoleFilter === 'consumer') {
      list = list.filter((u) => String(u.role || 'CONSUMER').toUpperCase() === 'CONSUMER');
    } else if (userRoleFilter === 'admin') {
      list = list.filter((u) => String(u.role || '').toUpperCase() === 'ADMIN');
    }
    if (!userSearchQuery.trim()) return list;
    const query = userSearchQuery.toLowerCase();
    return list.filter(
      (u) =>
        u.first_name.toLowerCase().includes(query) ||
        u.last_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }, [users, userSearchQuery, userRoleFilter]);

  const userRoleFilterActive = userRoleFilter !== 'all';

  const handleUgcResolve = async (
    report: UgcContentReport,
    action: 'dismiss' | 'remove_message' | 'ban_reported_user' | 'remove_message_and_ban'
  ) => {
    if (action === 'remove_message') {
      if (!window.confirm('Remove this message from chat for all users?')) return;
    }
    if (action === 'ban_reported_user') {
      if (!window.confirm('Ban the reported user from the platform?')) return;
    }
    if (action === 'remove_message_and_ban') {
      if (!window.confirm('Remove the message and ban the reported user? This matches a typical trust-and-safety response.')) return;
    }
    setUgcResolveLoadingId(report.id);
    try {
      await api.post(`/admin/moderation/reports/${report.id}/resolve`, { action });
      toast.success('Report updated');
      const data = await api.get<{ reports: UgcContentReport[] }>('/admin/moderation/reports', {
        status: ugcReportStatusFilter,
        limit: 200,
      });
      setUgcReports(data.reports || []);
      if (action === 'ban_reported_user' || action === 'remove_message_and_ban') {
        void loadBannedUsers();
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to update report';
      toast.error(msg);
    } finally {
      setUgcResolveLoadingId(null);
    }
  };

  const handleUnbanBannedUser = async (u: BannedPlatformUser) => {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (!window.confirm(`Remove platform ban for ${name || u.email}? They will be able to sign in again.`)) {
      return;
    }
    setUnbanningUserId(u.id);
    try {
      await api.post(`/admin/users/${u.id}/unban`, {});
      toast.success('User unbanned');
      await loadBannedUsers();
      await reloadBarberList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to unban user';
      toast.error(msg);
    } finally {
      setUnbanningUserId(null);
    }
  };

  const handleUnbanBarber = async (barber: Barber) => {
    if (
      !window.confirm(
        `Remove platform ban for ${barber.firstName} ${barber.lastName}? They will be able to sign in again.`
      )
    ) {
      return;
    }
    setUnbanningUserId(barber.id);
    try {
      await api.post(`/admin/users/${barber.id}/unban`, {});
      toast.success('User unbanned');
      setSelectedBarber((prev) => (prev && prev.id === barber.id ? { ...prev, isBanned: false } : prev));
      await reloadBarberList();
      void loadBannedUsers();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to unban user';
      toast.error(msg);
    } finally {
      setUnbanningUserId(null);
    }
  };

  const handleBanBarber = async (barber: Barber) => {
    if (
      !window.confirm(
        `Ban ${barber.firstName} ${barber.lastName}? They will not be able to sign in.`
      )
    ) {
      return;
    }
    setBanningUserId(barber.id);
    try {
      await api.post(`/admin/users/${barber.id}/ban`, {});
      toast.success('User banned');
      setSelectedBarber((prev) => (prev && prev.id === barber.id ? { ...prev, isBanned: true } : prev));
      await reloadBarberList();
      void loadBannedUsers();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to ban user';
      toast.error(msg);
    } finally {
      setBanningUserId(null);
    }
  };

  const handleDemoteBarber = async (barber: Barber) => {
    if (!barber.barberRecordId) {
      toast.error('Missing provider profile id');
      return;
    }
    if (
      !window.confirm(
        `Revoke operator status for ${barber.firstName} ${barber.lastName}? They will become a consumer and can no longer offer services.`
      )
    ) {
      return;
    }
    setDemotingBarberId(barber.barberRecordId);
    try {
      await barberService.removeBarber(barber.barberRecordId);
      toast.success('Operator demoted to consumer');
      setSelectedBarber(null);
      setBarberBookings([]);
      setSelectedBookingId(null);
      setSelectedBookingMessages([]);
      await reloadBarberList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to demote operator';
      toast.error(msg);
    } finally {
      setDemotingBarberId(null);
    }
  };

  const syncCommissionFormFromBarber = (barber: Barber) => {
    setCommissionFreeRemainingInput(String(barber.commissionFreeBookingsRemaining ?? 5));
    setKickbackPercentInput(String(barber.kickbackPercent ?? 0));
  };

  const handleSaveBarberCommission = async () => {
    if (!selectedBarber?.barberRecordId) {
      toast.error('Missing provider profile id');
      return;
    }

    const freeRemaining = parseInt(commissionFreeRemainingInput.trim(), 10);
    if (!Number.isInteger(freeRemaining) || freeRemaining < 0) {
      toast.error('Commission-free bookings must be a whole number ≥ 0');
      return;
    }

    const kickbackPercent = parseFloat(kickbackPercentInput.trim());
    if (!Number.isFinite(kickbackPercent) || kickbackPercent < 0 || kickbackPercent > 100) {
      toast.error('Kickback percent must be between 0 and 100');
      return;
    }

    setIsSavingCommission(true);
    try {
      const data = await api.put<{
        commissionFreeBookingsRemaining: number;
        kickbackPercent: number;
      }>(`/admin/barbers/${selectedBarber.barberRecordId}/commission`, {
        commissionFreeBookingsRemaining: freeRemaining,
        kickbackPercent,
      });
      const updated = {
        ...selectedBarber,
        commissionFreeBookingsRemaining: data.commissionFreeBookingsRemaining ?? freeRemaining,
        kickbackPercent: data.kickbackPercent ?? kickbackPercent,
      };
      setSelectedBarber(updated);
      syncCommissionFormFromBarber(updated);
      toast.success('Payment settings saved');
      await reloadBarberList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to save payment settings';
      toast.error(msg);
    } finally {
      setIsSavingCommission(false);
    }
  };

  const onboardingApplyTargetCount =
    onboardingScope === 'all' ? onboardingStats.total : onboardingSelectedIds.size;

  const handleBulkOnboardingFieldSave = async (field: 'free' | 'kickback') => {
    if (field === 'free') {
      const freeRemaining = parseInt(onboardingFreeInput.trim(), 10);
      if (!Number.isInteger(freeRemaining) || freeRemaining < 0) {
        toast.error('Commission-free bookings must be a whole number ≥ 0');
        return;
      }
    } else {
      const kickbackPercent = parseFloat(onboardingKickbackInput.trim());
      if (!Number.isFinite(kickbackPercent) || kickbackPercent < 0 || kickbackPercent > 100) {
        toast.error('Kickback percent must be between 0 and 100');
        return;
      }
    }

    if (onboardingScope === 'selected') {
      if (onboardingSelectedIds.size === 0) {
        toast.error('Select at least one operator');
        return;
      }
      await executeBulkOnboardingSave(field);
      return;
    }

    setOnboardingBulkConfirmField(field);
  };

  const executeBulkOnboardingSave = async (field: 'free' | 'kickback') => {
    const body: {
      scope: 'all' | 'selected';
      barberRecordIds?: string[];
      commissionFreeBookingsRemaining?: number;
      kickbackPercent?: number;
    } = {
      scope: onboardingScope,
    };

    if (field === 'free') {
      body.commissionFreeBookingsRemaining = parseInt(onboardingFreeInput.trim(), 10);
    } else {
      body.kickbackPercent = parseFloat(onboardingKickbackInput.trim());
    }

    if (onboardingScope === 'selected') {
      body.barberRecordIds = Array.from(onboardingSelectedIds);
    }

    setIsSavingOnboardingBulk(true);
    try {
      const data = await api.put<{ updatedCount: number }>('/admin/barbers/commission/bulk', body);
      toast.success(
        `Updated ${data.updatedCount ?? 0} operator${(data.updatedCount ?? 0) === 1 ? '' : 's'}`
      );
      await reloadBarberList();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to apply onboarding settings';
      toast.error(msg);
    } finally {
      setIsSavingOnboardingBulk(false);
    }
  };

  const confirmBulkOnboardingSave = async () => {
    const field = onboardingBulkConfirmField;
    setOnboardingBulkConfirmField(null);
    if (!field) return;
    await executeBulkOnboardingSave(field);
  };

  const toggleOnboardingProvider = (barberRecordId: string) => {
    setOnboardingSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(barberRecordId)) next.delete(barberRecordId);
      else next.add(barberRecordId);
      return next;
    });
  };

  const applyBarberCommissionLocally = (
    barberRecordId: string,
    commissionFreeBookingsRemaining: number,
    kickbackPercent: number
  ) => {
    setBarbers((prev) =>
      prev.map((b) =>
        b.barberRecordId === barberRecordId
          ? { ...b, commissionFreeBookingsRemaining, kickbackPercent }
          : b
      )
    );
    setSelectedBarber((prev) =>
      prev && prev.barberRecordId === barberRecordId
        ? { ...prev, commissionFreeBookingsRemaining, kickbackPercent }
        : prev
    );
  };

  const handleOnboardingAdjust = async (
    barber: Barber,
    field: 'free' | 'kickback',
    delta: number
  ) => {
    if (!barber.barberRecordId) {
      toast.error('Missing provider profile id');
      return;
    }
    if (savingOnboardingBarberId || isSavingOnboardingBulk) return;

    const currentFree = barber.commissionFreeBookingsRemaining ?? 0;
    const currentKickback = barber.kickbackPercent ?? 0;
    const nextFree =
      field === 'free' ? Math.min(10000, Math.max(0, currentFree + delta)) : currentFree;
    const nextKickback =
      field === 'kickback'
        ? Math.min(100, Math.max(0, Math.round((currentKickback + delta) * 10) / 10))
        : currentKickback;

    if (nextFree === currentFree && nextKickback === currentKickback) return;

    setSavingOnboardingBarberId(barber.barberRecordId);
    try {
      const data = await api.put<{
        commissionFreeBookingsRemaining: number;
        kickbackPercent: number;
      }>(`/admin/barbers/${barber.barberRecordId}/commission`, {
        commissionFreeBookingsRemaining: nextFree,
        kickbackPercent: nextKickback,
      });
      applyBarberCommissionLocally(
        barber.barberRecordId,
        data.commissionFreeBookingsRemaining ?? nextFree,
        data.kickbackPercent ?? nextKickback
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to update settings';
      toast.error(msg);
    } finally {
      setSavingOnboardingBarberId(null);
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

  const noCampusScopeContent = (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <MapPin className="w-8 h-8 mb-2 text-gray-300" />
      <p className="text-sm font-medium text-gray-700">No campuses with barbers yet</p>
      <p className="text-xs text-gray-500 mt-1">Bookings and locations will appear once barbers are active.</p>
    </div>
  );
  
  // Handle barber card click - fetch their bookings
  const handleBarberClick = async (barber: Barber) => {
    setSelectedBarber(barber);
    syncCommissionFormFromBarber(barber);
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
  
  // Handle consumer click - fetch their bookings
  const handleConsumerClick = async (user: PlatformUser) => {
    setSelectedConsumer(user);
    setConsumerBookings([]);
    setIsLoadingConsumerBookings(true);
    
    try {
      const response = await api.get<{ bookings: ConsumerBooking[] }>(`/admin/users/${user.id}/bookings`);
      setConsumerBookings(response.bookings || []);
    } catch (error) {
      console.error('Failed to fetch consumer bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoadingConsumerBookings(false);
    }
  };
  
  // Go back from consumer detail view
  const handleBackToConsumers = () => {
    setSelectedConsumer(null);
    setConsumerBookings([]);
    setSelectedBookingId(null);
    setSelectedBookingMessages([]);
  };

  const handleUpdateUserRole = async (user: PlatformUser, role: 'ADMIN' | 'CONSUMER') => {
    if (user.id === currentAdminId) {
      toast.error('You cannot change your own role');
      return;
    }
    const confirmMsg =
      role === 'ADMIN'
        ? `Make ${user.first_name} ${user.last_name} a platform Admin?`
        : `Remove Admin access for ${user.first_name} ${user.last_name}? They will become a consumer again.`;
    if (!window.confirm(confirmMsg)) return;

    setIsUpdatingUserRole(true);
    try {
      await api.put(`/admin/users/${user.id}/role`, { role });
      const next = { ...user, role };
      setSelectedConsumer(next);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? next : u)));
      toast.success(role === 'ADMIN' ? 'User is now an Admin' : 'Admin access removed');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          'Failed to update role'
      );
    } finally {
      setIsUpdatingUserRole(false);
    }
  };
  
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = metrics.map(m => {
      // Parse date as UTC but display the UTC values directly (backend already converted to Pacific Time)
      const date = new Date(m.date);
      // Use UTC methods to avoid local timezone conversion since backend already did the conversion
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = String(date.getUTCFullYear()).slice(-2);
      
      // Daily / weekly buckets
      if (metricsPeriod === 'daily' || metricsPeriod === 'weekly') {
        return metricsPeriod === 'daily' ? `${month} ${day}` : `Wk ${month} ${day}`;
      }
      // Monthly / yearly
      return `${month} '${year}`;
    });
    
    const dataValues = metrics.map((m) => {
      if (metricsView === 'revenue') return m.revenue / 100;
      if (metricsView === 'bookings') return m.bookings;
      return m.users || 0;
    });
    
    const seriesLabel =
      metricsView === 'revenue' ? 'Revenue ($)' : metricsView === 'bookings' ? 'Bookings' : 'Sign-ups';
    
    return {
      labels,
      datasets: [
        {
          label: seriesLabel,
          data: dataValues,
          borderColor: '#708d81',
          backgroundColor: 'rgba(112, 141, 129, 0.15)',
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
            users: m.users || 0,
          });
        }
      }
    },
  }), [metrics, metricsView]);
  
  const periodSeriesValues = metrics.map((m) => {
    if (metricsView === 'revenue') return m.revenue;
    if (metricsView === 'bookings') return m.bookings;
    return m.users || 0;
  });
  const periodAverage =
    periodSeriesValues.length > 0
      ? periodSeriesValues.reduce((a, b) => a + b, 0) / periodSeriesValues.length
      : 0;
  const bestBucketValue =
    periodSeriesValues.length > 0 ? Math.max(...periodSeriesValues) : 0;
  const formatSeriesValue = (value: number) =>
    metricsView === 'revenue' ? formatCurrency(value) : String(Math.round(value));

  const handleDashboardRefresh = async () => {
    await onRefresh?.();
  };

  return (
    <div className="relative flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* Shared chrome: tabs */}
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2 border-b border-stone-200/80 bg-stone-50">
        {campusLoadError && (
          <p className="text-center text-xs text-red-600">{campusLoadError}</p>
        )}

        {/* Five-tab bar */}
        <nav className="grid grid-cols-5 gap-0.5 rounded-xl bg-stone-200/70 p-1">
          {(
            [
              { view: 'performance' as const, label: 'Performance', Icon: Activity },
              { view: 'barbers' as const, label: 'Operators', Icon: Briefcase },
              { view: 'users' as const, label: 'Users', Icon: Users },
              { view: 'services' as const, label: 'Services', Icon: Scissors },
              { view: 'moderation' as const, label: 'Safety', Icon: Shield },
            ] as const
          ).map(({ view, label, Icon }) => {
            const active = adminView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setAdminView(view);
                    if (view === 'services') setServicesPanelMounted(true);
                    if (view === 'users') setUsersPanelMounted(true);
                  });
                }}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-0.5 transition-colors ${
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <PullToRefresh
        scoped
        onRefresh={handleDashboardRefresh}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 space-y-4"
      >
      
      {/* Performance Chart & Summary */}
      {deferredAdminView === 'performance' && (
      <>
      {/* Global platform commission */}
      <div className="p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs font-medium text-gray-700 self-center">Platform commission</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-xs text-gray-600">Commission %</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={isLoadingPlatformFee || isSavingPlatformFee}
                value={platformFeeInput}
                onChange={(e) => setPlatformFeeInput(e.target.value)}
                className="mt-1 w-28 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={isLoadingPlatformFee || isSavingPlatformFee}
              onClick={() => void handleSavePlatformFee()}
            >
              {isSavingPlatformFee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Users</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
            {isLoadingPerformance || isLoadingUsers
              ? '…'
              : (performance?.totalBarbers ?? 0) + totalUsersCount}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Bookings</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
            {isLoadingPerformance ? '…' : performance?.totalBookings ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Operators</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">
            {isLoadingPerformance ? '…' : performance?.totalBarbers ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 space-y-3">
        <h3 className="text-center text-base font-semibold text-gray-900">Performance over time</h3>

        {/* Timeline */}
        <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
          {(
            [
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'monthly', label: 'Monthly' },
              { key: 'yearly', label: 'Yearly' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetricsPeriod(key)}
              className={`flex-1 px-1.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                metricsPeriod === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Series */}
        <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
          {(
            [
              { key: 'revenue', label: 'Revenue' },
              { key: 'bookings', label: 'Bookings' },
              { key: 'signups', label: 'Sign-ups' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetricsView(key)}
              className={`flex-1 px-1.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                metricsView === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        
        {/* Chart */}
        {isLoadingMetrics ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : metrics.length > 0 ? (
          <div 
            ref={chartContainerRef} 
            className="h-40 sm:h-48"
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

        {!hoveredDataPoint && metrics.length > 0 && (
          <p className="text-center text-xs text-gray-400">
            Press and drag on the chart to inspect a bucket.
          </p>
        )}
        {hoveredDataPoint && (
          <p className="text-center text-xs font-medium text-gray-600">
            {hoveredDataPoint.label}: {formatCurrency(hoveredDataPoint.revenue)} ·{' '}
            {hoveredDataPoint.bookings} bookings · {hoveredDataPoint.users} sign-ups
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">Period average</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatSeriesValue(periodAverage)}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
            <p className="text-[11px] text-gray-500">Best bucket</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatSeriesValue(bestBucketValue)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2 px-0.5">
          {selectedCampus ? 'Campus performance' : 'Aggregate performance'}
        </h3>
        
        {/* Performance Summary - Below chart */}
        {performance && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {/* Payment Methods - Card vs Cash (All Time) */}
            {(performance.cardCount > 0 || performance.cashCount > 0) && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-2">
                <p className="text-xs font-medium text-gray-700 mb-2">Payment Methods (All Time)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500">Card Volume</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.cardRevenue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Card Bookings</p>
                    <p className="text-sm font-semibold text-gray-900">{performance.cardCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Cash Volume</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.cashRevenue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Cash Bookings</p>
                    <p className="text-sm font-semibold text-gray-900">{performance.cashCount || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Revenue */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">Platform Revenue</p>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Gross ({platformFeePercent}%)</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.totalPlatformFees || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total Stripe</p>
                  <p className="text-sm font-semibold text-red-600">-{formatCurrency(performance.estimatedStripeFees || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Net Revenue</p>
                  <p className="text-sm font-semibold text-green-600">{formatCurrency(performance.netPlatformRevenue || 0)}</p>
                </div>
              </div>
              
              {/* Stripe Fee Breakdown */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-[10px] font-medium text-gray-600 mb-2">Stripe Fee Breakdown</p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Processing (2.9% + $0.30/txn)</span>
                    <span className="text-gray-700">-{formatCurrency(performance.stripeProcessingFees || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Active Accounts ({performance.activeConnectAccounts || 0} × $2)</span>
                    <span className="text-gray-700">-{formatCurrency(performance.activeAccountBilling || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Volume Billing (0.25%)</span>
                    <span className="text-gray-700">-{formatCurrency(performance.volumeBilling || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payouts ({performance.estimatedPayouts || 0} × $0.25 + 0.25%)</span>
                    <span className="text-gray-700">-{formatCurrency(performance.payoutFees || 0)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200 font-medium">
                    <span className="text-gray-600">Connect Fees Total</span>
                    <span className="text-red-600">-{formatCurrency(performance.stripeConnectFees || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AWS Costs - Only show for platform-wide view */}
            {!selectedCampus && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">AWS Infrastructure (Est. Monthly)</p>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Fixed</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.awsFixedCosts || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Variable</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.awsVariableCosts || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total</p>
                  <p className="text-sm font-semibold text-orange-600">{formatCurrency(performance.awsTotalCost || 0)}</p>
                </div>
              </div>
              
              {/* AWS Cost Breakdown */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-[10px] font-medium text-gray-600 mb-2">AWS Breakdown</p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">EC2 (Server)</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsEc2Cost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VPC (Networking)</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsVpcCost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Route 53 (DNS)</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsRoute53Cost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data Transfer</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsDataTransferCost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">S3 Storage</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsS3StorageCost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">S3 Requests</span>
                    <span className="text-gray-700">{formatCurrency(performance.awsS3RequestsCost || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Platform Profit Summary - Only show for platform-wide view */}
            {!selectedCampus && (
            <div className={`p-3 rounded-lg border-2 ${
              (performance.netPlatformRevenue - performance.awsTotalCost) >= 0 
                ? 'bg-primary-50 border-gray-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <p className="text-xs font-medium text-gray-700 mb-2">Platform Profit Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Platform Fees ({platformFeePercent}%)</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(performance.totalPlatformFees || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">− Stripe Fees</span>
                  <span className="text-red-600 font-medium">-{formatCurrency(performance.estimatedStripeFees || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1">
                  <span className="text-gray-600">= Net Platform Revenue</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(performance.netPlatformRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">− AWS Infrastructure</span>
                  <span className="text-orange-600 font-medium">-{formatCurrency(performance.awsTotalCost || 0)}</span>
                </div>
                <div className={`flex justify-between border-t-2 pt-2 ${
                  (performance.netPlatformRevenue - performance.awsTotalCost) >= 0 
                    ? 'border-gray-400' 
                    : 'border-red-400'
                }`}>
                  <span className="font-bold text-gray-900">= Platform Profit</span>
                  <span className={`font-bold text-lg ${
                    (performance.netPlatformRevenue - performance.awsTotalCost) >= 0 
                      ? 'text-primary-600' 
                      : 'text-red-600'
                  }`}>
                    {formatCurrency((performance.netPlatformRevenue || 0) - (performance.awsTotalCost || 0))}
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Campus Revenue Summary - Only show for campus-specific view */}
            {selectedCampus && (
            <div className={`p-3 rounded-lg border-2 ${
              (performance.netPlatformRevenue || 0) >= 0 
                ? 'bg-primary-50 border-gray-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <p className="text-xs font-medium text-gray-700 mb-2">Campus Revenue Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Revenue ({platformFeePercent}% of {formatCampusName(selectedCampus.name)})</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(performance.totalPlatformFees || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">− Stripe Fees</span>
                  <span className="text-red-600 font-medium">-{formatCurrency(performance.estimatedStripeFees || 0)}</span>
                </div>
                <div className={`flex justify-between border-t-2 pt-2 ${
                  (performance.netPlatformRevenue || 0) >= 0 
                    ? 'border-gray-400' 
                    : 'border-red-400'
                }`}>
                  <span className="font-bold text-gray-900">= Campus Net Revenue</span>
                  <span className={`font-bold text-lg ${
                    (performance.netPlatformRevenue || 0) >= 0 
                      ? 'text-primary-600' 
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(performance.netPlatformRevenue || 0)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 italic">
                Note: AWS infrastructure costs are shared across all campuses and shown in the platform-wide view.
              </p>
            </div>
            )}

            {/* Averages */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">Averages</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-500">Per Cut</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(performance.averageCostPerAppointment)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">
                    Cuts/{metricsPeriod === 'daily' ? 'Day' : metricsPeriod === 'weekly' ? 'Wk' : 'Mo'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {metricsPeriod === 'daily'
                      ? performance.averageBookingsPerDay.toFixed(1)
                      : metricsPeriod === 'weekly'
                      ? performance.averageBookingsPerWeek.toFixed(1)
                      : performance.averageBookingsPerMonth.toFixed(1)
                    }
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">
                    Rev/{metricsPeriod === 'daily' ? 'Day' : metricsPeriod === 'weekly' ? 'Wk' : 'Mo'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {metricsPeriod === 'daily'
                      ? formatCurrency(performance.averageRevenuePerDay)
                      : metricsPeriod === 'weekly'
                      ? formatCurrency(performance.averageRevenuePerWeek)
                      : formatCurrency(performance.averageRevenuePerMonth)
                    }
                  </p>
                </div>
              </div>
              {/* Second row of averages */}
              <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t border-gray-200">
                <div>
                  <p className="text-[10px] text-gray-500">Avg Star Rating</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Completion</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {performance.completedBookings + performance.cancelledBookings > 0
                      ? `${Math.round((performance.completedBookings / (performance.completedBookings + performance.cancelledBookings)) * 100)}%`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Avg Tip</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {performance.completedTransactionCount > 0
                      ? formatCurrency(Math.round(performance.totalTips / performance.completedTransactionCount))
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
      
      {/* Barber Management → Operators */}
      {deferredAdminView === 'barbers' && (
      <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 space-y-3">
        {selectedBarber ? (
          /* Barber Detail View */
          <div>
            {/* Back button and barber header */}
            <button 
              onClick={handleBackToBarbers}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-3 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to operators
            </button>
            
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedBarber.profileImageUrl ? (
                  <img src={selectedBarber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-500">{selectedBarber.firstName.charAt(0)}{selectedBarber.lastName.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
                  {selectedBarber.firstName} {selectedBarber.lastName}
                  {selectedBarber.isBanned ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                      Banned
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">{selectedBarber.email}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{barberLocationSubtitle(selectedBarber)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    demotingBarberId === selectedBarber.barberRecordId ||
                    banningUserId === selectedBarber.id ||
                    unbanningUserId === selectedBarber.id
                  }
                  onClick={() => handleDemoteBarber(selectedBarber)}
                >
                  {demotingBarberId === selectedBarber.barberRecordId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Demote to consumer'
                  )}
                </Button>
                {selectedBarber.isBanned ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unbanningUserId === selectedBarber.id}
                    onClick={() => handleUnbanBarber(selectedBarber)}
                  >
                    {unbanningUserId === selectedBarber.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Unban'
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-700 border-red-200 hover:bg-red-50"
                    disabled={banningUserId === selectedBarber.id}
                    onClick={() => handleBanBarber(selectedBarber)}
                  >
                    {banningUserId === selectedBarber.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Ban'
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Payment settings — global commission shown; free quota + kickback per operator */}
            <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Payment settings</h3>
                <span className="text-[10px] text-gray-500">
                  Platform commission {platformFeePercent}% · tips never commissioned
                </span>
              </div>
              <label className="block max-w-sm mb-3">
                <span className="text-xs text-gray-600">Platform commission % (all operators)</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    disabled={isLoadingPlatformFee || isSavingPlatformFee}
                    value={platformFeeInput}
                    onChange={(e) => setPlatformFeeInput(e.target.value)}
                    className="w-28 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isLoadingPlatformFee || isSavingPlatformFee}
                    onClick={() => void handleSavePlatformFee()}
                  >
                    {isSavingPlatformFee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save %'}
                  </Button>
                </div>
              </label>
              <label className="block max-w-sm">
                <span className="text-xs text-gray-600">Commission-free bookings remaining</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={commissionFreeRemainingInput}
                  onChange={(e) => setCommissionFreeRemainingInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <span className="mt-0.5 block text-[10px] text-gray-500">
                  Next N card bookings take $0 platform fee (default 5 for every provider), then {platformFeePercent}% applies
                </span>
              </label>
              <label className="mt-3 block max-w-sm">
                <span className="text-xs text-gray-600">Provider kickback %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={kickbackPercentInput}
                  onChange={(e) => setKickbackPercentInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <span className="mt-0.5 block text-[10px] text-gray-500">
                  Only on commissionless bookings: platform pays this % of service (not tip) from its
                  Stripe balance to the provider. Example: $25 cut + 10% = +$2.50 ($27.50 total). Not
                  applied when the normal {platformFeePercent}% commission is charged.
                </span>
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingCommission}
                  onClick={() => void handleSaveBarberCommission()}
                >
                  {isSavingCommission ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save payment settings'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingCommission}
                  onClick={() => setCommissionFreeRemainingInput('5')}
                >
                  Set 5 free
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingCommission}
                  onClick={() => setKickbackPercentInput('10')}
                >
                  Set 10% kickback
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingCommission}
                  onClick={() => {
                    setCommissionFreeRemainingInput('5');
                    setKickbackPercentInput('0');
                  }}
                >
                  Reset to default
                </Button>
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
                        {(booking.status === 'COMPLETED' || booking.status === 'PAID') && booking.payment_method && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-900 text-white">
                            {booking.payment_method === 'card' ? 'Card' : 'Cash'}
                          </span>
                        )}
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
                                    ['BARBER', 'ADMIN'].includes(msg.sender_role) 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {['BARBER', 'ADMIN'].includes(msg.sender_role) ? 'Barber' : 'Customer'}
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
        ) : (
          <>
            <nav className="flex justify-center gap-1 rounded-xl bg-stone-100 p-1 mb-1">
              <button
                type="button"
                onClick={() => setOperatorsHubTab('operators')}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  operatorsHubTab === 'operators'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Operators
              </button>
              <button
                type="button"
                onClick={() => setOperatorsHubTab('onboarding')}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  operatorsHubTab === 'onboarding'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Onboarding
              </button>
            </nav>

            {operatorsHubTab === 'onboarding' ? (
              <div className="space-y-3 pt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search for Operators..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    value={onboardingSearchQuery}
                    onChange={(e) => setOnboardingSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOnboardingFilters(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      onboardingFiltersActive
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {onboardingFiltersActive && (
                      <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                </div>

                {/* Compact mass apply */}
                <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2.5">
                  <div className="flex justify-center">
                    <nav className="flex gap-1 rounded-lg bg-stone-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setOnboardingScope('all')}
                        className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
                          onboardingScope === 'all'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All Operators ({onboardingStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnboardingScope('selected')}
                        className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-all ${
                          onboardingScope === 'selected'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Select Operators
                        {onboardingSelectedIds.size > 0 ? ` (${onboardingSelectedIds.size})` : ''}
                      </button>
                    </nav>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 whitespace-nowrap">
                          Commissionless Bookings:
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={onboardingFreeInput}
                          onChange={(e) => setOnboardingFreeInput(e.target.value)}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm tabular-nums"
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          isSavingOnboardingBulk ||
                          (onboardingScope === 'selected' && onboardingSelectedIds.size === 0)
                        }
                        onClick={() => void handleBulkOnboardingFieldSave('free')}
                      >
                        {isSavingOnboardingBulk ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : onboardingScope === 'all' ? (
                          'Add to All'
                        ) : (
                          `Add to ${onboardingApplyTargetCount}`
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 whitespace-nowrap">
                          Kickback % Per Booking:
                        </span>
                        <span className="relative inline-flex">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={onboardingKickbackInput}
                            onChange={(e) => setOnboardingKickbackInput(e.target.value)}
                            className="w-20 rounded-md border border-gray-300 py-1.5 pl-2 pr-6 text-sm tabular-nums"
                          />
                          <span
                            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm tabular-nums text-gray-700"
                            aria-hidden
                          >
                            %
                          </span>
                        </span>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          isSavingOnboardingBulk ||
                          (onboardingScope === 'selected' && onboardingSelectedIds.size === 0)
                        }
                        onClick={() => void handleBulkOnboardingFieldSave('kickback')}
                      >
                        {isSavingOnboardingBulk ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : onboardingScope === 'all' ? (
                          'Apply to All'
                        ) : (
                          `Apply to ${onboardingApplyTargetCount}`
                        )}
                      </Button>
                    </div>
                  </div>

                  {onboardingScope === 'selected' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-500">Check operators below</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] font-medium text-gray-700 hover:text-gray-900"
                          onClick={() =>
                            setOnboardingSelectedIds(
                              new Set(
                                filteredOnboardingOperators
                                  .map((b) => b.barberRecordId)
                                  .filter((id): id is string => Boolean(id))
                              )
                            )
                          }
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-gray-700 hover:text-gray-900"
                          onClick={() => setOnboardingSelectedIds(new Set())}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Operators</h3>
                  <span className="text-xs text-gray-500">
                    {isLoadingBarbers
                      ? 'Loading…'
                      : `${filteredOnboardingOperators.length}${
                          onboardingFiltersActive || onboardingSearchQuery.trim()
                            ? ` of ${onboardingStats.total}`
                            : ''
                        }`}
                  </span>
                </div>

                {isLoadingBarbers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredOnboardingOperators.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <Scissors className="w-8 h-8 mb-2" />
                        <p className="text-sm">No operators match these filters</p>
                      </div>
                    ) : (
                      filteredOnboardingOperators.map((barber) => {
                        const id = barber.barberRecordId!;
                        const selected = onboardingSelectedIds.has(id);
                        const busy = savingOnboardingBarberId === id;
                        const free = barber.commissionFreeBookingsRemaining ?? 0;
                        const kickback = barber.kickbackPercent ?? 0;
                        return (
                          <div
                            key={id}
                            className={`rounded-lg border p-2.5 ${
                              onboardingScope === 'selected' && selected
                                ? 'border-gray-900 bg-gray-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {onboardingScope === 'selected' && (
                                <button
                                  type="button"
                                  onClick={() => toggleOnboardingProvider(id)}
                                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    selected
                                      ? 'border-gray-900 bg-gray-900 text-white'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                  aria-label={selected ? 'Deselect operator' : 'Select operator'}
                                >
                                  {selected ? <Check className="h-3 w-3" /> : null}
                                </button>
                              )}
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {barber.profileImageUrl ? (
                                  <img
                                    src={barber.profileImageUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-gray-500">
                                    {barber.firstName.charAt(0)}
                                    {barber.lastName.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">
                                  {barber.firstName} {barber.lastName}
                                  {stripeStatusBadge(barber)}
                                  {busy && (
                                    <Loader2 className="w-3 h-3 animate-spin text-gray-400 shrink-0" />
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {barberLocationSubtitle(barber)}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    Commissionless
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy || free <= 0}
                                    onClick={() => void handleOnboardingAdjust(barber, 'free', -1)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    aria-label="Decrease commissionless slots"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums text-gray-900">
                                    {free}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleOnboardingAdjust(barber, 'free', 1)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    aria-label="Increase commissionless slots"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    Kickback %
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy || kickback <= 0}
                                    onClick={() =>
                                      void handleOnboardingAdjust(barber, 'kickback', -1)
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    aria-label="Decrease kickback"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-gray-900">
                                    {kickback}%
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy || kickback >= 100}
                                    onClick={() =>
                                      void handleOnboardingAdjust(barber, 'kickback', 1)
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    aria-label="Increase kickback"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
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
                placeholder="Search for Operators..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={allBarberSearchQuery}
                onChange={(e) => setAllBarberSearchQuery(e.target.value)}
              />
            </div>
            

            {/* Current | Applications */}
            <nav className="flex justify-center gap-1 rounded-xl bg-stone-100 p-1 mb-3">
              <button
                onClick={() => { setBarberViewTab('barbers'); setSelectedApplication(null); }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  barberViewTab === 'barbers'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Current ({filteredAllBarbers.length})
              </button>
              <button
                onClick={() => { setBarberViewTab('applications'); setSelectedApplication(null); }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  barberViewTab === 'applications'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Applications ({applications.length})
              </button>
            </nav>
            
            {/* Filters — opens medium sheet */}
            {barberViewTab === 'barbers' && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowBarberFilters(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    barberVisibilityFilter !== 'visible' ||
                    activeBarberStripeFilter !== 'all' ||
                    barberLocationFilter !== 'all'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {(barberVisibilityFilter !== 'visible' ||
                    activeBarberStripeFilter !== 'all' ||
                    barberLocationFilter !== 'all') && (
                    <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">
                {barberViewTab === 'barbers' ? (barberVisibilityFilter === 'visible' ? 'Visible operators' : 'Hidden operators') : 'Applications'}
              </h3>
              <span className="text-xs text-gray-500">
                {barberViewTab === 'applications' ? `${applications.length} applications` : `${filteredAllBarbers.length} operators`}
              </span>
            </div>
            
            {isLoadingBarbers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {/* Visible Barbers (within Barbers tab) */}
                {barberViewTab === 'barbers' && barberVisibilityFilter === 'visible' && (() => {
                  const activeBarbers = filteredAllBarbers.filter(b => b.isActive);
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
                            <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">
                              {barber.firstName} {barber.lastName}
                              {barber.isBanned ? (
                                <span className="text-[10px] font-medium text-red-800 bg-red-100 px-1.5 py-0.5 rounded shrink-0">Banned</span>
                              ) : null}
                              {stripeStatusBadge(barber)}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-1">
                            <p className="text-[10px] text-gray-500">{barber.completedBookings ?? 0} {(barber.completedBookings ?? 0) === 1 ? 'cut' : 'cuts'} · {formatCurrency(barber.totalVolumeCents ?? 0)}</p>
                            <p className="text-[10px] text-gray-400">{barberLocationSubtitle(barber)}</p>
                          </div>
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
                
                {/* Hidden Barbers (within Barbers tab) */}
                {barberViewTab === 'barbers' && barberVisibilityFilter === 'hidden' && (
                  filteredAllBarbers.filter(b => !b.isActive).length > 0 ? (
                    filteredAllBarbers.filter(b => !b.isActive).map(barber => (
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
                            <p className="font-medium text-gray-600 text-sm flex items-center gap-1.5 truncate">
                              {barber.firstName} {barber.lastName}
                              {barber.isBanned ? (
                                <span className="text-[10px] font-medium text-red-800 bg-red-100 px-1.5 py-0.5 rounded shrink-0">Banned</span>
                              ) : null}
                              {stripeStatusBadge(barber)}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{barber.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-1">
                            <p className="text-[10px] text-gray-400">{barber.completedBookings ?? 0} {(barber.completedBookings ?? 0) === 1 ? 'cut' : 'cuts'} · {formatCurrency(barber.totalVolumeCents ?? 0)}</p>
                            <p className="text-[10px] text-gray-400">{barberLocationSubtitle(barber)}</p>
                          </div>
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
                
                {/* Applications Tab */}
                {barberViewTab === 'applications' && (
                  isLoadingApplications ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                    </div>
                  ) : selectedApplication ? (
                    // Detailed Application View
                    <div className="space-y-4">
                      <button
                        onClick={() => setSelectedApplication(null)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back to Applications</span>
                      </button>
                      
                      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                              <Users className="w-7 h-7 text-primary-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">
                                {selectedApplication.first_name || selectedApplication.user?.first_name || 'Unknown'} {selectedApplication.last_name || selectedApplication.user?.last_name || 'User'}
                              </h3>
                              <p className="text-gray-600">{selectedApplication.email || selectedApplication.user?.email || 'No email'}</p>
                              <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full ${
                                selectedApplication.status === 'pending' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : selectedApplication.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}>
                                {selectedApplication.status === 'pending' ? 'Pending' : selectedApplication.status === 'approved' ? 'Approved' : selectedApplication.status}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowContactModal(selectedApplication); }}
                            className="hidden sm:flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors flex-shrink-0"
                          >
                            Schedule Interview
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowContactModal(selectedApplication); }}
                          className="sm:hidden flex items-center justify-center w-full mt-4 px-4 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors"
                        >
                          Schedule Interview
                        </button>
                      </div>

                      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                        <h4 className="font-semibold text-gray-900 mb-4">Application Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Campus</p>
                            <p className="font-semibold text-gray-900">{selectedApplication.campus_name || 'Unknown'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Experience</p>
                            <p className="font-semibold text-gray-900">{selectedApplication.years_experience || 'Not specified'} years</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Barber license</p>
                            <p className="font-semibold text-gray-900">
                              {selectedApplication.has_license
                                ? selectedApplication.license_number
                                  ? `Yes: #${selectedApplication.license_number}`
                                  : 'Yes (number not provided)'
                                : 'Not declared'}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                            <p className="font-semibold text-gray-900">{selectedApplication.phone_number || 'Not provided'}</p>
                            {selectedApplication.phone_number && (
                              <div className="flex gap-2 mt-2">
                                <a href={`tel:${selectedApplication.phone_number}`} className="text-xs text-gray-900 hover:underline">Call</a>
                                <a href={`sms:${selectedApplication.phone_number}`} className="text-xs text-gray-900 hover:underline">Text</a>
                              </div>
                            )}
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Available Hours</p>
                            <p className="font-semibold text-gray-900">{selectedApplication.available_hours || 'Not specified'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Has Own Tools</p>
                            <p className="font-semibold text-gray-900">{selectedApplication.has_own_tools ? 'Yes' : 'No'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Applied On</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(selectedApplication.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        {selectedApplication.specialties && selectedApplication.specialties.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 mb-2">Specialties</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedApplication.specialties.map((specialty, idx) => (
                                <span key={idx} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                                  {specialty}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedApplication.why_be_barber && (
                          <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100">
                            <p className="text-xs text-primary-600 font-semibold mb-2 uppercase tracking-wide">Why They Want to Join</p>
                            <p className="text-gray-700 italic">"{selectedApplication.why_be_barber}"</p>
                          </div>
                        )}
                      </div>

                      {selectedApplication.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={() => {
                              requestApplicationAction(selectedApplication, 'approve');
                            }}
                            disabled={applicationActionLoading === selectedApplication.id}
                            className="flex-1 py-3 justify-center"
                          >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Approve Application
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              requestApplicationAction(selectedApplication, 'reject');
                            }}
                            disabled={applicationActionLoading === selectedApplication.id}
                            className="flex-1 py-3 justify-center text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <XCircle className="w-5 h-5 mr-2" />
                            Reject Application
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : applications.length > 0 ? (
                    applications.map(app => (
                      <div
                        key={app.id}
                        onClick={() => setSelectedApplication(app)}
                        className="p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {app.first_name || app.user?.first_name || 'Unknown'} {app.last_name || app.user?.last_name || 'User'}
                              </p>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                app.status === 'pending' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {app.status === 'pending' ? 'Pending' : 'Approved (Awaiting Signup)'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{app.email || app.user?.email || 'No email'}</p>
                            <p className="text-xs text-gray-400 truncate">{app.campus_name || 'Unknown campus'}</p>
                            {app.years_experience !== undefined && (
                              <p className="text-xs text-gray-600 mt-1">{app.years_experience} years experience</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {app.status === 'pending' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); requestApplicationAction(app, 'approve'); }}
                                  disabled={applicationActionLoading === app.id}
                                  className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  {applicationActionLoading === app.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); requestApplicationAction(app, 'reject'); }}
                                  disabled={applicationActionLoading === app.id}
                                  className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <p className="text-sm">No incoming barber applications yet</p>
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
            
            {/* Current | Applications */}
            <nav className="flex justify-center gap-1 rounded-xl bg-stone-100 p-1 mb-3">
              <button
                onClick={() => { setBarberViewTab('barbers'); setSelectedApplication(null); }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  barberViewTab === 'barbers'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Current ({filteredBarbers.length})
              </button>
              <button
                onClick={() => { setBarberViewTab('applications'); setSelectedApplication(null); }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  barberViewTab === 'applications'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Applications ({applications.length})
              </button>
            </nav>
            
            {barberViewTab === 'barbers' && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowBarberFilters(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    barberVisibilityFilter !== 'visible' ||
                    activeBarberStripeFilter !== 'all'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {(barberVisibilityFilter !== 'visible' || activeBarberStripeFilter !== 'all') && (
                    <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              </div>
            )}
            
            {barberViewTab === 'barbers' && (
              <>
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={barberSearchQuery}
                    onChange={(e) => setBarberSearchQuery(e.target.value)}
                    placeholder="Search for Operators..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
            
            {isLoadingBarbers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : filteredBarbers.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {/* Barbers Tab - Visible */}
                {barberViewTab === 'barbers' && barberVisibilityFilter === 'visible' && (() => {
                  const visibleBarbers = filteredBarbers.filter(b => b.isActive);
                  const stripeFilteredBarbers = activeBarberStripeFilter === 'all' 
                    ? visibleBarbers
                    : activeBarberStripeFilter === 'setup'
                    ? visibleBarbers.filter(b => b.hasStripeSetup)
                    : visibleBarbers.filter(b => !b.hasStripeSetup);
                  
                  return stripeFilteredBarbers.length > 0 ? (
                    <div className="space-y-2">
                      {stripeFilteredBarbers.map(barber => (
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
                                <span className="text-xs font-bold text-gray-500">
                                  {barber.firstName.charAt(0)}{barber.lastName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm flex items-center gap-1.5 truncate">
                                {barber.firstName} {barber.lastName}
                                {barber.isBanned ? (
                                  <span className="text-[10px] font-medium text-red-800 bg-red-100 px-1.5 py-0.5 rounded shrink-0">Banned</span>
                                ) : null}
                                {stripeStatusBadge(barber)}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{barber.email}</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <Users className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-sm">No barbers match this filter</p>
                    </div>
                  );
                })()}
                
                {/* Barbers Tab - Hidden */}
                {barberViewTab === 'barbers' && barberVisibilityFilter === 'hidden' && (() => {
                  const hiddenBarbers = filteredBarbers.filter(b => !b.isActive);
                  
                  return hiddenBarbers.length > 0 ? (
                    <div className="space-y-2">
                      {hiddenBarbers.map(barber => (
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
                                {barber.isBanned ? (
                                  <span className="text-[10px] font-medium text-red-800 bg-red-100 px-1.5 py-0.5 rounded shrink-0">Banned</span>
                                ) : null}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{barber.email}</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <Users className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-sm">No hidden barbers</p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Users className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm">No barbers found</p>
                {selectedCampusId ? (
                  <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
                    No operators with a public location near this campus. Operators appear here when their service pin is within ~5 miles.
                  </p>
                ) : null}
              </div>
            )}
              </>
            )}
            
            {/* Applications Tab Content */}
            {barberViewTab === 'applications' && (
              isLoadingApplications ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                </div>
              ) : selectedApplication ? (
                // Detailed Application View (Campus-specific)
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedApplication(null)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back to Applications</span>
                  </button>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                          <Users className="w-7 h-7 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {selectedApplication.first_name || selectedApplication.user?.first_name || 'Unknown'} {selectedApplication.last_name || selectedApplication.user?.last_name || 'User'}
                          </h3>
                          <p className="text-gray-600">{selectedApplication.email || selectedApplication.user?.email || 'No email'}</p>
                          <span className={`inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full ${
                            selectedApplication.status === 'pending' 
                              ? 'bg-amber-100 text-amber-700' 
                              : selectedApplication.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}>
                            {selectedApplication.status === 'pending' ? 'Pending' : selectedApplication.status === 'approved' ? 'Approved' : selectedApplication.status}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowContactModal(selectedApplication); }}
                        className="hidden sm:flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors flex-shrink-0"
                      >
                        Schedule Interview
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowContactModal(selectedApplication); }}
                      className="sm:hidden flex items-center justify-center w-full mt-4 px-4 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors"
                    >
                      Schedule Interview
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Application Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Experience</p>
                        <p className="font-semibold text-gray-900">{selectedApplication.years_experience || 'Not specified'} years</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Barber license</p>
                        <p className="font-semibold text-gray-900">
                          {selectedApplication.has_license
                            ? selectedApplication.license_number
                              ? `Yes: #${selectedApplication.license_number}`
                              : 'Yes (number not provided)'
                            : 'Not declared'}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                        <p className="font-semibold text-gray-900">{selectedApplication.phone_number || 'Not provided'}</p>
                        {selectedApplication.phone_number && (
                          <div className="flex gap-2 mt-2">
                            <a href={`tel:${selectedApplication.phone_number}`} className="text-xs text-gray-900 hover:underline">Call</a>
                            <a href={`sms:${selectedApplication.phone_number}`} className="text-xs text-gray-900 hover:underline">Text</a>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Available Hours</p>
                        <p className="font-semibold text-gray-900">{selectedApplication.available_hours || 'Not specified'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Has Own Tools</p>
                        <p className="font-semibold text-gray-900">{selectedApplication.has_own_tools ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Applied On</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(selectedApplication.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {selectedApplication.specialties && selectedApplication.specialties.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-500 mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedApplication.specialties.map((specialty, idx) => (
                            <span key={idx} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedApplication.why_be_barber && (
                      <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100">
                        <p className="text-xs text-primary-600 font-semibold mb-2 uppercase tracking-wide">Why They Want to Join</p>
                        <p className="text-gray-700 italic">"{selectedApplication.why_be_barber}"</p>
                      </div>
                    )}
                  </div>

                  {selectedApplication.status === 'pending' && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => {
                          requestApplicationAction(selectedApplication, 'approve');
                          setSelectedApplication(null);
                        }}
                        disabled={applicationActionLoading === selectedApplication.id}
                        className="flex-1 py-3 justify-center"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Approve Application
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          requestApplicationAction(selectedApplication, 'reject');
                          setSelectedApplication(null);
                        }}
                        disabled={applicationActionLoading === selectedApplication.id}
                        className="flex-1 py-3 justify-center text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="w-5 h-5 mr-2" />
                        Reject Application
                      </Button>
                    </div>
                  )}
                </div>
              ) : applications.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {applications.map(app => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApplication(app)}
                      className="p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {app.first_name || app.user?.first_name || 'Unknown'} {app.last_name || app.user?.last_name || 'User'}
                            </p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              app.status === 'pending' 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {app.status === 'pending' ? 'Pending' : 'Approved (Awaiting Signup)'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{app.email || app.user?.email || 'No email'}</p>
                          {app.years_experience !== undefined && (
                            <p className="text-xs text-gray-600 mt-1">{app.years_experience} years experience</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {app.status === 'pending' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); requestApplicationAction(app, 'approve'); }}
                                disabled={applicationActionLoading === app.id}
                                className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                {applicationActionLoading === app.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); requestApplicationAction(app, 'reject'); }}
                                disabled={applicationActionLoading === app.id}
                                className="p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <p className="text-sm">No incoming barber applications yet</p>
                </div>
              )
            )}

          </>
            )}
          </>
        )}
      </div>
      )}
      
      {(deferredAdminView === 'services' || servicesPanelMounted) && (
        <div
          className={deferredAdminView === 'services' ? undefined : 'hidden'}
          aria-hidden={deferredAdminView !== 'services'}
        >
          <ServicesManagementPanel />
        </div>
      )}
      
      {/* Users View */}
      {(deferredAdminView === 'users' || usersPanelMounted) && (
      <div
        className={deferredAdminView === 'users' ? undefined : 'hidden'}
        aria-hidden={deferredAdminView !== 'users'}
      >
        {selectedConsumer ? (
          // Consumer Detail View - show booking history
          <>
            <button
              onClick={handleBackToConsumers}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to users
            </button>
            
            {/* Consumer Header */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedConsumer.avatar_url ? (
                  <img src={selectedConsumer.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary-600">
                    {selectedConsumer.customer_number != null
                      ? `#${selectedConsumer.customer_number}`
                      : (selectedConsumer.first_name?.charAt(0) || 'U')}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedConsumer.first_name} {selectedConsumer.last_name}
                </h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 min-w-0">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{selectedConsumer.email}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedConsumer.role || 'CONSUMER'}
                  {selectedConsumer.campus_name ? ` · ${selectedConsumer.campus_name}` : ''}
                </p>
              </div>
              {['CONSUMER', 'ADMIN'].includes(
                String(selectedConsumer.role || 'CONSUMER').toUpperCase()
              ) && (
                String(selectedConsumer.role || '').toUpperCase() === 'ADMIN' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={isUpdatingUserRole || selectedConsumer.id === currentAdminId}
                    title={
                      selectedConsumer.id === currentAdminId
                        ? 'You cannot revoke your own Admin access'
                        : undefined
                    }
                    onClick={() => void handleUpdateUserRole(selectedConsumer, 'CONSUMER')}
                  >
                    {isUpdatingUserRole ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove Admin'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={isUpdatingUserRole || selectedConsumer.id === currentAdminId}
                    title={
                      selectedConsumer.id === currentAdminId
                        ? 'You cannot change your own role'
                        : undefined
                    }
                    onClick={() => void handleUpdateUserRole(selectedConsumer, 'ADMIN')}
                  >
                    {isUpdatingUserRole ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Make Admin'}
                  </Button>
                )
              )}
            </div>
            
            {/* Booking History */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Booking History</h3>
              <span className="text-xs text-gray-500">{consumerBookings.length} bookings</span>
            </div>
            
            {isLoadingConsumerBookings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : consumerBookings.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {consumerBookings.map(booking => (
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
                        {(booking.status === 'COMPLETED' || booking.status === 'PAID') && booking.payment_method && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-900 text-white">
                            {booking.payment_method === 'card' ? 'Card' : 'Cash'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(booking.scheduled_time).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {booking.barber_avatar ? (
                          <img src={booking.barber_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-500">
                            {booking.barber_first_name?.charAt(0) || 'B'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {booking.barber_first_name} {booking.barber_last_name}
                        </p>
                        <p className="text-xs text-gray-500">{booking.service_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          ${((booking.total_paid_cents || booking.price_cents || 0) / 100).toFixed(2)}
                        </p>
                        {booking.tip_cents > 0 && (
                          <p className="text-xs text-green-600">
                            +${(booking.tip_cents / 100).toFixed(2)} tip
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Review if exists */}
                    {booking.review_rating && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1 mb-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-3 h-3 ${i < booking.review_rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                            />
                          ))}
                        </div>
                        {booking.review_text && (
                          <p className="text-xs text-gray-600 italic">"{booking.review_text}"</p>
                        )}
                      </div>
                    )}
                    
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
                                    msg.sender_id === booking.barber_user_id
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {msg.sender_id === booking.barber_user_id ? 'Barber' : 'Customer'}
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
                          <p className="text-xs text-gray-400 italic">No messages in this booking</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Calendar className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm">No bookings yet</p>
              </div>
            )}
          </>
        ) : (
          // User List View
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">Users</h3>
              <span className="text-xs text-gray-500">
                {userRoleFilterActive || userSearchQuery.trim()
                  ? `${filteredUsers.length} shown`
                  : `${totalUsersCount} total`}
              </span>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setShowUserFilters(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  userRoleFilterActive
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {userRoleFilterActive && (
                  <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            </div>
            
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <div 
                    key={user.id}
                    onClick={() => handleConsumerClick(user)}
                    className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 w-full cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary-600">
                            {user.customer_number != null
                              ? `#${user.customer_number}`
                              : (user.first_name?.charAt(0) || 'U')}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {user.role || 'CONSUMER'}
                          {user.campus_name ? ` · ${user.campus_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                ))}
                {usersHasMore && !userSearchQuery.trim() && !userRoleFilterActive && (
                  <button
                    type="button"
                    onClick={() => void loadMoreUsers()}
                    disabled={isLoadingMoreUsers}
                    className="w-full py-2.5 text-sm font-semibold text-gray-700 border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50"
                  >
                    {isLoadingMoreUsers ? 'Loading…' : `Show next ${USERS_PAGE_SIZE}`}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Users className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {deferredAdminView === 'moderation' && (
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Reports</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Status</span>
              {(['open', 'all', 'dismissed', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setUgcReportStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    ugcReportStatusFilter === s
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {isLoadingUgcReports ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : ugcReportsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium">Could not load reports</p>
              <p className="mt-1 text-xs">{ugcReportsError}</p>
              <p className="mt-2 text-xs text-red-700">
                If this environment has not applied migration 028 yet, run the UGC safety migration on the database.
              </p>
            </div>
          ) : ugcReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-10 text-gray-500">
              <MessageSquare className="mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm">No reports for this filter</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
              {ugcReports.map((r) => {
                const isOpen = r.status === 'open';
                const busy = ugcResolveLoadingId === r.id;
                const reporterName = `${r.reporter_first_name || ''} ${r.reporter_last_name || ''}`.trim();
                const reportedName = `${r.reported_first_name || ''} ${r.reported_last_name || ''}`.trim();
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500">Reporter</p>
                        <p className="text-gray-900">{reporterName || r.reporter_email}</p>
                        <p className="truncate text-xs text-gray-500">{r.reporter_email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Reported user</p>
                        <p className="text-gray-900">{reportedName || r.reported_email}</p>
                        <p className="truncate text-xs text-gray-500">{r.reported_email}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <p className="text-xs font-medium text-gray-500">Reason</p>
                      <p className="text-gray-800">{r.reason}</p>
                      {r.detail ? (
                        <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{r.detail}</p>
                      ) : null}
                    </div>
                    {r.message_preview?.trim() ? (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                        <p className="mb-1 font-medium text-gray-500">Reported message</p>
                        <p className="whitespace-pre-wrap break-words">{r.message_preview}</p>
                        {r.message_is_deleted ? (
                          <p className="mt-2 text-[11px] text-amber-700">Message is already marked deleted.</p>
                        ) : null}
                      </div>
                    ) : null}
                    {r.status !== 'open' && r.resolution_notes ? (
                      <p className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">Notes:</span> {r.resolution_notes}
                      </p>
                    ) : null}
                    {isOpen ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleUgcResolve(r, 'dismiss')}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dismiss'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || !(r.moderation_target_message_id ?? r.message_id)}
                          onClick={() => handleUgcResolve(r, 'remove_message')}
                          title={
                            !(r.moderation_target_message_id ?? r.message_id)
                              ? 'No message from the reported user found in this conversation'
                              : undefined
                          }
                        >
                          Remove message
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleUgcResolve(r, 'ban_reported_user')}
                        >
                          Ban user
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleUgcResolve(r, 'remove_message_and_ban')}
                        >
                          Remove + ban
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          </section>

          <section className="space-y-3 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900">Banned users</h3>
            <p className="text-xs text-gray-500">
              Accounts with an active platform ban cannot sign in. Unban restores access. Categories are derived from
              role and barber profile (not a separate ban type field).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Show</span>
              {(
                [
                  ['all', 'All'],
                  ['service_provider', 'Providers'],
                  ['consumer', 'Consumers'],
                  ['admin', 'Admins'],
                  ['other', 'Other'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBannedCategoryFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    bannedCategoryFilter === key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isLoadingBannedUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : bannedUsersError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {bannedUsersError}
              </div>
            ) : bannedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-8 text-gray-500">
                <Users className="mb-2 h-9 w-9 text-gray-300" />
                <p className="text-sm">No banned users</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {bannedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                      </p>
                      <p className="truncate text-xs text-gray-500">{u.email}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        <span className="font-medium text-gray-600">
                          {u.account_category === 'service_provider'
                            ? 'Service provider'
                            : u.account_category === 'consumer'
                              ? 'Consumer'
                              : u.account_category === 'admin'
                                ? 'Admin'
                                : 'Other'}
                        </span>
                        <span className="font-mono"> · {u.role}</span>
                        {u.has_barber_profile && u.barber_is_active !== null ? (
                          <span> · Barber listing {u.barber_is_active ? 'active' : 'inactive'}</span>
                        ) : null}
                        {typeof u.open_report_count === 'number' && u.open_report_count > 0 ? (
                          <span className="text-amber-700"> · {u.open_report_count} open report(s)</span>
                        ) : null}
                        {u.campus_name ? <span> · {u.campus_name}</span> : null}
                        {u.updated_at ? (
                          <span className="block sm:inline sm:ml-1">
                            · Row updated {new Date(u.updated_at).toLocaleString()}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={unbanningUserId === u.id}
                      onClick={() => handleUnbanBannedUser(u)}
                    >
                      {unbanningUserId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Unban'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Application Action Confirmation Modal */}
      </PullToRefresh>

      {/* Operators filters sheet */}
      {showBarberFilters && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Dismiss filters"
            onClick={() => setShowBarberFilters(false)}
          />
          <div className="relative z-10 w-full sm:max-w-md max-h-[80%] rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden flex flex-col m-0 sm:m-4">
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
              <button
                type="button"
                onClick={() => setShowBarberFilters(false)}
                className="p-2 hover:bg-stone-100 rounded-full"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Visibility</p>
                <div className="flex rounded-lg bg-stone-100 p-1">
                  <button
                    type="button"
                    onClick={() => setBarberVisibilityFilter('visible')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      barberVisibilityFilter === 'visible' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    Visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarberVisibilityFilter('hidden')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${
                      barberVisibilityFilter === 'hidden' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    Hidden
                  </button>
                </div>
              </div>
              {barberVisibilityFilter === 'visible' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stripe</p>
                  <div className="flex rounded-lg bg-stone-100 p-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'setup', label: 'Setup' },
                        { id: 'not-setup', label: 'Not setup' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setActiveBarberStripeFilter(opt.id)}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md ${
                          activeBarberStripeFilter === opt.id
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!selectedCampusId && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</p>
                  <div className="flex flex-col gap-1 rounded-lg bg-stone-100 p-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'near-campus', label: 'Near campus' },
                        { id: 'unassigned', label: 'Unassigned' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBarberLocationFilter(opt.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md text-left ${
                          barberLocationFilter === opt.id
                            ? 'bg-white shadow-sm text-gray-900'
                            : 'text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button type="button" className="w-full" onClick={() => setShowBarberFilters(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding filters sheet */}
      {showOnboardingFilters && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Dismiss onboarding filters"
            onClick={() => setShowOnboardingFilters(false)}
          />
          <div className="relative z-10 w-full sm:max-w-md max-h-[80%] rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden flex flex-col m-0 sm:m-4">
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
              <button
                type="button"
                onClick={() => setShowOnboardingFilters(false)}
                className="p-2 hover:bg-stone-100 rounded-full"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stripe</p>
                <div className="flex rounded-lg bg-stone-100 p-1">
                  {(
                    [
                      { id: 'all', label: `All (${onboardingStats.total})` },
                      { id: 'ready', label: `Ready (${onboardingStats.stripeReady})` },
                      { id: 'not-ready', label: `Not ready (${onboardingStats.stripeNotReady})` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOnboardingStripeFilter(opt.id)}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md ${
                        onboardingStripeFilter === opt.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Public location
                </p>
                <div className="flex rounded-lg bg-stone-100 p-1">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'has-pin', label: `Set (${onboardingStats.withLocation})` },
                      { id: 'missing', label: `Missing (${onboardingStats.withoutLocation})` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOnboardingLocationFilter(opt.id)}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md ${
                        onboardingLocationFilter === opt.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Commission-free
                </p>
                <div className="flex flex-col gap-1 rounded-lg bg-stone-100 p-1">
                  {(
                    [
                      {
                        id: 'all',
                        label: `All · ${onboardingStats.totalFreeSlots} total free (avg ${onboardingStats.avgFreeSlots.toFixed(1)})`,
                      },
                      { id: 'with-free', label: `With free slots (${onboardingStats.withFree})` },
                      { id: 'at-zero', label: `At 0 (${onboardingStats.zeroFree})` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOnboardingFreeFilter(opt.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md text-left ${
                        onboardingFreeFilter === opt.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Kickback
                </p>
                <div className="flex flex-col gap-1 rounded-lg bg-stone-100 p-1">
                  {(
                    [
                      {
                        id: 'all',
                        label: `All · avg ${onboardingStats.avgKickbackPercent.toFixed(1)}%`,
                      },
                      {
                        id: 'with-kickback',
                        label: `With kickback (${onboardingStats.withKickback})`,
                      },
                      {
                        id: 'none',
                        label: `None (${Math.max(0, onboardingStats.total - onboardingStats.withKickback)})`,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOnboardingKickbackFilter(opt.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md text-left ${
                        onboardingKickbackFilter === opt.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOnboardingStripeFilter('all');
                  setOnboardingLocationFilter('all');
                  setOnboardingFreeFilter('all');
                  setOnboardingKickbackFilter('all');
                }}
              >
                Clear filters
              </Button>
              <Button type="button" className="w-full" onClick={() => setShowOnboardingFilters(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users role filters sheet */}
      {showUserFilters && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Dismiss user filters"
            onClick={() => setShowUserFilters(false)}
          />
          <div className="relative z-10 w-full sm:max-w-md max-h-[80%] rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden flex flex-col m-0 sm:m-4">
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200 shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
              <button
                type="button"
                onClick={() => setShowUserFilters(false)}
                className="p-2 hover:bg-stone-100 rounded-full"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</p>
                <div className="flex rounded-lg bg-stone-100 p-1">
                  {(
                    [
                      { id: 'all' as const, label: 'All' },
                      { id: 'consumer' as const, label: 'Consumer' },
                      { id: 'admin' as const, label: 'Admin' },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUserRoleFilter(opt.id)}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md ${
                        userRoleFilter === opt.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="button" className="w-full" onClick={() => setShowUserFilters(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingApplicationAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`px-6 py-4 ${pendingApplicationAction.action === 'approve' ? 'bg-primary-500' : 'bg-red-500'}`}>
              <h3 className="text-lg font-bold text-white">
                {pendingApplicationAction.action === 'approve' ? 'Approve Application' : 'Reject Application'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to <strong>{pendingApplicationAction.action}</strong> the application from{' '}
                <strong>
                  {pendingApplicationAction.app.first_name || pendingApplicationAction.app.user?.first_name || 'Unknown'}{' '}
                  {pendingApplicationAction.app.last_name || pendingApplicationAction.app.user?.last_name || 'User'}
                </strong>?
              </p>
              {pendingApplicationAction.action === 'approve' && (
                <p className="text-sm text-gray-500 mb-4">
                  This will grant them barber access and they will be able to set up their profile and receive bookings.
                </p>
              )}
              {pendingApplicationAction.action === 'reject' && (
                <p className="text-sm text-gray-500 mb-4">
                  This will reject their application. They will need to submit a new application if they want to apply again.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingApplicationAction(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApplicationAction}
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors ${
                    pendingApplicationAction.action === 'approve'
                      ? 'bg-brand-600 hover:bg-brand-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {pendingApplicationAction.action === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {onboardingBulkConfirmField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-lg font-semibold text-gray-900">Are you sure?</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">
                {onboardingBulkConfirmField === 'free'
                  ? `Set commissionless bookings to ${onboardingFreeInput} for all ${onboardingStats.total} operators?`
                  : `Set kickback to ${onboardingKickbackInput}% for all ${onboardingStats.total} operators?`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOnboardingBulkConfirmField(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => void confirmBulkOnboardingSave()}
                  className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal for Scheduling Interview */}
      {showContactModal && (
        <div className="fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 bg-black/50" onClick={() => { setShowContactModal(null); setCopiedField(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-primary-600 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Contact Applicant</h2>
              <button onClick={() => { setShowContactModal(null); setCopiedField(null); }} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-sm mb-4">
                Reach out to <span className="font-semibold">{showContactModal.first_name || showContactModal.user?.first_name}</span> to schedule an interview:
              </p>
              
              {/* Email */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="font-medium text-gray-900 truncate">{showContactModal.email || showContactModal.user?.email || 'No email'}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showContactModal.email || showContactModal.user?.email || '');
                      setCopiedField('email');
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className={`ml-3 p-2 rounded-lg transition-colors ${
                      copiedField === 'email' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                    title={copiedField === 'email' ? 'Copied!' : 'Copy to clipboard'}
                  >
                    {copiedField === 'email' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    <p className="font-medium text-gray-900 truncate">{showContactModal.phone_number || 'Not provided'}</p>
                  </div>
                  {showContactModal.phone_number && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(showContactModal.phone_number || '');
                        setCopiedField('phone');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className={`ml-3 p-2 rounded-lg transition-colors ${
                        copiedField === 'phone' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      }`}
                      title={copiedField === 'phone' ? 'Copied!' : 'Copy to clipboard'}
                    >
                      {copiedField === 'phone' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Use either contact method to reach out and schedule an interview to discuss their application.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

