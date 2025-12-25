/**
 * Admin Payments Page
 * 
 * Displays payment monitoring, Stripe integration status, and transaction management
 */

import { useState, useRef, useEffect } from 'react';
import { 
  CreditCard, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Check,
  X,
  Scissors
} from 'lucide-react';
import Card from '../../components/Card';
import AdminHeader from '../../components/AdminHeader';

interface Transaction {
  id: string;
  type: 'payment' | 'payout' | 'refund' | 'fee';
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  description: string;
  customer?: string;
  barber?: string;
  campus: string;
  timestamp: string;
  date: Date;
  stripeId?: string;
}

// Helper to create dates relative to now
const daysAgo = (days: number, hours: number = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date;
};

// Mock data with dates for filtering
const MOCK_TRANSACTIONS: Transaction[] = [
  // Today
  { id: 'pi_1N7abc123', type: 'payment', amount: 35.00, status: 'completed', description: 'Fade', customer: 'John D.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '2 min ago', date: daysAgo(0, 0), stripeId: 'pi_1N7abc123' },
  { id: 'po_2M8def456', type: 'payout', amount: 475.25, status: 'processing', description: 'Weekly payout', barber: 'Jordan W.', campus: 'Cal Poly SLO', timestamp: '15 min ago', date: daysAgo(0, 0), stripeId: 'po_2M8def456' },
  { id: 'pi_3L9ghi789', type: 'payment', amount: 45.00, status: 'completed', description: 'Haircut & Fade', customer: 'Mike S.', barber: 'Alex C.', campus: 'UCSB', timestamp: '32 min ago', date: daysAgo(0, 1), stripeId: 'pi_3L9ghi789' },
  { id: 'fee_4K0jkl012', type: 'fee', amount: 2.25, status: 'completed', description: 'Platform fee (5%)', barber: 'Alex C.', campus: 'UCSB', timestamp: '32 min ago', date: daysAgo(0, 1) },
  { id: 'rf_5J1mno345', type: 'refund', amount: 28.00, status: 'completed', description: 'Taper', customer: 'Sarah L.', barber: 'Tyler M.', campus: 'UCLA', timestamp: '1 hour ago', date: daysAgo(0, 1), stripeId: 'rf_5J1mno345' },
  { id: 'pi_6I2pqr678', type: 'payment', amount: 30.00, status: 'pending', description: 'Haircut', customer: 'Emily R.', barber: 'Carlos R.', campus: 'UCLA', timestamp: '1 hour ago', date: daysAgo(0, 1), stripeId: 'pi_6I2pqr678' },
  { id: 'pi_7H3stu901', type: 'payment', amount: 55.00, status: 'failed', description: 'Color Treatment', customer: 'David K.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '2 hours ago', date: daysAgo(0, 2), stripeId: 'pi_7H3stu901' },
  { id: 'pi_8G4vwx234', type: 'payment', amount: 40.00, status: 'completed', description: 'Women\'s Cut', customer: 'Tom H.', barber: 'Jordan W.', campus: 'Cal Poly SLO', timestamp: '3 hours ago', date: daysAgo(0, 3), stripeId: 'pi_8G4vwx234' },
  // Yesterday
  { id: 'pi_9F5yza567', type: 'payment', amount: 38.00, status: 'completed', description: 'Taper', customer: 'Chris M.', barber: 'Alex C.', campus: 'UCSB', timestamp: 'Yesterday', date: daysAgo(1, 2), stripeId: 'pi_9F5yza567' },
  { id: 'pi_10E6bcd890', type: 'payment', amount: 42.00, status: 'completed', description: 'Buzz Cut', customer: 'Jake P.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: 'Yesterday', date: daysAgo(1, 5), stripeId: 'pi_10E6bcd890' },
  // 3 days ago
  { id: 'pi_11D7efg123', type: 'payment', amount: 50.00, status: 'completed', description: 'Perm', customer: 'Ryan K.', barber: 'Tyler M.', campus: 'UCLA', timestamp: '3 days ago', date: daysAgo(3, 4), stripeId: 'pi_11D7efg123' },
  { id: 'rf_12C8hij456', type: 'refund', amount: 35.00, status: 'completed', description: 'Fade', customer: 'Lisa W.', barber: 'Carlos R.', campus: 'UCLA', timestamp: '3 days ago', date: daysAgo(3, 6), stripeId: 'rf_12C8hij456' },
  // 5 days ago
  { id: 'pi_13B9klm789', type: 'payment', amount: 28.00, status: 'completed', description: 'Haircut', customer: 'Anna B.', barber: 'Jordan W.', campus: 'Cal Poly SLO', timestamp: '5 days ago', date: daysAgo(5, 3), stripeId: 'pi_13B9klm789' },
  { id: 'po_14A0nop012', type: 'payout', amount: 320.50, status: 'completed', description: 'Weekly payout', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '5 days ago', date: daysAgo(5, 8), stripeId: 'po_14A0nop012' },
  // 10 days ago
  { id: 'pi_15Z1qrs345', type: 'payment', amount: 45.00, status: 'completed', description: 'Beard Trim', customer: 'Mark T.', barber: 'Alex C.', campus: 'UCSB', timestamp: '10 days ago', date: daysAgo(10, 2), stripeId: 'pi_15Z1qrs345' },
  { id: 'pi_16Y2tuv678', type: 'payment', amount: 32.00, status: 'completed', description: 'Line Up', customer: 'Paul R.', barber: 'Tyler M.', campus: 'UCLA', timestamp: '10 days ago', date: daysAgo(10, 5), stripeId: 'pi_16Y2tuv678' },
  // 15 days ago
  { id: 'pi_17X3wxy901', type: 'payment', amount: 55.00, status: 'completed', description: 'Design/Art', customer: 'Steve L.', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '15 days ago', date: daysAgo(15, 3), stripeId: 'pi_17X3wxy901' },
  { id: 'fee_18W4zab234', type: 'fee', amount: 2.75, status: 'completed', description: 'Platform fee (5%)', barber: 'Marcus T.', campus: 'Cal Poly SLO', timestamp: '15 days ago', date: daysAgo(15, 3) },
  // 25 days ago
  { id: 'pi_19V5cde567', type: 'payment', amount: 38.00, status: 'completed', description: 'Fade', customer: 'Kevin N.', barber: 'Jordan W.', campus: 'Cal Poly SLO', timestamp: '25 days ago', date: daysAgo(25, 4), stripeId: 'pi_19V5cde567' },
  { id: 'pi_20U6fgh890', type: 'payment', amount: 42.00, status: 'completed', description: 'Hot Shave', customer: 'Brian O.', barber: 'Carlos R.', campus: 'UCLA', timestamp: '25 days ago', date: daysAgo(25, 7), stripeId: 'pi_20U6fgh890' },
  // 45 days ago
  { id: 'pi_21T7ijk123', type: 'payment', amount: 35.00, status: 'completed', description: 'Haircut', customer: 'Dan Q.', barber: 'Alex C.', campus: 'UCSB', timestamp: '45 days ago', date: daysAgo(45, 2), stripeId: 'pi_21T7ijk123' },
  { id: 'po_22S8lmn456', type: 'payout', amount: 445.00, status: 'completed', description: 'Monthly payout', barber: 'Tyler M.', campus: 'UCLA', timestamp: '45 days ago', date: daysAgo(45, 6), stripeId: 'po_22S8lmn456' },
];

const TRANSACTIONS_PER_PAGE = 7;

// Available campuses for filtering
const CAMPUSES = ['All Campuses', 'Cal Poly SLO', 'UCSB', 'UCLA'];

// Time filter options
const TIME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

// Service type options (matches barber service offerings)
const SERVICE_OPTIONS = [
  { value: 'all', label: 'All Services' },
  { value: 'Buzz Cut', label: 'Buzz Cut' },
  { value: 'Line Up', label: 'Line Up' },
  { value: 'Beard Trim', label: 'Beard Trim' },
  { value: 'Haircut', label: 'Haircut' },
  { value: 'Taper', label: 'Taper' },
  { value: 'Hot Shave', label: 'Hot Shave' },
  { value: 'Fade', label: 'Fade' },
  { value: 'Haircut & Fade', label: 'Haircut & Fade' },
  { value: 'Design/Art', label: 'Design/Art' },
  { value: 'Women\'s Cut', label: 'Women\'s Cut' },
  { value: 'Perm', label: 'Perm' },
  { value: 'Color Treatment', label: 'Color Treatment' },
];

export default function AdminPaymentsPage() {
  const [transactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [campusFilter, setCampusFilter] = useState<string>('All Campuses');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [showServicePopup, setShowServicePopup] = useState(false);
  const [servicePopupVisible, setServicePopupVisible] = useState(false);
  const [showTimePopup, setShowTimePopup] = useState(false);
  const [timePopupVisible, setTimePopupVisible] = useState(false);
  const [showCampusPopup, setShowCampusPopup] = useState(false);
  const [campusPopupVisible, setCampusPopupVisible] = useState(false);
  const [campusSearchTerm, setCampusSearchTerm] = useState('');
  
  const servicePopupRef = useRef<HTMLDivElement>(null);
  const serviceModalContentRef = useRef<HTMLDivElement>(null);
  const timePopupRef = useRef<HTMLDivElement>(null);
  const campusPopupRef = useRef<HTMLDivElement>(null);
  const timeModalContentRef = useRef<HTMLDivElement>(null);
  const campusModalContentRef = useRef<HTMLDivElement>(null);

  // Handle service popup open animation
  const openServicePopup = () => {
    setShowServicePopup(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setServicePopupVisible(true);
      });
    });
  };

  // Handle service popup close animation
  const closeServicePopup = () => {
    setServicePopupVisible(false);
    setTimeout(() => {
      setShowServicePopup(false);
    }, 200);
  };

  // Handle time popup open animation
  const openTimePopup = () => {
    setShowTimePopup(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimePopupVisible(true);
      });
    });
  };

  // Handle time popup close animation
  const closeTimePopup = () => {
    setTimePopupVisible(false);
    setTimeout(() => {
      setShowTimePopup(false);
    }, 200);
  };

  // Handle campus popup open animation
  const openCampusPopup = () => {
    setShowCampusPopup(true);
    setCampusSearchTerm('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCampusPopupVisible(true);
      });
    });
  };

  // Handle campus popup close animation
  const closeCampusPopup = () => {
    setCampusPopupVisible(false);
    setTimeout(() => {
      setShowCampusPopup(false);
    }, 200);
  };

  // Close popups when clicking outside (desktop dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (servicePopupRef.current && !servicePopupRef.current.contains(event.target as Node)) {
        closeServicePopup();
      }
      if (timePopupRef.current && !timePopupRef.current.contains(event.target as Node)) {
        closeTimePopup();
      }
      if (campusPopupRef.current && !campusPopupRef.current.contains(event.target as Node)) {
        closeCampusPopup();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTransaction = (id: string) => {
    setExpandedTransaction(expandedTransaction === id ? null : id);
  };

  // Reset to page 1 when filter changes
  const handleServiceFilterChange = (newFilter: string) => {
    setServiceFilter(newFilter);
    setCurrentPage(1);
    closeServicePopup();
  };

  const handleTimeFilterChange = (newFilter: string) => {
    setTimeFilter(newFilter);
    setCurrentPage(1);
    closeTimePopup();
  };

  const handleCampusFilterChange = (newCampus: string) => {
    setCampusFilter(newCampus);
    setCurrentPage(1);
    closeCampusPopup();
  };

  const getServiceFilterLabel = () => {
    return SERVICE_OPTIONS.find(opt => opt.value === serviceFilter)?.label || 'All Services';
  };

  const getTimeFilterLabel = () => {
    return TIME_OPTIONS.find(opt => opt.value === timeFilter)?.label || 'All time';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment': return 'text-green-600';
      case 'payout': return 'text-blue-600';
      case 'refund': return 'text-red-600';
      case 'fee': return 'text-primary-600';
      default: return 'text-gray-600';
    }
  };

  // Filter by time period
  const getFilteredByTime = (txList: Transaction[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case 'today':
        return txList.filter(tx => tx.date >= startOfToday);
      case '7days':
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return txList.filter(tx => tx.date >= sevenDaysAgo);
      case '30days':
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return txList.filter(tx => tx.date >= thirtyDaysAgo);
      case 'all':
      default:
        return txList;
    }
  };

  const filteredTransactions = getFilteredByTime(
    transactions.filter(tx => {
      const matchesService = serviceFilter === 'all' || 
        tx.description.toLowerCase().includes(serviceFilter.toLowerCase()) ||
        tx.type.toLowerCase().includes(serviceFilter.toLowerCase());
      
      const matchesCampus = campusFilter === 'All Campuses' || tx.campus === campusFilter;
      
      return matchesService && matchesCampus;
    })
  );

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + TRANSACTIONS_PER_PAGE);

  // Pagination Controls Component
  const PaginationControls = () => (
    totalPages > 1 ? (
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(startIndex + TRANSACTIONS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
        </p>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-primary-500 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Payments & Transactions" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Transactions */}
        <Card>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-4">Transactions</h3>
            
            <div className="flex flex-col md:flex-row md:items-center justify-center gap-4 mb-6">
              
              <div className="flex gap-3">
                {/* Service Type Filter Popup */}
                <div className="relative" ref={servicePopupRef}>
                  <button
                    onClick={() => {
                      if (showServicePopup) {
                        closeServicePopup();
                      } else {
                        closeTimePopup();
                        closeCampusPopup();
                        openServicePopup();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Scissors className="w-4 h-4 text-gray-500" />
                    <span>{getServiceFilterLabel()}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showServicePopup ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showServicePopup && (
                    <>
                      {/* Mobile Modal */}
                      <div 
                        className={`md:hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6 transition-opacity duration-200 ${
                          servicePopupVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                        onClick={(e) => {
                          if (e.target === e.currentTarget) closeServicePopup();
                        }}
                      >
                        <div 
                          ref={serviceModalContentRef}
                          className={`bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden transition-all duration-200 ${
                            servicePopupVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                          }`}
                        >
                          <div className="bg-gradient-to-r from-primary-500 to-green-500 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Scissors className="w-6 h-6 text-white" />
                              <h3 className="text-lg font-bold text-white">Service Type</h3>
                            </div>
                            <button 
                              onClick={closeServicePopup}
                              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                            {SERVICE_OPTIONS.map(option => (
                              <button
                                key={option.value}
                                onClick={() => handleServiceFilterChange(option.value)}
                                className={`w-full px-5 py-4 text-left text-lg rounded-xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                                  serviceFilter === option.value 
                                    ? 'text-primary-600 font-semibold bg-primary-50 border-primary-500 shadow-sm' 
                                    : 'text-gray-700 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {option.label}
                                {serviceFilter === option.value && <Check className="w-6 h-6" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop Dropdown */}
                      <div className="hidden md:block absolute top-full left-0 mt-2 min-w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Service Type</p>
                        {SERVICE_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleServiceFilterChange(option.value)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                              serviceFilter === option.value ? 'text-primary-600 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                            {serviceFilter === option.value && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Time Filter Popup */}
                <div className="relative" ref={timePopupRef}>
                  <button
                    onClick={() => {
                      if (showTimePopup) {
                        closeTimePopup();
                      } else {
                        closeServicePopup();
                        closeCampusPopup();
                        openTimePopup();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{getTimeFilterLabel()}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTimePopup ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showTimePopup && (
                    <>
                      {/* Mobile Modal */}
                      <div 
                        className={`md:hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6 transition-opacity duration-200 ${
                          timePopupVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                        onClick={(e) => {
                          if (e.target === e.currentTarget) closeTimePopup();
                        }}
                      >
                        <div 
                          ref={timeModalContentRef}
                          className={`bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden transition-all duration-200 ${
                            timePopupVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                          }`}
                        >
                          <div className="bg-gradient-to-r from-primary-500 to-green-500 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-6 h-6 text-white" />
                              <h3 className="text-lg font-bold text-white">Time Period</h3>
                            </div>
                            <button 
                              onClick={closeTimePopup}
                              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                          <div className="p-4 space-y-3">
                            {TIME_OPTIONS.map(option => (
                              <button
                                key={option.value}
                                onClick={() => handleTimeFilterChange(option.value)}
                                className={`w-full px-5 py-4 text-left text-lg rounded-xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                                  timeFilter === option.value 
                                    ? 'text-primary-600 font-semibold bg-primary-50 border-primary-500 shadow-sm' 
                                    : 'text-gray-700 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {option.label}
                                {timeFilter === option.value && <Check className="w-6 h-6" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop Dropdown */}
                      <div className="hidden md:block absolute top-full left-0 mt-2 min-w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Time Period</p>
                        {TIME_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleTimeFilterChange(option.value)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                              timeFilter === option.value ? 'text-primary-600 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                            {timeFilter === option.value && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Campus Filter Popup */}
                <div className="relative" ref={campusPopupRef}>
                  <button
                    onClick={() => {
                      if (showCampusPopup) {
                        closeCampusPopup();
                      } else {
                        closeServicePopup();
                        closeTimePopup();
                        openCampusPopup();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{campusFilter}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCampusPopup ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCampusPopup && (
                    <>
                      {/* Mobile Modal */}
                      <div 
                        className={`md:hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6 transition-opacity duration-200 ${
                          campusPopupVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                        onClick={(e) => {
                          if (e.target === e.currentTarget) closeCampusPopup();
                        }}
                      >
                        <div 
                          ref={campusModalContentRef}
                          className={`bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden transition-all duration-200 ${
                            campusPopupVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                          }`}
                        >
                          <div className="bg-gradient-to-r from-primary-500 to-green-500 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MapPin className="w-6 h-6 text-white" />
                              <h3 className="text-lg font-bold text-white">Campus</h3>
                            </div>
                            <button 
                              onClick={closeCampusPopup}
                              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>
                          
                          {/* Campus Search */}
                          <div className="px-4 py-4 border-b border-gray-200">
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search campuses..."
                                value={campusSearchTerm}
                                onChange={(e) => setCampusSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
                                autoFocus
                              />
                            </div>
                          </div>
                          
                          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                            {CAMPUSES.filter(campus => 
                              campus.toLowerCase().includes(campusSearchTerm.toLowerCase())
                            ).map(campus => (
                              <button
                                key={campus}
                                onClick={() => handleCampusFilterChange(campus)}
                                className={`w-full px-5 py-4 text-left text-lg rounded-xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                                  campusFilter === campus 
                                    ? 'text-primary-600 font-semibold bg-primary-50 border-primary-500 shadow-sm' 
                                    : 'text-gray-700 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {campus}
                                {campusFilter === campus && <Check className="w-6 h-6" />}
                              </button>
                            ))}
                            
                            {CAMPUSES.filter(campus => 
                              campus.toLowerCase().includes(campusSearchTerm.toLowerCase())
                            ).length === 0 && (
                              <p className="px-5 py-4 text-lg text-gray-500 text-center">No campuses found</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop Dropdown */}
                      <div className="hidden md:block absolute top-full right-0 mt-2 min-w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Campus</p>
                        
                        {/* Campus Search */}
                        <div className="px-3 py-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search campuses..."
                              value={campusSearchTerm}
                              onChange={(e) => setCampusSearchTerm(e.target.value)}
                              className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto">
                          {CAMPUSES.filter(campus => 
                            campus.toLowerCase().includes(campusSearchTerm.toLowerCase())
                          ).map(campus => (
                            <button
                              key={campus}
                              onClick={() => handleCampusFilterChange(campus)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                                campusFilter === campus ? 'text-primary-600 font-medium' : 'text-gray-700'
                              }`}
                            >
                              {campus}
                              {campusFilter === campus && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                          
                          {CAMPUSES.filter(campus => 
                            campus.toLowerCase().includes(campusSearchTerm.toLowerCase())
                          ).length === 0 && (
                            <p className="px-3 py-2 text-sm text-gray-500">No campuses found</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Pagination - Top */}
            <PaginationControls />

            {/* Transaction Cards - Mobile Friendly */}
            <div className="space-y-3">
              {paginatedTransactions.map((tx) => {
                const isExpanded = expandedTransaction === tx.id;
                return (
                  <div 
                    key={tx.id} 
                    className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-gray-300 transition-colors"
                  >
                    {/* Compact Summary Row - Always Visible */}
                    <button
                      onClick={() => toggleTransaction(tx.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Icon */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(tx.status)}`}>
                          {getStatusIcon(tx.status)}
                        </div>
                        
                        {/* Description, Barber & Time */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{tx.description}</span>
                            {tx.barber && <span className="text-xs text-gray-600">• {tx.barber}</span>}
                          </div>
                          <div className="text-xs text-gray-500">{tx.timestamp}</div>
                        </div>
                      </div>

                      {/* Amount & Expand Icon */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`font-semibold ${tx.type === 'refund' ? 'text-red-600' : 'text-gray-900'}`}>
                          {tx.type === 'refund' ? '-$' : '$'}{tx.amount.toFixed(2)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {/* Type */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Type</p>
                            <span className={`font-medium capitalize ${getTypeColor(tx.type)}`}>
                              {tx.type}
                            </span>
                          </div>

                          {/* Status */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                              {getStatusIcon(tx.status)}
                              {tx.status}
                            </span>
                          </div>

                          {/* Campus */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Campus</p>
                            <span className="text-gray-700">{tx.campus}</span>
                          </div>

                          {/* Transaction ID */}
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">ID</p>
                            <span className="text-gray-600 font-mono text-xs">{tx.id}</span>
                          </div>
                        </div>

                        {/* Parties */}
                        {(tx.customer || tx.barber) && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Parties</p>
                            <div className="text-sm space-y-1">
                              {tx.customer && <div className="text-gray-700">Customer: {tx.customer}</div>}
                              {tx.barber && <div className="text-gray-600">Barber: {tx.barber}</div>}
                            </div>
                          </div>
                        )}

                        {/* Stripe Link */}
                        {tx.stripeId && (
                          <a 
                            href={`https://dashboard.stripe.com/payments/${tx.stripeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                          >
                            <CreditCard className="w-4 h-4" />
                            View in Stripe
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredTransactions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No transactions found</p>
              </div>
            )}

            {/* Pagination - Bottom */}
            <PaginationControls />
          </Card>
      </div>
    </div>
  );
}


