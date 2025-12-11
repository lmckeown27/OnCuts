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

type UserStatus = 'active' | 'blocked' | 'banned' | 'suspended';
type UserRole = 'student' | 'barber';

type UserAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  wallet_address: string;
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

  // Fetch user data from API
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      
      try {
        const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`);
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
          setActivityLogs(data.activityLogs);
          setTransactions(data.transactions);
        } else {
          console.error('Failed to fetch user data:', data.message);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const handleStatusChange = async (newStatus: UserStatus) => {
    if (!user) return;
    
    setIsActioning(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        alert(`User status updated to ${newStatus}`);
      } else {
        alert(`Failed to update status: ${data.message}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    } finally {
      setIsActioning(false);
    }
  };

  const handleVerificationToggle = async () => {
    if (!user) return;
    
    setIsActioning(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/verification`, {
        method: 'PUT',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        alert(`Verification ${data.user.is_verified ? 'granted' : 'revoked'}`);
      } else {
        alert(`Failed to toggle verification: ${data.message}`);
      }
    } catch (error) {
      console.error('Error toggling verification:', error);
      alert('Error toggling verification');
    } finally {
      setIsActioning(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    if (!window.confirm(`Send password reset email to ${user.email}?`)) return;
    
    setIsActioning(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
      } else {
        alert(`Failed to reset password: ${data.message}`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password');
    } finally {
      setIsActioning(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsActioning(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Account deleted successfully. Redirecting...');
        setTimeout(() => navigate('/admin'), 1000);
      } else {
        alert(`Failed to delete account: ${data.message}`);
        setIsActioning(false);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error deleting account');
      setIsActioning(false);
    }
  };

  const handleAddNote = async () => {
    if (!user || !adminNote.trim()) return;
    
    setIsActioning(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: adminNote }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        setAdminNote('');
        setShowAddNote(false);
        alert('Note added successfully');
      } else {
        alert(`Failed to add note: ${data.message}`);
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    } finally {
      setIsActioning(false);
    }
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-1">Admin controls for {user.name}</p>
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
                  <div className="bg-indigo-100 rounded-full p-4">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded">
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
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-gray-600">Joined</p>
                    <p className="font-semibold text-gray-900">{formatDate(user.created_at)}</p>
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
                <p className="text-xs text-gray-600 mb-1">Wallet Address</p>
                <p className="font-mono text-sm text-gray-900 break-all">{user.wallet_address}</p>
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600 mb-1">Campus</p>
                <p className="font-semibold text-gray-900">{user.campus}</p>
              </div>
            </Card>

            {/* Stats */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{user.total_bookings}</p>
                  <p className="text-xs text-gray-600">Total Bookings</p>
                </div>
                {user.total_earned !== undefined && (
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">${user.total_earned.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Total Earned</p>
                  </div>
                )}
                {user.total_spent !== undefined && (
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">${user.total_spent.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Total Spent</p>
                  </div>
                )}
                {user.average_rating !== undefined && (
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <Award className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{user.average_rating.toFixed(1)}</p>
                    <p className="text-xs text-gray-600">Avg Rating</p>
                  </div>
                )}
              </div>
              {user.specialties && user.specialties.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {user.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Activity Logs */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                <Eye className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{log.action}</span>
                        <span className="text-xs text-gray-500">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Transactions */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
                <DollarSign className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{tx.type}</p>
                      <p className="text-xs text-gray-600">{tx.counterparty}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(tx.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
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

            {/* Verification */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Verification
              </h3>
              <Button
                className="w-full"
                variant={user.is_verified ? 'secondary' : 'primary'}
                onClick={handleVerificationToggle}
                disabled={isActioning}
              >
                {user.is_verified ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Revoke Verification
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify Account
                  </>
                )}
              </Button>
            </Card>

            {/* Admin Notes */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Admin Notes
              </h3>
              
              {!showAddNote ? (
                <Button
                  className="w-full mb-4"
                  variant="secondary"
                  onClick={() => setShowAddNote(true)}
                >
                  Add Note
                </Button>
              ) : (
                <div className="mb-4 space-y-2">
                  <textarea
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={3}
                    placeholder="Enter admin note..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleAddNote}
                      disabled={!adminNote.trim() || isActioning}
                    >
                      Save Note
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowAddNote(false);
                        setAdminNote('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {user.admin_notes.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No admin notes</p>
                ) : (
                  user.admin_notes.map((note, idx) => (
                    <div key={idx} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                      {note}
                    </div>
                  ))
                )}
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

