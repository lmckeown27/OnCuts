/**
 * Campus Manager Barber Profile View
 * 
 * Similar to Admin view but with limited powers:
 * - Can view all barber information
 * - Can report barber to admin
 * - Cannot block, ban, or modify barber account
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Flag,
  Instagram,
  Mail,
  Award,
  Clock,
  Loader2
} from 'lucide-react';
import Card from './Card';
import Button from './Button';
import barberService from '../services/barber.service';
import type { Barber } from '../types';

interface CampusManagerBarberViewProps {
  barberId: string;
  onClose: () => void;
}

export const CampusManagerBarberView: React.FC<CampusManagerBarberViewProps> = ({ 
  barberId, 
  onClose 
}) => {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    const fetchBarber = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await barberService.getBarberById(barberId);
        setBarber(data);
      } catch (err) {
        console.error('Failed to fetch barber:', err);
        setError('Failed to load barber profile');
      } finally {
        setLoading(false);
      }
    };

    fetchBarber();
  }, [barberId]);

  const handleSubmitReport = () => {
    if (!reportReason || !reportDetails) {
      alert('Please select a reason and provide details');
      return;
    }
    
    // TODO: Submit report to admin via API
    console.log('Report submitted:', {
      barberId: barberId,
      reason: reportReason,
      details: reportDetails,
    });
    
    alert('Report submitted to admin successfully');
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
  };

  // Helper to get barber name
  const getBarberName = () => {
    if (!barber) return 'Unknown';
    if (barber.display_name) return barber.display_name;
    if (barber.name) return barber.name;
    if (barber.first_name || barber.last_name) {
      return `${barber.first_name || ''} ${barber.last_name || ''}`.trim();
    }
    if (barber.user?.first_name || barber.user?.last_name) {
      return `${barber.user.first_name || ''} ${barber.user.last_name || ''}`.trim();
    }
    return 'Unknown Barber';
  };

  // Helper to get email
  const getEmail = () => {
    return barber?.user?.email || 'Not available';
  };

  // Helper to get price range
  const getPriceRange = () => {
    if (!barber?.pricing || barber.pricing.length === 0) {
      return { min: 0, max: 0 };
    }
    const prices = barber.pricing.map(s => s.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  };

  if (loading) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-8 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-600">Loading barber profile...</span>
        </div>
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Barber not found'}</p>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  const priceRange = getPriceRange();

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
            <div className="flex items-start gap-4 mb-4">
              {/* Profile Photo */}
              {(barber.profile_photo_url || barber.profile_picture_url) && (
                <img
                  src={barber.profile_photo_url || barber.profile_picture_url}
                  alt={getBarberName()}
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">{getBarberName()}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    barber.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {barber.is_active ? 'Active' : 'Inactive'}
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
                {getEmail() !== 'Not available' ? (
                  <a href={`mailto:${getEmail()}`} className="text-primary-600 hover:underline">
                    {getEmail()}
                  </a>
                ) : (
                  <span className="text-gray-500">Email not available</span>
                )}
              </div>
              {barber.instagram_handle && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Instagram className="w-4 h-4 text-gray-500" />
                  <a
                    href={`https://www.instagram.com/${barber.instagram_handle.replace('@', '')}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    @{barber.instagram_handle.replace('@', '')}
                  </a>
                </div>
              )}
              {barber.years_experience > 0 && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>{barber.years_experience} years experience</span>
                </div>
              )}
            </div>
          </Card>

          {/* Pricing Info */}
          {priceRange.max > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-600" />
                Pricing
              </h4>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-gray-600">Price Range</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${priceRange.min} - ${priceRange.max}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  Based on {barber.pricing?.length || 0} services offered
                </div>
              </div>
              {/* Service List */}
              {barber.pricing && barber.pricing.length > 0 && (
                <div className="mt-4 space-y-2">
                  {barber.pricing.map((service, index) => (
                    <div key={service.id || index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{service.name}</span>
                      <span className="font-medium text-gray-900">${service.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Specialties */}
          {barber.specialties && barber.specialties.length > 0 && (
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

          {/* Weekly Schedule */}
          {barber.weekly_schedule && (
            <Card className="p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                Weekly Schedule
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(barber.weekly_schedule).map(([day, schedule]) => (
                  <div key={day} className="text-sm">
                    <span className="font-medium text-gray-900 capitalize">{day}</span>
                    <p className="text-gray-600">
                      {schedule?.isAvailable 
                        ? `${schedule.startTime} - ${schedule.endTime}`
                        : 'Unavailable'
                      }
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
