import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  ShieldAlert,
  ShieldOff,
  Ban,
  UserX,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Eye,
  FileText,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
} from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Loading from '../../components/Loading';
import AdminHeader from '../../components/AdminHeader';

type UserStatus = 'active' | 'blocked' | 'banned' | 'suspended';
type UserRole = 'student' | 'barber';

type UserAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  wallet_address?: string; // Not used in v1 (off-chain)
  status: UserStatus;
  is_verified: boolean;
  created_at: string;
  last_login: string;
  total_bookings: number;
  total_spent?: number; // For students
  total_earned?: number; // For barbers
  average_rating?: number;
  specialties?: string[]; // For barbers
  campus: string;
  admin_notes: string[];
  flags: string[];
};

type ActivityLog = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  counterparty: string;
};

// Mock data for users
const mockUsers: Record<string, UserAccount> = {
  'barber-1': {
    id: 'barber-1',
    name: 'Marcus Thompson',
    email: 'marcus.thompson@calpoly.edu',
    phone: '(805) 555-0123',
    role: 'barber',
    wallet_address: '0x1234...5678',
    status: 'active',
    is_verified: true,
    created_at: '2024-01-15T10:00:00Z',
    last_login: '2024-12-24T14:30:00Z',
    total_bookings: 156,
    total_earned: 4850,
    average_rating: 4.9,
    specialties: ['Fades', 'Curly Hair', 'Beard Grooming'],
    campus: 'California Polytechnic State University',
    admin_notes: ['Top performer on campus', 'No complaints'],
    flags: [],
  },
  'barber-2': {
    id: 'barber-2',
    name: 'Jordan Williams',
    email: 'jordan.w@calpoly.edu',
    phone: '(805) 555-0456',
    role: 'barber',
    wallet_address: '0x2345...6789',
    status: 'active',
    is_verified: true,
    created_at: '2024-02-20T10:00:00Z',
    last_login: '2024-12-23T16:00:00Z',
    total_bookings: 98,
    total_earned: 2940,
    average_rating: 4.7,
    specialties: ['Line Ups', 'Designs', 'Buzz Cuts'],
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  },
  'barber-3': {
    id: 'barber-3',
    name: 'Alex Chen',
    email: 'alex.chen@ucsb.edu',
    phone: '(805) 555-0789',
    role: 'barber',
    wallet_address: '0x3456...7890',
    status: 'active',
    is_verified: true,
    created_at: '2024-03-10T10:00:00Z',
    last_login: '2024-12-24T09:00:00Z',
    total_bookings: 203,
    total_earned: 6495,
    average_rating: 4.8,
    specialties: ['Asian Hair', 'Textured Cuts', 'Modern Styles'],
    campus: 'University of California, Santa Barbara',
    admin_notes: ['Excellent customer service'],
    flags: [],
  },
  'student-1': {
    id: 'student-1',
    name: 'John Doe',
    email: 'jdoe@calpoly.edu',
    phone: '(805) 555-1001',
    role: 'student',
    wallet_address: '0x4567...8901',
    status: 'active',
    is_verified: true,
    created_at: '2024-01-20T10:00:00Z',
    last_login: '2024-12-24T11:00:00Z',
    total_bookings: 12,
    total_spent: 420,
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  },
  'student-2': {
    id: 'student-2',
    name: 'Jane Smith',
    email: 'jsmith@calpoly.edu',
    phone: '(805) 555-1002',
    role: 'student',
    wallet_address: '0x5678...9012',
    status: 'active',
    is_verified: true,
    created_at: '2024-02-15T10:00:00Z',
    last_login: '2024-12-23T15:00:00Z',
    total_bookings: 8,
    total_spent: 280,
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  },
  'student-3': {
    id: 'student-3',
    name: 'Mike Johnson',
    email: 'mjohnson@calpoly.edu',
    phone: '(805) 555-1003',
    role: 'student',
    wallet_address: '0x6789...0123',
    status: 'active',
    is_verified: false,
    created_at: '2024-03-01T10:00:00Z',
    last_login: '2024-12-22T10:00:00Z',
    total_bookings: 5,
    total_spent: 175,
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  },
};

const mockActivityLogs: ActivityLog[] = [
  { id: '1', timestamp: '2024-12-24T14:30:00Z', action: 'Login', details: 'User logged in from iOS app' },
  { id: '2', timestamp: '2024-12-24T10:00:00Z', action: 'Booking Completed', details: 'Completed booking #1234' },
  { id: '3', timestamp: '2024-12-23T16:00:00Z', action: 'Profile Updated', details: 'Updated availability schedule' },
  { id: '4', timestamp: '2024-12-22T12:00:00Z', action: 'Payment Received', details: 'Received $35 for fade haircut' },
];

const mockTransactions: Transaction[] = [
  { id: 'tx-1', type: 'Payment Received', amount: 35, date: '2024-12-24T10:00:00Z', status: 'completed', counterparty: 'John Doe' },
  { id: 'tx-2', type: 'Payment Received', amount: 45, date: '2024-12-23T14:00:00Z', status: 'completed', counterparty: 'Jane Smith' },
  { id: 'tx-3', type: 'Payout', amount: -75, date: '2024-12-22T09:00:00Z', status: 'completed', counterparty: 'Bank Account' },
  { id: 'tx-4', type: 'Payment Received', amount: 30, date: '2024-12-21T11:00:00Z', status: 'completed', counterparty: 'Mike Johnson' },
];

export default function AdminUserView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  // Load user data from mock data (will be replaced with API call later)
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      if (userId && mockUsers[userId]) {
        setUser(mockUsers[userId]);
        setActivityLogs(mockActivityLogs);
        setTransactions(mockTransactions);
      }
      setIsLoading(false);
    }, 300);
  }, [userId]);

  const handleStatusChange = (newStatus: UserStatus) => {
    if (!user) return;
    
    setIsActioning(true);
    
    // Mock status update (will be replaced with API call)
    setTimeout(() => {
      setUser({ ...user, status: newStatus });
      setIsActioning(false);
      alert(`User status updated to ${newStatus}`);
    }, 300);
  };

  const handleVerificationToggle = () => {
    if (!user) return;
    
    setIsActioning(true);
    
    // Mock verification toggle (will be replaced with API call)
    setTimeout(() => {
      const newVerified = !user.is_verified;
      setUser({ ...user, is_verified: newVerified });
      setIsActioning(false);
      alert(`Verification ${newVerified ? 'granted' : 'revoked'}`);
    }, 300);
  };

  const handleResetPassword = () => {
    if (!user) return;
    if (!window.confirm(`Send password reset email to ${user.email}?`)) return;
    
    setIsActioning(true);
    
    // Mock password reset (will be replaced with API call)
    setTimeout(() => {
      setIsActioning(false);
      alert(`Password reset email sent to ${user.email}`);
    }, 300);
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    
    setIsActioning(true);
    
    // Mock delete (will be replaced with API call)
    setTimeout(() => {
      alert('Account deleted successfully. Redirecting...');
      navigate(-1);
    }, 300);
  };

  const handleAddNote = () => {
    if (!user || !adminNote.trim()) return;
    
    setIsActioning(true);
    
    // Mock add note (will be replaced with API call)
    setTimeout(() => {
      setUser({ ...user, admin_notes: [...user.admin_notes, adminNote] });
      setAdminNote('');
      setShowAddNote(false);
      setIsActioning(false);
      alert('Note added successfully');
    }, 300);
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'blocked':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'banned':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'suspended':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5" />;
      case 'blocked':
        return <Lock className="w-5 h-5" />;
      case 'banned':
        return <Ban className="w-5 h-5" />;
      case 'suspended':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <Button onClick={() => navigate('/admin')}>Back to Admin</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="User Management" />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb & Status */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate(-1)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-600 mt-1">User Account Details & Controls</p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold ${getStatusColor(user.status)}`}>
            {getStatusIcon(user.status)}
            <span className="uppercase text-sm">{user.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary-100 rounded-full p-4">
                    <User className="w-8 h-8 text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-1 bg-primary-100 text-primary-600 text-xs font-semibold rounded">
                        {user.role.toUpperCase()}
                      </span>
                      {user.is_verified && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-semibold text-gray-900">{user.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-gray-600">Last Login</p>
                    <p className="font-semibold text-gray-900">{formatDate(user.last_login)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600 mb-1">Campus</p>
                <p className="font-semibold text-gray-900">{user.campus}</p>
              </div>
            </Card>

            {/* Campus Manager Comments */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Campus Manager Comments</h3>
              <div className="space-y-3">
                {user.admin_notes && user.admin_notes.length > 0 ? (
                  user.admin_notes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700">{note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">None</p>
                )}
              </div>
            </Card>

            </div>

          {/* Right Column - Admin Controls */}
          <div className="space-y-6">
            {/* Account Status Controls */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Account Status
              </h3>
              <div className="space-y-2">
                <Button
                  className="w-full justify-start"
                  variant={user.status === 'active' ? 'primary' : 'secondary'}
                  onClick={() => handleStatusChange('active')}
                  disabled={isActioning}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Set Active
                </Button>
                <Button
                  className="w-full justify-start bg-yellow-500 hover:bg-yellow-600"
                  onClick={() => handleStatusChange('blocked')}
                  disabled={isActioning}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Block Account
                </Button>
                <Button
                  className="w-full justify-start bg-orange-500 hover:bg-orange-600"
                  onClick={() => handleStatusChange('suspended')}
                  disabled={isActioning}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Suspend (Temp)
                </Button>
                <Button
                  className="w-full justify-start bg-red-500 hover:bg-red-600"
                  onClick={() => handleStatusChange('banned')}
                  disabled={isActioning}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Ban Permanently
                </Button>
              </div>
            </Card>

            {/* Account Actions */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldOff className="w-5 h-5" />
                Account Actions
              </h3>
              <div className="space-y-2">
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={handleResetPassword}
                  disabled={isActioning}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Password
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={() => window.open(`mailto:${user.email}`)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email User
                </Button>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card className="border-2 border-red-200 bg-red-50">
              <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h3>
              {!showDeleteConfirm ? (
                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-900 font-semibold">
                    Are you sure? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={handleDeleteAccount}
                      disabled={isActioning}
                    >
                      Yes, Delete
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

