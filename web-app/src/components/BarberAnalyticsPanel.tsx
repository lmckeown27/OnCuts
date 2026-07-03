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
}

function formatCurrencyFromCents(cents: number): string {
  return `$${((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)}`;
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function periodLabel(period: BarberMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'Past Week';
    case 'weekly':
      return 'Past Month';
    case 'monthly':
      return 'Past Year';
  }
}

function periodDescription(period: BarberMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'Each day for the past week';
    case 'weekly':
      return 'Each week for the past month';
    case 'monthly':
      return 'Each month for the past year';
  }
}

function tabClass(active: boolean): string {
  return `px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
  }`;
}

function periodBtnClass(active: boolean): string {
  return `px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
  }`;
}

function formatServiceType(service: string): string {
  if (!service) return 'Service';
  return service.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'PAID') {
    return 'bg-green-100 text-green-700';
  }
  if (normalized === 'CANCELLED' || normalized === 'REJECTED') {
    return 'bg-red-100 text-red-700';
  }
  if (normalized === 'PENDING') {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-gray-100 text-gray-700';
}

export default function BarberAnalyticsPanel({
  performance,
  isLoadingPerformance,
}: BarberAnalyticsPanelProps) {
  const [barberView, setBarberView] = useState<BarberView>('performance');
  const [metricsPeriod, setMetricsPeriod] = useState<BarberMetricsPeriod>('weekly');
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
    const intervalId = setInterval(() => void load(false), 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [metricsPeriod]);

  useEffect(() => {
    if (barberView !== 'clients' || selectedClient) return;
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
  }, [barberView, selectedClient]);

  useEffect(() => {
    if (barberView !== 'clients') {
      setSelectedClient(null);
      setClientBookings([]);
    }
  }, [barberView]);

  const openClientDetail = async (client: BarberClientSummary) => {
    setSelectedClient(client);
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
      if (metricsPeriod === 'weekly') return `Week of ${month} ${day}`;
      return `${month} '${year}`;
    });
    return {
      labels,
      datasets: [
        {
          label: 'Volume ($)',
          data: metrics.map((m) => m.revenue / 100),
          borderColor: '#708d81',
          backgroundColor: 'rgba(112, 141, 129, 0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [metrics, metricsPeriod]);

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
        } else {
          setHoveredDataPoint(null);
        }
      },
    }),
    [metrics]
  );

  const periodVolume = metrics.reduce((sum, m) => sum + m.revenue, 0);
  const periodBookings = metrics.reduce((sum, m) => sum + m.bookings, 0);
  const periodClients = hoveredDataPoint ? hoveredDataPoint.clients : metricsTotalClients;

  const avgBookingsLabel = metricsPeriod === 'daily' ? 'Day' : metricsPeriod === 'weekly' ? 'Wk' : 'Mo';
  const avgBookingsValue =
    metricsPeriod === 'daily'
      ? performance.averageBookingsPerDay
      : metricsPeriod === 'weekly'
        ? performance.averageBookingsPerWeek
        : performance.averageBookingsPerMonth;
  const avgRevValue =
    metricsPeriod === 'daily'
      ? performance.averageRevenuePerDay
      : metricsPeriod === 'weekly'
        ? performance.averageRevenuePerWeek
        : performance.averageRevenuePerMonth;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
        <button type="button" onClick={() => setBarberView('performance')} className={tabClass(barberView === 'performance')}>
          Performance
        </button>
        <button type="button" onClick={() => setBarberView('clients')} className={tabClass(barberView === 'clients')}>
          Clients
        </button>
      </div>

      {barberView === 'performance' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Volume</p>
              <p className="font-semibold text-gray-900">
                {isLoadingPerformance ? '...' : formatCurrencyFromCents(performance.totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Take-home</p>
              <p className="font-semibold text-primary-600">
                {isLoadingPerformance ? '...' : formatCurrencyFromCents(performance.totalBarberEarnings)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Clients</p>
              <p className="font-semibold text-gray-900">
                {isLoadingPerformance ? '...' : performance.uniqueClients}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Bookings</p>
              <p className="font-semibold text-gray-900">
                {isLoadingPerformance ? '...' : performance.completedBookings}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Tips</p>
              <p className="font-semibold text-gray-900">
                {isLoadingPerformance ? '...' : formatCurrencyFromCents(performance.totalTips)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-3">
              <div className="text-center">
                <p className="text-gray-500 text-xs">{hoveredDataPoint ? 'Date' : 'Period'}</p>
                <p className="text-base font-semibold text-gray-900">
                  {hoveredDataPoint ? hoveredDataPoint.label : periodLabel(metricsPeriod)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs">Volume</p>
                <p className="text-base font-semibold text-gray-900">
                  {hoveredDataPoint
                    ? formatCurrencyFromCents(hoveredDataPoint.revenue)
                    : formatCurrencyFromCents(periodVolume)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs">Bookings</p>
                <p className="text-base font-semibold text-gray-900">
                  {hoveredDataPoint ? hoveredDataPoint.bookings : periodBookings}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs">Clients</p>
                <p className="text-base font-semibold text-gray-900">{periodClients}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5 mb-4">
              <div className="flex flex-wrap rounded-lg bg-gray-100 p-0.5 gap-0.5">
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
              <p className="text-[11px] text-gray-400">{periodDescription(metricsPeriod)}</p>
            </div>

            {isLoadingMetrics ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full" />
              </div>
            ) : metrics.length > 0 ? (
              <div
                ref={chartContainerRef}
                className="h-40 sm:h-48 mb-4 max-w-2xl mx-auto"
                onMouseLeave={() => setHoveredDataPoint(null)}
                onTouchEnd={() => setHoveredDataPoint(null)}
              >
                <Line data={chartData} options={chartOptions} plugins={[crosshairPlugin]} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm mb-4">
                No data available for this period
              </div>
            )}

            {!isLoadingPerformance && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(performance.cardCount > 0 || performance.cashCount > 0) && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">Payment Methods (All Time)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-gray-500">Card Volume</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(performance.cardRevenue)}</p>
                        {performance.cardTips > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            incl. {formatCurrencyFromCents(performance.cardTips)} tips
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Card Bookings</p>
                        <p className="text-sm font-semibold text-gray-900">{performance.cardCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Cash Volume</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(performance.cashRevenue)}</p>
                        {performance.cashTips > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            incl. {formatCurrencyFromCents(performance.cashTips)} tips
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Cash Bookings</p>
                        <p className="text-sm font-semibold text-gray-900">{performance.cashCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Earnings Breakdown</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-[10px] text-gray-500">Gross Volume</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(performance.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Platform (15%)</p>
                      <p className="text-sm font-semibold text-red-600">-{formatCurrencyFromCents(performance.totalPlatformFees)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Take-home</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrencyFromCents(performance.totalBarberEarnings)}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <p className="text-[10px] font-medium text-gray-600 mb-2">Tip Summary</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total tips collected</span>
                        <span className="text-gray-700">{formatCurrencyFromCents(performance.totalTips)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg tip per paid booking</span>
                        <span className="text-gray-700">
                          {performance.completedBookings > 0
                            ? formatCurrencyFromCents(Math.round(performance.totalTips / performance.completedBookings))
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Booking Pipeline</p>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-[10px] text-gray-500">Pending</p>
                      <p className="text-sm font-semibold text-gray-900">{performance.pendingRequests}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Upcoming</p>
                      <p className="text-sm font-semibold text-gray-900">{performance.acceptedUpcoming}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Completion</p>
                      <p className="text-sm font-semibold text-gray-900">{formatPct(performance.completionRatePct)}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <p className="text-[10px] font-medium text-gray-600 mb-2">Status Breakdown</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Completed / paid</span>
                        <span className="text-gray-700">{performance.completedBookings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cancelled</span>
                        <span className="text-gray-700">{performance.cancelledBookings}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border-2 bg-primary-50 border-gray-300 sm:col-span-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">Take-home Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gross checkout volume</span>
                      <span className="text-gray-900 font-medium">{formatCurrencyFromCents(performance.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">− Platform fee (15%)</span>
                      <span className="text-red-600 font-medium">-{formatCurrencyFromCents(performance.totalPlatformFees)}</span>
                    </div>
                    <div className="flex justify-between border-t-2 pt-2 border-gray-400">
                      <span className="font-bold text-gray-900">= Estimated take-home</span>
                      <span className="font-bold text-lg text-primary-600">
                        {formatCurrencyFromCents(performance.totalBarberEarnings)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 italic pt-1">
                      Payouts settle through your Stripe Connect account, not a Tivela balance.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">Averages</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-gray-500">Per Cut</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(performance.averageCostPerAppointment)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Cuts/{avgBookingsLabel}</p>
                      <p className="text-sm font-semibold text-gray-900">{avgBookingsValue.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Rev/{avgBookingsLabel}</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(avgRevValue)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t border-gray-200">
                    <div>
                      <p className="text-[10px] text-gray-500">Avg Star Rating</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Completion</p>
                      <p className="text-sm font-semibold text-gray-900">{formatPct(performance.completionRatePct)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Avg Tip</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {performance.completedBookings > 0
                          ? formatCurrencyFromCents(Math.round(performance.totalTips / performance.completedBookings))
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {barberView === 'clients' && (
        <div className="space-y-4 text-sm">
          {!selectedClient ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Your clients</h3>
                <span className="text-xs text-gray-500">{clients.length} unique</span>
              </div>

              {isLoadingClients ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full" />
                </div>
              ) : clientsError ? (
                <p className="text-sm text-red-600 text-center py-8">{clientsError}</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No clients with completed or paid bookings yet.</p>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.consumer_id}
                      type="button"
                      onClick={() => void openClientDetail(client)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          {client.avatar_url ? (
                            <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-gray-500">
                              {client.first_name.charAt(0)}
                              {client.last_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {client.first_name} {client.last_name}
                            </p>
                            {client.is_repeat && (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                                Repeat
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{client.email}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                            <span>{client.paid_booking_count} paid booking{client.paid_booking_count === 1 ? '' : 's'}</span>
                            <span>{client.total_booking_count} total</span>
                            <span>{formatCurrencyFromCents(client.total_paid_cents)} volume</span>
                            {client.avg_review_rating > 0 && (
                              <span>{client.avg_review_rating.toFixed(1)} ★ avg</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Last booking {formatDateTime(client.last_booking_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div>
              <button
                type="button"
                onClick={closeClientDetail}
                className="text-sm text-gray-600 hover:text-gray-900 mb-3"
              >
                ← Back to clients
              </button>

              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  {selectedClient.avatar_url ? (
                    <img src={selectedClient.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-gray-500">
                      {selectedClient.first_name.charAt(0)}
                      {selectedClient.last_name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{selectedClient.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedClient.paid_booking_count} paid · {selectedClient.total_booking_count} total ·{' '}
                    {formatCurrencyFromCents(selectedClient.total_paid_cents)} volume
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">Booking history</h3>
                <span className="text-xs text-gray-500">{clientBookings.length} bookings</span>
              </div>

              {isLoadingClientBookings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full" />
                </div>
              ) : clientBookings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No bookings found for this client.</p>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                  {clientBookings.map((booking) => (
                    <div key={booking.id} className="p-3 rounded-lg border border-gray-200 bg-white">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(booking.status)}`}>
                            {booking.status}
                          </span>
                          {(booking.status === 'COMPLETED' || booking.status === 'PAID') && booking.payment_method && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-900 text-white">
                              {booking.payment_method === 'card' ? 'Card' : 'Cash'}
                            </span>
                          )}
                          {booking.review_rating != null && (
                            <span className="text-xs text-amber-600">{booking.review_rating} ★</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatCurrencyFromCents(booking.total_paid_cents ?? booking.price_cents + (booking.tip_cents || 0))}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-gray-900">{formatServiceType(booking.service_type)}</p>
                      <p className="text-xs text-gray-500 mt-1">Scheduled {formatDateTime(booking.scheduled_time)}</p>
                      {booking.paid_at && (
                        <p className="text-xs text-gray-500">Paid {formatDateTime(booking.paid_at)}</p>
                      )}
                      {booking.review_text && (
                        <p className="text-xs text-gray-600 mt-2 italic border-t border-gray-100 pt-2">
                          &ldquo;{booking.review_text}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
