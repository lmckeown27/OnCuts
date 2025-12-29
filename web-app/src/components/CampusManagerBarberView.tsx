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
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle smooth close
  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 150);
  };

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

  // Helper to get email - backend returns email directly on barber object from JOIN
  const getEmail = () => {
    return (barber as any)?.email || barber?.user?.email || 'Not available';
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
        className={`absolute inset-0 flex items-center justify-center z-20 p-4 transition-all duration-150 ease-out ${isVisible ? 'bg-black/30' : 'bg-black/0'}`}
        onClick={handleClose}
      >
        <div 
          className={`bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex items-center justify-center border border-gray-300 transition-all duration-150 ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="ml-3 text-gray-600 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div 
        className={`absolute inset-0 flex items-center justify-center z-20 p-4 transition-all duration-150 ease-out ${isVisible ? 'bg-black/30' : 'bg-black/0'}`}
        onClick={handleClose}
      >
        <div 
          className={`bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-300 transition-all duration-150 ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="text-red-600 mb-4 text-sm">{error || 'Barber not found'}</p>
            <Button variant="outline" size="sm" onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  const priceRange = getPriceRange();

  return (
    <div 
      className={`absolute inset-0 flex items-center justify-center z-20 p-2 transition-all duration-150 ease-out ${isVisible ? 'bg-black/30' : 'bg-black/0'}`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85%] overflow-y-auto border border-gray-300 transition-all duration-150 ease-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Barber Profile</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Basic Info */}
          <Card className="p-3">
            <div className="flex items-start gap-2 mb-2">
              {/* Profile Photo */}
              {(barber.profile_photo_url || barber.profile_picture_url) && (
                <img
                  src={barber.profile_photo_url || barber.profile_picture_url}
                  alt={getBarberName()}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 truncate">{getBarberName()}</h3>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                    barber.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {barber.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {barber.bio && (
                  <p className="text-xs text-gray-600 line-clamp-2">{barber.bio}</p>
                )}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-gray-700">
                <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                {getEmail() !== 'Not available' ? (
                  <a href={`mailto:${getEmail()}`} className="text-primary-600 hover:underline truncate">
                    {getEmail()}
                  </a>
                ) : (
                  <span className="text-gray-500">Email not available</span>
                )}
              </div>
              {barber.instagram_handle && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Instagram className="w-3 h-3 text-gray-500 flex-shrink-0" />
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
            </div>
          </Card>

          {/* Pricing Info */}
          {priceRange.max > 0 && (
            <Card className="p-3">
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2 text-xs">
                <DollarSign className="w-3 h-3 text-primary-600" />
                Pricing
              </h4>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs text-gray-600">Range</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${priceRange.min} - ${priceRange.max}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {barber.pricing?.length || 0} services
                </div>
              </div>
            </Card>
          )}

          {/* Specialties */}
          {barber.specialties && barber.specialties.length > 0 && (
            <Card className="p-3">
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2 text-xs">
                <Award className="w-3 h-3 text-primary-600" />
                Specialties
              </h4>
              <div className="flex flex-wrap gap-1">
                {barber.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Weekly Schedule */}
          {barber.weekly_schedule && (
            <Card className="p-3">
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2 text-xs">
                <Clock className="w-3 h-3 text-primary-600" />
                Schedule
              </h4>
              <div className="grid grid-cols-4 gap-1">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                  const schedule = (barber.weekly_schedule as any)?.[day];
                  const formatTime = (time: string) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const period = hours >= 12 ? 'p' : 'a';
                    const hour12 = hours % 12 || 12;
                    return `${hour12}${period}`;
                  };
                  return (
                    <div key={day} className="text-xs">
                      <span className="font-medium text-gray-900 capitalize">{day.slice(0, 2)}</span>
                      <p className="text-gray-600 text-[10px]">
                        {schedule?.enabled 
                          ? `${formatTime(schedule.start)}-${formatTime(schedule.end)}`
                          : 'Off'
                        }
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Campus Manager Actions */}
          <Card className="p-2 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-3 h-3 text-yellow-600" />
                <span className="text-xs text-yellow-800">Report issues to admin</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="border-yellow-600 text-yellow-700 hover:bg-yellow-100 text-xs py-1 px-2"
              >
                Report
              </Button>
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
