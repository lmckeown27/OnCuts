/**
 * Barber Booking Requests Dropdown Component
 * 
 * Compact dropdown inbox for booking requests in header
 */

import React, { useState, useEffect, useRef } from 'react';
import { Inbox, CheckCircle, XCircle, Calendar, User } from 'lucide-react';
import Button from '../Button';
import axios from 'axios';
import toast from 'react-hot-toast';

interface CustomerProfile {
  displayName: string;
  stats: {
    completionRate: number;
    isReliable: boolean;
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
}

interface Props {
  barberId: string;
}

export default function BarberBookingRequestsDropdown({ barberId }: Props) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRequests();
  }, [barberId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/booking-requests/barber/${barberId}/pending`
      );
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const handleAccept = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await axios.post(`http://localhost:3001/api/booking-requests/${bookingId}/accept`, {
        barberId,
        message: 'Looking forward to seeing you!',
      });
      toast.success('Booking request accepted!');
      fetchRequests();
    } catch (error) {
      console.error('Failed to accept booking:', error);
      toast.error('Failed to accept booking request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      await axios.post(`http://localhost:3001/api/booking-requests/${bookingId}/reject`, {
        barberId,
        reason: 'Schedule conflict',
      });
      toast.success('Booking request declined');
      fetchRequests();
    } catch (error) {
      console.error('Failed to reject booking:', error);
      toast.error('Failed to decline booking request');
    } finally {
      setActionLoading(null);
    }
  };

  const getReliabilityBadge = (profile: CustomerProfile) => {
    if (profile.stats.isReliable && profile.stats.completionRate >= 95) {
      return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Reliable</span>;
    } else if (profile.stats.completionRate >= 80) {
      return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">Good</span>;
    } else {
      return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Caution</span>;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Inbox Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Inbox className="w-6 h-6 text-gray-600" />
        {requests.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {requests.length > 9 ? '9+' : requests.length}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg">
            <h3 className="font-bold text-gray-900">Booking Requests ({requests.length})</h3>
          </div>

          {/* Requests List */}
          <div className="divide-y divide-gray-200">
            {requests.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No pending requests</p>
              </div>
            ) : (
              requests.map((request) => (
                <div key={request.bookingId} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Customer Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {request.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {request.customerName}
                        </h4>
                        {getReliabilityBadge(request.customerProfile)}
                      </div>
                      <p className="text-xs text-gray-500">{request.customerProfile.stats.completionRate}% completion</p>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="space-y-1 mb-3 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span>{new Date(request.requestedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-gray-400">at</span>
                      <span>{request.requestedTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Service:</span>
                      <span className="font-medium text-gray-900">{request.serviceType}</span>
                      <span className="text-gray-400">•</span>
                      <span className="font-semibold text-green-600">${request.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Message */}
                  {request.message && (
                    <div className="p-2 bg-blue-50 rounded text-xs text-gray-700 mb-3 line-clamp-2">
                      "{request.message}"
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(request.bookingId)}
                      disabled={actionLoading === request.bookingId}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReject(request.bookingId)}
                      disabled={actionLoading === request.bookingId}
                      variant="secondary"
                      className="flex-1 text-red-600 hover:bg-red-50 text-xs"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

