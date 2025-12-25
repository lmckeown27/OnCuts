// @ts-nocheck
/**
 * Barber Booking Requests Component
 * 
 * Shows pending booking requests with customer profiles
 * Allows barbers to accept or reject requests
 */

import React, { useState, useEffect } from 'react';
import { Clock, User, CheckCircle, XCircle, MessageSquare, Calendar } from 'lucide-react';
import Button from '../Button';
import Card from '../Card';
import axios from 'axios';
import toast from 'react-hot-toast';

interface CustomerProfile {
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowCount: number;
    avgRating: number;
    totalReviews: number;
    completionRate: number;
    isReliable: boolean;
    responseRate: number;
  };
}

interface BookingRequest {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerProfile: CustomerProfile;
  serviceType: string;
  requestedDate: string;
  requestedTime: string;
  price: number;
  message?: string;
  requestedAt: string;
}

interface Props {
  barberId: string;
  onRequestHandled?: () => void;
}

export default function BarberBookingRequests({ barberId, onRequestHandled }: Props) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [barberId]);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/booking-requests/barber/${barberId}/pending`
      );
      setRequests(response.data.requests || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
      setLoading(false);
    }
  };

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await axios.post(`http://localhost:3001/api/booking-requests/${bookingId}/accept`, {
        barberId,
        message: 'Looking forward to seeing you!',
      });
      
      toast.success('Booking accepted!');
      fetchRequests();
      onRequestHandled?.();
    } catch (error) {
      console.error('Failed to accept booking:', error);
      toast.error('Failed to accept booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string, reason?: string) => {
    setActionLoading(bookingId);
    try {
      await axios.post(`http://localhost:3001/api/booking-requests/${bookingId}/reject`, {
        barberId,
        reason: reason || 'Unable to accommodate this request at this time',
      });
      
      toast.success('Request declined');
      fetchRequests();
      onRequestHandled?.();
    } catch (error) {
      console.error('Failed to reject booking:', error);
      toast.error('Failed to decline booking');
    } finally {
      setActionLoading(null);
    }
  };

  const viewCustomerProfile = (request: BookingRequest) => {
    setSelectedRequest(request);
    setShowProfileModal(true);
  };

  const getReliabilityBadge = (profile: CustomerProfile) => {
    const { completionRate, noShowCount } = profile.stats;
    
    if (completionRate >= 90 && noShowCount === 0) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Reliable</span>;
    } else if (completionRate >= 70 && noShowCount < 3) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">Good</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading requests...</p>
        </div>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No pending booking requests</p>
          <p className="text-sm text-gray-500 mt-1">New requests will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Pending Booking Requests ({requests.length})</h2>
      
      {requests.map((request) => (
        <Card key={request.bookingId} className="hover:shadow-md transition-shadow rounded-xl border-2 border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Customer Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-400 rounded-full flex items-center justify-center text-white font-bold">
                  {request.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{request.customerName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getReliabilityBadge(request.customerProfile)}
                    <button
                      onClick={() => viewCustomerProfile(request)}
                      className="text-xs text-primary-400 hover:text-primary-500 font-medium"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Bookings</p>
                  <p className="font-semibold text-gray-900">{request.customerProfile.stats.totalBookings}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Completion</p>
                  <p className="font-semibold text-gray-900">{request.customerProfile.stats.completionRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">No-shows</p>
                  <p className="font-semibold text-gray-900">{request.customerProfile.stats.noShowCount}</p>
                </div>
              </div>

              {/* Booking Details */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">
                    {new Date(request.requestedDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                  <span className="text-gray-500">at {request.requestedTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Service:</span>
                  <span className="font-medium text-gray-900">{request.serviceType}</span>
                  <span className="text-gray-500">•</span>
                  <span className="font-semibold text-green-600">${request.price.toFixed(2)}</span>
                </div>
              </div>

              {/* Customer Message */}
              {request.message && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-blue-600 font-medium mb-1">Customer's message:</p>
                      <p className="text-sm text-gray-700">{request.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Request Time */}
              <p className="text-xs text-gray-500">
                Requested {new Date(request.requestedAt).toLocaleString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex md:flex-col gap-2 md:w-32">
              <Button
                onClick={() => handleAccept(request.bookingId)}
                disabled={actionLoading !== null}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <CheckCircle className="w-4 h-4" />
                Accept
              </Button>
              <Button
                onClick={() => handleReject(request.bookingId)}
                disabled={actionLoading !== null}
                variant="secondary"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 border-red-300 text-red-600 hover:bg-red-50"
                size="sm"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {/* Customer Profile Modal */}
      {showProfileModal && selectedRequest && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <Card 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Customer Profile</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-400 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedRequest.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-lg">{selectedRequest.customerProfile.displayName || selectedRequest.customerName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {getReliabilityBadge(selectedRequest.customerProfile)}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {selectedRequest.customerProfile.bio && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedRequest.customerProfile.bio}</p>
                </div>
              )}

              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedRequest.customerProfile.stats.totalBookings}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{selectedRequest.customerProfile.stats.completedBookings}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Completion Rate</p>
                  <p className="text-2xl font-bold text-primary-400">{selectedRequest.customerProfile.stats.completionRate}%</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">No-shows</p>
                  <p className="text-2xl font-bold text-red-600">{selectedRequest.customerProfile.stats.noShowCount}</p>
                </div>
              </div>


              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowProfileModal(false);
                    handleAccept(selectedRequest.bookingId);
                  }}
                  disabled={actionLoading !== null}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Booking
                </Button>
                <Button
                  onClick={() => {
                    setShowProfileModal(false);
                    handleReject(selectedRequest.bookingId);
                  }}
                  disabled={actionLoading !== null}
                  variant="secondary"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

