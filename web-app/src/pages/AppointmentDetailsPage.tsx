import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, DollarSign, User, Phone, Mail, MessageCircle, CheckCircle, XCircle, Star, Calendar, AlertCircle } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { CampusCutsLogo } from '@assets';

export default function AppointmentDetailsPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  // Mock appointment data - in production, fetch from API
  const appointment = {
    id: appointmentId || '1',
    time: '10:00 AM',
    date: 'Today, Dec 12, 2025',
    client: {
      name: 'John Doe',
      email: 'john.doe@college.edu',
      phone: '(555) 123-4567',
      avatar: null,
      studentId: 'STU-2024-001',
      totalBookings: 12,
      completedBookings: 11,
      cancelledBookings: 1,
      reliabilityScore: 92,
      avgRating: 4.7,
      memberSince: 'Jan 2024',
    },
    service: {
      name: 'Haircut & Fade',
      duration: '45 min',
      notes: 'Looking for a mid-fade with texture on top, similar to last time',
    },
    location: {
      type: 'My Dorm',
      address: 'Yosemite Hall, Room 304',
      instructions: 'Third floor, take elevator. Will meet you in lobby.',
    },
    price: {
      service: 35.00,
      platformFee: 1.75,
      total: 36.75,
      paymentMethod: 'Escrow (Blockchain)',
    },
    status: 'confirmed',
    bookedAt: '2 hours ago',
    blockchainTx: '0x7f8a...3d2c',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/barber')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Appointment Details</h1>
                <p className="text-sm text-gray-600">ID: #{appointment.id}</p>
              </div>
            </div>
            <img src={CampusCutsLogo} alt="CampusCuts" className="h-8" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        
        {/* Status & Quick Actions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{appointment.service.name}</h2>
              <p className="text-gray-600">{appointment.date} at {appointment.time}</p>
            </div>
            <div className={`px-4 py-2 rounded-full border-2 font-semibold uppercase text-sm ${getStatusColor(appointment.status)}`}>
              {appointment.status}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="primary" className="w-full">
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            <Button variant="secondary" className="w-full">
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
            <Button variant="success" className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
            <Button variant="danger" className="w-full">
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </Card>

        {/* Customer Information */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Customer Information
          </h3>
          
          <div className="space-y-4">
            {/* Customer Profile */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {appointment.client.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-gray-900">{appointment.client.name}</h4>
                <p className="text-sm text-gray-600">Student ID: {appointment.client.studentId}</p>
                <p className="text-sm text-gray-600">Member since {appointment.client.memberSince}</p>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium">{appointment.client.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="font-medium">{appointment.client.phone}</p>
                </div>
              </div>
            </div>

            {/* Customer Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{appointment.client.totalBookings}</p>
                <p className="text-xs text-gray-600">Total Bookings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{appointment.client.completedBookings}</p>
                <p className="text-xs text-gray-600">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{appointment.client.avgRating}</p>
                <p className="text-xs text-gray-600">Avg Rating</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${getReliabilityColor(appointment.client.reliabilityScore)}`}>
                  {appointment.client.reliabilityScore}%
                </p>
                <p className="text-xs text-gray-600">Reliability</p>
              </div>
            </div>

            {/* Reliability Badge */}
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Reliable Customer</p>
                <p className="text-sm text-green-700">High show-up rate, rarely cancels</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Service Details */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-indigo-600" />
            Service Details
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="font-semibold text-gray-900">Duration</p>
                <p className="text-gray-600">{appointment.service.duration}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="font-semibold text-gray-900">Scheduled Time</p>
                <p className="text-gray-600">{appointment.date} at {appointment.time}</p>
                <p className="text-sm text-gray-500">Booked {appointment.bookedAt}</p>
              </div>
            </div>

            {appointment.service.notes && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-semibold text-yellow-900 mb-1">Customer Notes:</p>
                <p className="text-yellow-800">{appointment.service.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Location Details */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Location Details
          </h3>
          
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-gray-900">{appointment.location.type}</p>
              <p className="text-gray-600">{appointment.location.address}</p>
            </div>
            
            {appointment.location.instructions && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-900 mb-1">Instructions:</p>
                <p className="text-blue-800">{appointment.location.instructions}</p>
              </div>
            )}

            <Button variant="secondary" className="w-full">
              <MapPin className="w-4 h-4 mr-2" />
              Open in Maps
            </Button>
          </div>
        </Card>

        {/* Payment Information */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            Payment Information
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Service Fee</span>
              <span className="font-semibold text-gray-900">${appointment.price.service.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Platform Fee (5%)</span>
              <span className="font-semibold text-gray-900">${appointment.price.platformFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Amount</span>
              <span className="font-bold text-2xl text-green-600">${appointment.price.total.toFixed(2)}</span>
            </div>
            
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-indigo-900">Payment Status</p>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                  ESCROWED
                </span>
              </div>
              <p className="text-sm text-indigo-800 mb-2">
                Funds are securely held in blockchain escrow. You'll receive payment after service completion.
              </p>
              <div className="flex items-center gap-2 text-xs text-indigo-700">
                <span className="font-mono bg-indigo-100 px-2 py-1 rounded">
                  TX: {appointment.blockchainTx}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action History */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Timeline</h3>
          
          <div className="space-y-4">
            {[
              { time: '2 hours ago', action: 'Booking confirmed', status: 'success' },
              { time: '2 hours ago', action: 'Payment escrowed on blockchain', status: 'success' },
              { time: '2 hours ago', action: 'Customer sent booking request', status: 'info' },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }`}></div>
                <div>
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}

