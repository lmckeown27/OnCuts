import { useState, useEffect } from 'react';
import { Calendar, DollarSign, Star, TrendingUp } from 'lucide-react';
import { Booking } from '../../types';
import bookingService from '../../services/booking.service';
import { useAuthStore } from '../../store/useAuthStore';
import Loading from '../../components/Loading';
import Card from '../../components/Card';
import { format } from 'date-fns';

export default function BarberDashboardPage() {
  const { user } = useAuthStore();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const bookings = await bookingService.getUpcomingBookings(user!.id, 'barber');
      setUpcomingBookings(bookings);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <Loading fullScreen text="Loading dashboard..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Today's Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{upcomingBookings.length}</p>
            </div>
            <Calendar className="w-10 h-10 text-primary-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Today's Earnings</p>
              <p className="text-3xl font-bold text-gray-900">$0</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Average Rating</p>
              <p className="text-3xl font-bold text-gray-900">4.8</p>
            </div>
            <Star className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900">0</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
        {upcomingBookings.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No upcoming appointments</p>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <div key={booking.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-semibold">{booking.student?.first_name} {booking.student?.last_name}</h3>
                  <p className="text-sm text-gray-600">{booking.service_name}</p>
                  <p className="text-sm text-gray-600">{format(new Date(booking.scheduled_time), 'h:mm a')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">${booking.service_price}</p>
                  <p className="text-sm text-gray-600">{booking.location}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

