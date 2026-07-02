/**
 * Consumer view of bookings: Upcoming (future dates), Today (current), Past (history).
 * Data: GET /api/v1/bookings-simple?role=consumer
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.service';
import barberService from '../../services/barber.service';
import { useAuthStore } from '../../store/useAuthStore';
import Button from '../../components/Button';
import { TivelaPlatformsLogo } from '@assets';
import Avatar from '../../components/Avatar';

type Tab = 'upcoming' | 'today' | 'past';

interface BookingRow {
  id: string;
  barberId?: string;
  scheduledTime: string;
  status: string;
  serviceType?: string;
  serviceName?: string | null;
  priceUsdCents?: number;
  location?: string | null;
  barberName?: string;
  barberAvatar?: string | null;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Aligns with barber BookingsModal buckets, adapted for consumer statuses (PENDING, etc.). */
function consumerBookingTab(booking: { scheduledTime: string; status: string }): Tab {
  const status = (booking.status || '').toUpperCase();
  if (['PAID', 'CANCELLED', 'REJECTED'].includes(status)) return 'past';

  const sched = new Date(booking.scheduledTime);
  const today = new Date();
  const sk = ymd(sched);
  const tk = ymd(today);

  if (sk < tk) return 'past';
  if (sk === tk) return 'today';
  return 'upcoming';
}

function formatService(booking: BookingRow): string {
  const raw = booking.serviceName || booking.serviceType || 'Service';
  if (!raw) return 'Service';
  return raw
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: string): { label: string; className: string } {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'PENDING':
      return { label: 'Pending', className: 'bg-amber-100 text-amber-800' };
    case 'ACCEPTED':
      return { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' };
    case 'COMPLETED':
      return { label: 'Awaiting payment', className: 'bg-purple-100 text-purple-800' };
    case 'PAID':
      return { label: 'Paid', className: 'bg-green-100 text-green-800' };
    case 'CANCELLED':
    case 'REJECTED':
      return { label: s === 'REJECTED' ? 'Declined' : 'Cancelled', className: 'bg-gray-200 text-gray-700' };
    default:
      return { label: s || '-', className: 'bg-gray-100 text-gray-700' };
  }
}

export default function ConsumerBookingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const { user, isLoading: authLoading } = useAuthStore();

  const [tab, setTab] = useState<Tab>('today');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get<{ bookings: BookingRow[] }>('/bookings-simple', {
        role: 'consumer',
        _t: Date.now(),
      });
      const list = response.bookings || (response as any).data?.bookings || [];
      setBookings(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(platformPrefix === '/app' ? '/app' : '/web', { replace: true });
      return;
    }
    if (user) load();
  }, [user, authLoading, load, navigate, platformPrefix]);

  const filtered = bookings
    .filter((b) => consumerBookingTab(b) === tab)
    .sort((a, b) => {
      const ta = new Date(a.scheduledTime).getTime();
      const tb = new Date(b.scheduledTime).getTime();
      return tab === 'past' ? tb - ta : ta - tb;
    });

  const goMessages = async (booking: BookingRow) => {
    let otherUserId: string | undefined;
    if (booking.barberId) {
      try {
        const barber = await barberService.getBarberById(booking.barberId);
        otherUserId = barber.user_id;
      } catch {
        toast.error('Could not load barber for messaging');
        return;
      }
    }
    if (!otherUserId) {
      toast.error('Missing barber for this booking');
      return;
    }
    navigate(`${platformPrefix}/consumer/messages`, {
      state: {
        startConversation: true,
        otherUserId,
        bookingId: booking.id,
        serviceName: formatService(booking),
        servicePrice: (booking.priceUsdCents || 0) / 100,
        scheduledAt: booking.scheduledTime,
        location: booking.location,
        barberName: booking.barberName,
      },
    });
  };

  const goPay = (bookingId: string) => {
    navigate(`${platformPrefix}/payment/${bookingId}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`${platformPrefix}/consumer`)}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <img src={TivelaPlatformsLogo} alt="" className="h-9 w-auto" />
        <h1 className="text-lg font-bold text-gray-900">My bookings</h1>
      </header>

      <div className="px-3 pt-3 pb-2 flex gap-1 bg-gray-50 border-b border-gray-200">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['today', 'Today'],
            ['past', 'Past'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              tab === key
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No bookings here</p>
            <p className="text-sm text-gray-500 mt-1">
              {tab === 'upcoming' && 'You have no upcoming appointments.'}
              {tab === 'today' && 'Nothing scheduled for today.'}
              {tab === 'past' && 'Past appointments will show up here.'}
            </p>
            <Button className="mt-6" onClick={() => navigate(`${platformPrefix}/consumer`)}>
              Find a barber
            </Button>
          </div>
        ) : (
          <ul className="space-y-3 max-w-lg mx-auto">
            {filtered.map((b) => {
              const badge = statusBadge(b.status);
              const when = new Date(b.scheduledTime);
              const dateStr = when.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const timeStr = when.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });
              const price =
                b.priceUsdCents != null ? `$${(b.priceUsdCents / 100).toFixed(2)}` : '-';

              return (
                <li
                  key={b.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={b.barberAvatar || undefined}
                      alt={b.barberName || 'Barber'}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 truncate">
                          {b.barberName || 'Barber'}
                        </p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{formatService(b)}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
                        {dateStr}
                        <span className="mx-1">·</span>
                        <Clock className="w-4 h-4 shrink-0 text-gray-400" />
                        {timeStr}
                      </div>
                      {b.location ? (
                        <div className="flex items-start gap-1.5 mt-1 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                          <span>{b.location}</span>
                        </div>
                      ) : null}
                      <p className="text-sm font-medium text-primary-600 mt-2">{price}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                    {b.status?.toUpperCase() === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex items-center gap-1.5"
                        onClick={() => goPay(b.id)}
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay now
                      </Button>
                    )}
                    {['PENDING', 'ACCEPTED', 'COMPLETED'].includes(
                      (b.status || '').toUpperCase()
                    ) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5"
                        onClick={() => goMessages(b)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Message
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigate(`${platformPrefix}/consumer/booking-status`)
                      }
                    >
                      Booking status
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
