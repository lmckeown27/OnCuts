// @ts-nocheck
/**
 * Admin Fraud Detection Page
 * 
 * Automated fraud detection and risk management dashboard
 */

import { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Ban,
  AlertCircle,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import AdminHeader from '../../components/AdminHeader';
import axios from 'axios';
import toast from 'react-hot-toast';

interface FraudFlag {
  id: string;
  userId: string;
  userName: string;
  userType: 'student' | 'barber';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flagType: string;
  reason: string;
  evidence: string[];
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'FALSE_POSITIVE';
  detectedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  aiConfidence: number;
  relatedFlags?: string[];
}

interface FraudStats {
  totalFlags: number;
  pendingFlags: number;
  resolvedFlags: number;
  falsePositives: number;
  highRiskUsers: number;
  blockedUsers: number;
  avgResponseTime: number; // minutes
}

export default function AdminFraudDetectionPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [stats, setStats] = useState<FraudStats>({
    totalFlags: 0,
    pendingFlags: 0,
    resolvedFlags: 0,
    falsePositives: 0,
    highRiskUsers: 0,
    blockedUsers: 0,
    avgResponseTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FraudFlag | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchFraudData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchFraudData, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchFraudData = async () => {
    try {
      setIsRefreshing(true);
      
      // Fetch fraud flags from detection service
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/ai/admin/fraud-flags`, {
        params: { status: statusFilter, limit: 100 }
      });

      // Transform API data to our interface
      const transformedFlags: FraudFlag[] = response.data.flags?.map((flag: any) => ({
        id: flag.id || `flag-${Date.now()}-${Math.random()}`,
        userId: flag.user_id || flag.userId || 'unknown',
        userName: flag.user_name || flag.userName || 'Unknown User',
        userType: flag.user_type || flag.userType || 'student',
        riskScore: flag.risk_score || flag.riskScore || 0,
        riskLevel: flag.risk_level || flag.riskLevel || 'LOW',
        flagType: flag.flag_type || flag.flagType || 'SUSPICIOUS_ACTIVITY',
        reason: flag.reason || 'Suspicious pattern detected',
        evidence: flag.evidence || [],
        status: flag.status || 'PENDING',
        detectedAt: flag.detected_at || flag.detectedAt || new Date().toISOString(),
        reviewedAt: flag.reviewed_at || flag.reviewedAt,
        reviewedBy: flag.reviewed_by || flag.reviewedBy,
        aiConfidence: flag.ai_confidence || flag.aiConfidence || 0,
        relatedFlags: flag.related_flags || flag.relatedFlags || [],
      })) || [];

      setFlags(transformedFlags);

      // Calculate stats
      const newStats: FraudStats = {
        totalFlags: transformedFlags.length,
        pendingFlags: transformedFlags.filter(f => f.status === 'PENDING').length,
        resolvedFlags: transformedFlags.filter(f => f.status === 'RESOLVED').length,
        falsePositives: transformedFlags.filter(f => f.status === 'FALSE_POSITIVE').length,
        highRiskUsers: transformedFlags.filter(f => f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL').length,
        blockedUsers: 0, // Would come from user management API
        avgResponseTime: 45, // Would be calculated from timestamps
      };
      setStats(newStats);
    } catch (error) {
      console.error('Failed to fetch fraud data:', error);
      toast.error('Failed to load fraud detection data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleFlagAction = async (flagId: string, action: 'RESOLVED' | 'FALSE_POSITIVE' | 'ESCALATE') => {
    try {
      // Update flag status
      await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/fraud-flags/${flagId}/action`, {
        action,
        reviewedBy: 'admin', // Would come from auth context
      });

      toast.success(`Flag marked as ${action.replace('_', ' ').toLowerCase()}`);
      fetchFraudData();
    } catch (error) {
      console.error('Failed to update flag:', error);
      toast.error('Failed to update flag status');
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!confirm('Are you sure you want to block this user? This action can be reversed later.')) {
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/block`);
      toast.success('User blocked successfully');
      fetchFraudData();
    } catch (error) {
      console.error('Failed to block user:', error);
      toast.error('Failed to block user');
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-700 bg-red-100 border-red-300';
      case 'HIGH': return 'text-orange-700 bg-orange-100 border-orange-300';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'LOW': return 'text-green-700 bg-green-100 border-green-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'HIGH': return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'MEDIUM': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'LOW': return <Shield className="w-5 h-5 text-green-600" />;
      default: return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  const filteredFlags = flags.filter(flag => {
    const matchesRisk = riskFilter === 'ALL' || flag.riskLevel === riskFilter;
    const matchesSearch = searchQuery === '' || 
      flag.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.flagType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="Fraud Detection" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading fraud detection data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="Fraud Detection" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by user, ID, or flag type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE_POSITIVE">False Positive</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Refresh Button */}
            <Button
              onClick={() => fetchFraudData()}
              variant="outline"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Fraud Flags List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              Fraud Flags ({filteredFlags.length})
            </h3>
            {filteredFlags.length === 0 && (
              <p className="text-sm text-gray-500">No flags match your filters</p>
            )}
          </div>

          {filteredFlags.length === 0 ? (
            <Card className="p-8 text-center">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No fraud flags found</p>
              <p className="text-sm text-gray-500 mt-2">
                {searchQuery || riskFilter !== 'ALL' ? 'Try adjusting your filters' : 'All clear! The system is monitoring for suspicious activity.'}
              </p>
            </Card>
          ) : (
            filteredFlags.map((flag) => (
              <Card key={flag.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  {/* Flag Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getRiskIcon(flag.riskLevel)}
                      <div>
                        <h4 className="font-bold text-gray-900">{flag.userName}</h4>
                        <p className="text-sm text-gray-600">
                          {flag.userType === 'barber' ? '✂️ Barber' : '👤 Student'} • ID: {flag.userId}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(flag.riskLevel)}`}>
                        {flag.riskLevel} RISK
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="font-semibold text-gray-900 mb-1">{flag.flagType.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-700 mb-2">{flag.reason}</p>
                      
                      {flag.evidence && flag.evidence.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 mt-2">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Evidence:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {flag.evidence.map((item, idx) => (
                              <li key={idx}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Confidence: {(flag.aiConfidence * 100).toFixed(0)}%</span>
                      <span>•</span>
                      <span>Detected: {new Date(flag.detectedAt).toLocaleString()}</span>
                      {flag.reviewedAt && (
                        <>
                          <span>•</span>
                          <span>Reviewed: {new Date(flag.reviewedAt).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {flag.status === 'PENDING' && (
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => setSelectedFlag(flag)}
                        variant="outline"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleFlagAction(flag.id, 'RESOLVED')}
                        variant="primary"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleFlagAction(flag.id, 'FALSE_POSITIVE')}
                        variant="outline"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        False
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBlockUser(flag.userId)}
                        variant="danger"
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Block
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Flag Detail Modal */}
      {selectedFlag && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedFlag(null)}
        >
          <Card 
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Fraud Flag Details</h2>
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">User</p>
                  <p className="text-gray-900">{selectedFlag.userName} ({selectedFlag.userId})</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Risk Level</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(selectedFlag.riskLevel)}`}>
                    {selectedFlag.riskLevel}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Flag Type</p>
                  <p className="text-gray-900">{selectedFlag.flagType.replace(/_/g, ' ')}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Reason</p>
                  <p className="text-gray-900">{selectedFlag.reason}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Detection Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-400 h-2 rounded-full transition-all"
                        style={{ width: `${selectedFlag.aiConfidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-700">{(selectedFlag.aiConfidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Evidence</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-900">
                    {selectedFlag.evidence.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      handleFlagAction(selectedFlag.id, 'RESOLVED');
                      setSelectedFlag(null);
                    }}
                    variant="primary"
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                  <Button
                    onClick={() => {
                      handleFlagAction(selectedFlag.id, 'FALSE_POSITIVE');
                      setSelectedFlag(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    False Positive
                  </Button>
                  <Button
                    onClick={() => {
                      handleBlockUser(selectedFlag.userId);
                      setSelectedFlag(null);
                    }}
                    variant="danger"
                    className="flex-1"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Block User
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
