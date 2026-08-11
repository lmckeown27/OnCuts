import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ChevronRight, X } from 'lucide-react';
import {
  fetchBarberMetrics,
  fetchBarberClients,
  fetchBarberClientBookings,
  type BarberMetricsPeriod,
  type BarberMetricsDataPoint,
  type BarberPerformance,
  type BarberClientSummary,
  type BarberClientBooking,
} from '../services/barber-payout.service';
import { colors } from '../utils/colors';
import PullToRefresh from './PullToRefresh';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type BarberView = 'performance' | 'clients';

interface BarberAnalyticsPanelProps {
  performance: BarberPerformance;
  isLoadingPerformance: boolean;
  /** Increment to force metrics/clients reload (pull-to-refresh). */
  refreshSignal?: number;
  onRefresh?: () => Promise<void> | void;
}

function formatCurrencyFromCents(cents: number): string {
  return `$${((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)}`;
}

function chartTitle(period: BarberMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'Daily Revenue';
    case 'weekly':
      return 'Weekly Revenue';
    case 'monthly':
      return 'Monthly Revenue';
  }
}

function bucketNoun(period: BarberMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'day';
    case 'weekly':
      return 'week';
    case 'monthly':
      return 'month';
  }
}

function tabClass(active: boolean): string {
  return `flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
  }`;
}

function periodBtnClass(active: boolean): string {
  return `flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
  }`;
}

function formatServiceType(service: string): string {
  if (!service) return 'Service';
  return service.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'PAID') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (normalized === 'CANCELLED' || normalized === 'REJECTED') {
    return 'bg-red-100 text-red-700';
  }
  if (normalized === 'PENDING') {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-stone-100 text-stone-700';
}

export default function BarberAnalyticsPanel({
  performance,
  isLoadingPerformance,
  refreshSignal = 0,
  onRefresh,
}: BarberAnalyticsPanelProps) {
  const olive = colors.olive.DEFAULT;
  const [barberView, setBarberView] = useState<BarberView>('performance');
  const [metricsPeriod, setMetricsPeriod] = useState<BarberMetricsPeriod>('daily');
  const [metrics, setMetrics] = useState<BarberMetricsDataPoint[]>([]);
  const [metricsTotalClients, setMetricsTotalClients] = useState(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{
    label: string;
    revenue: number;
    bookings: number;
    clients: number;
  } | null>(null);
  const [clients, setClients] = useState<BarberClientSummary[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<BarberClientSummary | null>(null);
  const [clientBookings, setClientBookings] = useState<BarberClientBooking[]>([]);
  const [isLoadingClientBookings, setIsLoadingClientBookings] = useState(false);
  const [clientSheetVisible, setClientSheetVisible] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (showLoading = true) => {
      if (showLoading) setIsLoadingMetrics(true);
      try {
        const res = await fetchBarberMetrics(metricsPeriod);
        if (!cancelled) {
          setMetrics(res.data || []);
          setMetricsTotalClients(res.totalClients || 0);
          setHoveredDataPoint(null);
        }
      } catch {
        if (!cancelled) {
          setMetrics([]);
          setMetricsTotalClients(0);
        }
      } finally {
        if (!cancelled && showLoading) setIsLoadingMetrics(false);
      }
    };
    void load(true);
    return () => {
      cancelled = true;
    };
  }, [metricsPeriod, refreshSignal]);

  useEffect(() => {
    if (barberView !== 'clients') return;
    let cancelled = false;
    const loadClients = async () => {
      setIsLoadingClients(true);
      setClientsError(null);
      try {
        const data = await fetchBarberClients();
        if (!cancelled) setClients(data);
      } catch {
        if (!cancelled) {
          setClients([]);
          setClientsError('Could not load clients');
        }
      } finally {
        if (!cancelled) setIsLoadingClients(false);
      }
    };
    void loadClients();
    return () => {
      cancelled = true;
    };
  }, [barberView, refreshSignal]);

  useEffect(() => {
    if (barberView !== 'clients') {
      setSelectedClient(null);
      setClientBookings([]);
      setClientSheetVisible(false);
    }
  }, [barberView]);

  const openClientDetail = async (client: BarberClientSummary) => {
    setSelectedClient(client);
    setClientSheetVisible(true);
    setClientBookings([]);
    setIsLoadingClientBookings(true);
    try {
      const bookings = await fetchBarberClientBookings(client.consumer_id);
      setClientBookings(bookings);
    } catch {
      setClientBookings([]);
    } finally {
      setIsLoadingClientBookings(false);
    }
  };

  const closeClientDetail = () => {
    setClientSheetVisible(false);
    setSelectedClient(null);
    setClientBookings([]);
  };

  const chartData = useMemo(() => {
    const labels = metrics.map((m) => {
      const date = new Date(m.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = String(date.getUTCFullYear()).slice(-2);
      if (metricsPeriod === 'daily') return `${month} ${day}`;
      if (metricsPeriod === 'weekly') return `Wk ${month} ${day}`;
      return `${month} '${year}`;
    });
    return {
      labels,
      datasets: [
        {
          label: 'Revenue ($)',
          data: metrics.map((m) => m.revenue / 100),
          borderColor: olive,
          backgroundColor: 'rgba(112, 141, 129, 0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [metrics, metricsPeriod, olive]);

  const crosshairPlugin = useMemo(
    () => ({
      id: 'barberCrosshair',
      afterDraw: (chart: any) => {
        if (chart.tooltip?._active?.length) {
          const activePoint = chart.tooltip._active[0];
          const ctx = chart.ctx;
          const x = activePoint.element.x;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, chart.scales.y.top);
          ctx.lineTo(x, chart.scales.y.bottom);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(112, 141, 129, 0.5)';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }
      },
    }),
    []
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 0, right: 8, top: 8, bottom: 0 } },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { callback: (value: any) => `$${value}` },
        },
      },
      hover: { mode: 'index' as const, intersect: false },
      onHover: (_event: any, activeElements: any[], chart: any) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const m = metrics[index];
          if (m) {
            setHoveredDataPoint({
              label: chart.data.labels[index] || m.date,
              revenue: m.revenue,
              bookings: m.bookings,
              clients: m.clients || 0,
            });
          }
        }
      },
    }),
    [metrics]
  );

  const periodVolume = metrics.reduce((sum, m) => sum + m.revenue, 0);
  const periodBookings = metrics.reduce((sum, m) => sum + m.bookings, 0);
  const periodClients = metricsTotalClients;

  const displayVolume = hoveredDataPoint ? hoveredDataPoint.revenue : periodVolume;
  const displayBookings = hoveredDataPoint ? hoveredDataPoint.bookings : periodBookings;
  const displayClients = hoveredDataPoint ? hoveredDataPoint.clients : periodClients;

  const avgRevenueCents =
    metrics.length > 0 ? Math.round(periodVolume / metrics.length) : 0;
  const avgBookings =
    metrics.length > 0 ? periodBookings / metrics.length : 0;
  const bestBucket = metrics.reduce<BarberMetricsDataPoint | null>((best, m) => {
    if (!best || m.revenue > best.revenue) return m;
    return best;
  }, null);
  const bestBookingsBucket = metrics.reduce<BarberMetricsDataPoint | null>((best, m) => {
    if (!best || m.bookings > best.bookings) return m;
    return best;
  }, null);

  // Platform fees apply to card payments; take-home is earnings after fees.
  const paymentTakeHome = Math.max(0, performance.totalBarberEarnings - performance.cashRevenue);

  const handlePanelRefresh = async () => {
    await onRefresh?.();
  };

  return (
    <div className="relative flex flex-col min-h-0 flex-1">
      <div className="px-4 sm:px-5 pt-1 pb-3 shrink-0">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => setBarberView('performance')}
            className={tabClass(barberView === 'performance')}
          >
            Performance
          </button>
          <button
            type="button"
            onClick={() => setBarberView('clients')}
            className={tabClass(barberView === 'clients')}
          >
            Clients
          </button>
        </div>
      </div>

      <PullToRefresh
        scoped
        onRefresh={handlePanelRefresh}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 pb-6"
      >
        {barberView === 'performance' && (
          <div className="space-y-4">
            {/* Summary strip — scoped to chart timeline (or selected bucket) */}
            <div className="grid grid-cols-3 divide-x divide-stone-200 rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-2 py-3 text-center">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Volume</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900 tabular-nums">
                  {isLoadingMetrics ? '…' : formatCurrencyFromCents(displayVolume)}
                </p>
              </div>
              <div className="px-2 py-3 text-center">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Bookings</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900 tabular-nums">
                  {isLoadingMetrics ? '…' : displayBookings}
                </p>
              </div>
              <div className="px-2 py-3 text-center">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Clients</p>
                <p className="mt-1 text-base sm:text-lg font-semibold text-gray-900 tabular-nums">
                  {isLoadingMetrics ? '…' : displayClients}
                </p>
              </div>
            </div>

            {/* Timeline chart card */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <h3 className="text-center text-base font-semibold text-gray-900">
                {chartTitle(metricsPeriod)}
              </h3>

              <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
                {(
                  [
                    { key: 'daily', label: 'Daily' },
                    { key: 'weekly', label: 'Weekly' },
                    { key: 'monthly', label: 'Monthly' },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMetricsPeriod(key)}
                    className={periodBtnClass(metricsPeriod === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="animate-spin rounded-full h-7 w-7 border-2 border-stone-200 border-t-transparent"
                    style={{ borderTopColor: olive }}
                  />
                </div>
              ) : metrics.length > 0 ? (
                <div
                  ref={chartContainerRef}
                  className="h-44 sm:h-52"
                  onMouseLeave={() => setHoveredDataPoint(null)}
                  onTouchEnd={() => setHoveredDataPoint(null)}
                >
                  <Line data={chartData} options={chartOptions} plugins={[crosshairPlugin]} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                  No revenue in this window yet
                </div>
              )}

              {!hoveredDataPoint && metrics.length > 0 && (
                <p className="text-center text-xs text-gray-400">
                  Press and drag on the chart to inspect a {bucketNoun(metricsPeriod)}.
                </p>
              )}
              {hoveredDataPoint && (
                <p className="text-center text-xs font-medium text-gray-600">
                  {hoveredDataPoint.label}: {formatCurrencyFromCents(hoveredDataPoint.revenue)} ·{' '}
                  {hoveredDataPoint.bookings} booking{hoveredDataPoint.bookings === 1 ? '' : 's'} ·{' '}
                  {hoveredDataPoint.clients} client{hoveredDataPoint.clients === 1 ? '' : 's'}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">Avg / {bucketNoun(metricsPeriod)}</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrencyFromCents(avgRevenueCents)}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">Best {bucketNoun(metricsPeriod)}</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {bestBucket ? formatCurrencyFromCents(bestBucket.revenue) : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">Avg bookings</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {avgBookings.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">Peak bookings</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {bestBookingsBucket ? bestBookingsBucket.bookings : '—'}
                  </p>
                </div>
              </div>
            </section>

            {/* Payment statistics — All time */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Payments</h3>
                <p className="text-sm text-gray-500">All time</p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Volume</p>
                  <p className="font-semibold text-gray-900 tabular-nums">
                    {isLoadingPerformance ? '…' : formatCurrencyFromCents(performance.cardRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Paid bookings</p>
                  <p className="font-semibold text-gray-900 tabular-nums">
                    {isLoadingPerformance ? '…' : performance.cardCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Platform fee</p>
                  <p className="font-semibold text-red-600 tabular-nums">
                    {isLoadingPerformance
                      ? '…'
                      : `−${formatCurrencyFromCents(performance.totalPlatformFees)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Take-home</p>
                  <p className="font-semibold tabular-nums" style={{ color: olive }}>
                    {isLoadingPerformance ? '…' : formatCurrencyFromCents(paymentTakeHome)}
                  </p>
                </div>
              </div>
            </section>

            {/* Estimated net take-home hero */}
            <section
              className="rounded-2xl p-4 text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${colors.olive[500]} 0%, ${colors.olive.DEFAULT} 45%, ${colors.olive[700]} 100%)`,
              }}
            >
              <p className="text-sm font-semibold text-white/90 text-center mb-2">
                Estimated net take-home
              </p>
              <p className="text-center text-2xl font-bold tabular-nums">
                {isLoadingPerformance ? '…' : formatCurrencyFromCents(paymentTakeHome)}
              </p>
            </section>
          </div>
        )}

        {barberView === 'clients' && (
          <div className="space-y-4">
            <p className="text-center text-sm font-medium text-gray-600">
              {isLoadingClients
                ? 'Loading clients…'
                : `${clients.length} client${clients.length === 1 ? '' : 's'}`}
            </p>

            {isLoadingClients ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="animate-spin rounded-full h-7 w-7 border-2 border-stone-200 border-t-transparent"
                  style={{ borderTopColor: olive }}
                />
              </div>
            ) : clientsError ? (
              <p className="text-sm text-red-600 text-center py-8">{clientsError}</p>
            ) : clients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center">
                <p className="text-sm font-medium text-gray-700">No clients yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Clients with completed or paid bookings will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => (
                  <button
                    key={client.consumer_id}
                    type="button"
                    onClick={() => void openClientDetail(client)}
                    className="w-full text-left rounded-2xl border border-stone-200 bg-white px-3.5 py-3 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          <span>
                            {client.paid_booking_count || client.total_booking_count} booking
                            {(client.paid_booking_count || client.total_booking_count) === 1
                              ? ''
                              : 's'}
                          </span>
                          <span>{formatCurrencyFromCents(client.total_paid_cents)} lifetime</span>
                          <span>Last {formatShortDate(client.last_booking_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* Nested client bookings sheet */}
      {clientSheetVisible && selectedClient && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Dismiss client sheet"
            onClick={closeClientDetail}
          />
          <div
            className="relative z-10 flex flex-col w-full sm:max-w-md max-h-[88%] rounded-t-2xl sm:rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Client bookings"
          >
            <div className="flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>
            <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-stone-200 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {selectedClient.first_name} {selectedClient.last_name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedClient.paid_booking_count} paid ·{' '}
                  {formatCurrencyFromCents(selectedClient.total_paid_cents)} lifetime · Last{' '}
                  {formatShortDate(selectedClient.last_booking_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeClientDetail}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors shrink-0"
                aria-label="Close client detail"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
              {isLoadingClientBookings ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="animate-spin rounded-full h-7 w-7 border-2 border-stone-200 border-t-transparent"
                    style={{ borderTopColor: olive }}
                  />
                </div>
              ) : clientBookings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No bookings for this client.</p>
              ) : (
                clientBookings.map((booking) => {
                  const amount =
                    booking.total_paid_cents ?? booking.price_cents + (booking.tip_cents || 0);
                  const paidStatuses = booking.status === 'COMPLETED' || booking.status === 'PAID';
                  return (
                    <div
                      key={booking.id}
                      className="rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-3 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900">
                          {formatServiceType(booking.service_type)}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                          {formatCurrencyFromCents(amount)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(booking.status)}`}
                        >
                          {booking.status}
                        </span>
                        {paidStatuses && booking.payment_method && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-stone-800 text-white">
                            {booking.payment_method === 'card' ? 'Card' : 'Cash'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Scheduled {formatDateTime(booking.scheduled_time)}
                      </p>
                      {booking.paid_at && (
                        <p className="text-xs text-gray-500">Paid {formatDateTime(booking.paid_at)}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
