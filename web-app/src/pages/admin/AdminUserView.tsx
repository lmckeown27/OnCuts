import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
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

// TODO: Replace with real API calls to fetch user data
// For now, we'll show a "not found" state when no user is in the database

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

  // Load user data from API
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      
      try {
        // TODO: Replace with actual API call
        // const response = await adminService.getUserById(userId);
        // setUser(response.data);
        // setActivityLogs(response.activityLogs || []);
        // setTransactions(response.transactions || []);
        
        // For now, show not found since mock data is removed
        setUser(null);
        setActivityLogs([]);
        setTransactions([]);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      }
      
      setIsLoading(false);
    };
    
    if (userId) {
      fetchUser();
    }
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

