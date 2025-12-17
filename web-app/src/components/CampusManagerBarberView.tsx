/**
 * Campus Manager Barber Profile View
 * 
 * Similar to Admin view but with limited powers:
 * - Can view all barber information
 * - Can report barber to admin
 * - Cannot block, ban, or modify barber account
 */

import React, { useState } from 'react';
import { 
  X, 
  Star, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Flag,
  Instagram,
  Mail,
  Phone,
  Award,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Card from './Card';
import Button from './Button';

interface BarberProfileData {
  id: string;
  name: string;
  email: string; // Required
  phoneNumber: string; // Required
  instagramHandle?: string; // Optional
  bio?: string;
  
  // Performance metrics
  avgRating: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalReviews: number;
  
  // Financial
  totalEarnings: number;
  currentPriceRange: {
    min: number;
    max: number;
  };
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  lastActiveDate: Date;
  
  // Additional info
  specialties: string[];
  responseTime: string;
}

interface CampusManagerBarberViewProps {
  barberId: string;
  onClose: () => void;
}

export const CampusManagerBarberView: React.FC<CampusManagerBarberViewProps> = ({ 
  barberId, 
  onClose 
}) => {
  // TODO: Fetch from API
  const [barber] = useState<BarberProfileData>({
    id: barberId,
    name: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    phoneNumber: '(555) 123-4567',
    instagramHandle: 'marcuscuts_slo',
    bio: 'Professional barber with 8 years experience. Specializing in modern fades and classic cuts.',
    
    avgRating: 4.8,
    totalBookings: 127,
    completedBookings: 119,
    cancelledBookings: 3,
    totalReviews: 98,
    
    totalEarnings: 11865,
    currentPriceRange: {
      min: 22,
      max: 60,
    },
    
    isActive: true,
    isVerified: true,
    lastActiveDate: new Date('2025-01-16'),
    
    specialties: ['Fade', 'Haircut', 'Beard Trim', 'Full Service'],
    responseTime: '< 2 hours',
  });

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const completionRate = ((barber.completedBookings / barber.totalBookings) * 100).toFixed(1);
  const cancellationRate = ((barber.cancelledBookings / barber.totalBookings) * 100).toFixed(1);

  const handleSubmitReport = () => {
    if (!reportReason || !reportDetails) {
      alert('Please select a reason and provide details');
      return;
    }
    
    // TODO: Submit report to admin via API
    console.log('Report submitted:', {
      barberId: barber.id,
      reason: reportReason,
      details: reportDetails,
    });
    
    alert('Report submitted to admin successfully');
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Barber Profile</h2>
            <span className="text-sm text-gray-500">(Campus Manager View)</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">{barber.name}</h3>
                  {barber.isVerified && (
                    <CheckCircle className="w-6 h-6 text-green-500" title="Verified" />
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    barber.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {barber.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {barber.bio && (
                  <p className="text-gray-600 mb-4">{barber.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-4 h-4 text-gray-500" />
                <a href={`mailto:${barber.email}`} className="text-primary-600 hover:underline">
                  {barber.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-gray-500" />
                <a href={`tel:${barber.phoneNumber}`} className="text-primary-600 hover:underline">
                  {barber.phoneNumber}
                </a>
              </div>
              {barber.instagramHandle && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Instagram className="w-4 h-4 text-gray-500" />
                  <a
                    href={`https://www.instagram.com/${barber.instagramHandle}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    @{barber.instagramHandle}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>Response time: {barber.responseTime}</span>
              </div>
            </div>
          </Card>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-gray-600">Rating</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{barber.avgRating.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">{barber.totalReviews} reviews</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">Bookings</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{barber.totalBookings}</p>
              <p className="text-xs text-gray-500 mt-1">{barber.completedBookings} completed</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Completion</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Success rate</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Earnings</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${barber.totalEarnings.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Total earned</p>
            </Card>
          </div>

          {/* Pricing Info */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Pricing
            </h4>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">Price Range</p>
                <p className="text-lg font-bold text-gray-900">
                  ${barber.currentPriceRange.min} - ${barber.currentPriceRange.max}
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Pricing is determined algorithmically based on quality and demand
              </div>
            </div>
          </Card>

          {/* Specialties */}
          {barber.specialties.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary-600" />
                Specialties
              </h4>
              <div className="flex flex-wrap gap-2">
                {barber.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Activity Timeline */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Activity
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Active:</span>
                <span className="font-medium text-gray-900">
                  {barber.lastActiveDate.toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cancellation Rate:</span>
                <span className={`font-medium ${
                  parseFloat(cancellationRate) < 5 ? 'text-green-600' :
                  parseFloat(cancellationRate) < 10 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {cancellationRate}%
                </span>
              </div>
            </div>
          </Card>

          {/* Campus Manager Actions */}
          <Card className="p-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-start gap-3">
              <Flag className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 mb-2">Campus Manager Actions</h4>
                <p className="text-sm text-yellow-800 mb-4">
                  As a Campus Manager, you can report issues or concerns about this barber to platform administrators.
                  You cannot directly modify their account or take administrative actions.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowReportModal(true)}
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report to Admin
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowReportModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Report Barber to Admin</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Report *
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Select a reason...</option>
                  <option value="quality_issues">Quality Issues</option>
                  <option value="professionalism">Unprofessional Behavior</option>
                  <option value="customer_complaints">Multiple Customer Complaints</option>
                  <option value="no_show">Repeated No-Shows</option>
                  <option value="pricing_violations">Pricing Violations</option>
                  <option value="safety_concerns">Safety Concerns</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Details *
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={6}
                  placeholder="Please provide specific details about the issue, including dates, incidents, and any supporting information..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This report will be sent to platform administrators for review.
                  They will investigate and take appropriate action if necessary. All reports are confidential.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmitReport}
                  disabled={!reportReason || !reportDetails}
                >
                  Submit Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

