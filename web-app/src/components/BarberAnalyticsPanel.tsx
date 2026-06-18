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
  type BarberMetricsPeriod,
  type BarberMetricsDataPoint,
  type BarberPerformance,
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

type BarberView = 'performance' | 'clients' | 'operations' | 'payouts';

interface BarberAnalyticsPanelProps {
  performance: BarberPerformance;
  isLoadingPerformance: boolean;
  connectBusy: boolean;
  onOpenStripe: () => void;
}

function formatCurrencyFromCents(cents: number): string {
  return `$${((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)}`;
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function periodLabel(period: BarberMetricsPeriod): string {
  switch (period) {
    case '1w':
      return '1 Week';
    case '4w':
      return '4 Weeks';
    case 'mtd':
      return 'MTD';
    case 'qtd':
      return 'QTD';
    case 'ytd':
      return 'YTD';
    case '1y':
      return '1 Year';
    default:
      return 'All Time';
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

export default function BarberAnalyticsPanel({
  performance,
  isLoadingPerformance,
  connectBusy,
  onOpenStripe,
}: BarberAnalyticsPanelProps) {
  const [barberView, setBarberView] = useState<BarberView>('performance');
  const [metricsPeriod, setMetricsPeriod] = useState<BarberMetricsPeriod>('4w');
  const [metrics, setMetrics] = useState<BarberMetricsDataPoint[]>([]);
  const [metricsTotalClients, setMetricsTotalClients] = useState(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{
    label: string;
    revenue: number;
    bookings: number;
    clients: number;
  } | null>(null);
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

  const chartData = useMemo(() => {
    const labels = metrics.map((m) => {
      const date = new Date(m.date);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = String(date.getUTCFullYear()).slice(-2);
      if (['1w', '4w', 'mtd', 'qtd'].includes(metricsPeriod)) return `${month} ${day}`;
      if (['1y', 'ytd'].includes(metricsPeriod)) return `Week of ${month} ${day}`;
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

  const avgBookingsLabel = ['1w', '4w', 'mtd'].includes(metricsPeriod)
    ? 'Day'
    : ['1y', 'ytd', 'qtd'].includes(metricsPeriod)
      ? 'Wk'
      : 'Mo';
  const avgBookingsValue = ['1w', '4w', 'mtd'].includes(metricsPeriod)
    ? performance.averageBookingsPerDay
    : ['1y', 'ytd', 'qtd'].includes(metricsPeriod)
      ? performance.averageBookingsPerWeek
      : performance.averageBookingsPerMonth;
  const avgRevValue = ['1w', '4w', 'mtd'].includes(metricsPeriod)
    ? performance.averageRevenuePerDay
    : ['1y', 'ytd', 'qtd'].includes(metricsPeriod)
      ? performance.averageRevenuePerWeek
      : performance.averageRevenuePerMonth;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
        <button type="button" onClick={() => setBarberView('performance')} className={tabClass(barberView === 'performance')}>
          Performance
        </button>
        <button type="button" onClick={() => setBarberView('clients')} className={tabClass(barberView === 'clients')}>
          Clients
        </button>
        <button type="button" onClick={() => setBarberView('operations')} className={tabClass(barberView === 'operations')}>
          Operations
        </button>
        <button type="button" onClick={() => setBarberView('payouts')} className={tabClass(barberView === 'payouts')}>
          Payouts
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

            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              <div className="flex flex-wrap rounded-lg bg-gray-100 p-0.5 gap-0.5">
                {(
                  [
                    { key: '1w', label: '1W' },
                    { key: '4w', label: '4W' },
                    { key: 'mtd', label: 'MTD' },
                    { key: 'qtd', label: 'QTD' },
                    { key: 'ytd', label: 'YTD' },
                    { key: '1y', label: '1Y' },
                    { key: 'all', label: 'All' },
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
            </div>

            {isLoadingMetrics ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-5 h-5 border-2 border-primary-200 border-t-primary-500 rounded-full" />
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
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Card Bookings</p>
                        <p className="text-sm font-semibold text-gray-900">{performance.cardCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Cash Volume</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrencyFromCents(performance.cashRevenue)}</p>
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
                            : '—'}
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

                <div className="p-3 rounded-lg border-2 bg-primary-50 border-primary-300 sm:col-span-2">
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
                    <div className="flex justify-between border-t-2 pt-2 border-primary-400">
                      <span className="font-bold text-gray-900">= Estimated take-home</span>
                      <span className="font-bold text-lg text-primary-600">
                        {formatCurrencyFromCents(performance.totalBarberEarnings)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 italic pt-1">
                      Payouts settle through your Stripe Connect account—not a CampusCuts balance.
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
                        {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : '—'}
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
                          : '—'}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Unique clients</p>
            <p className="text-2xl font-semibold text-gray-900">{performance.uniqueClients}</p>
            <p className="text-xs text-gray-500 mt-1">Distinct customers with completed or paid appointments</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Repeat client rate</p>
            <p className="text-2xl font-semibold text-gray-900">{formatPct(performance.repeatClientPct)}</p>
            <p className="text-xs text-gray-500 mt-1">Clients who booked two or more times with you</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-2">
            <p className="text-[10px] text-gray-500">Average rating</p>
            <p className="text-2xl font-semibold text-gray-900">
              {performance.averageRating > 0 ? `${performance.averageRating.toFixed(1)} ★` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Based on {performance.totalReviews} review{performance.totalReviews === 1 ? '' : 's'}</p>
          </div>
        </div>
      )}

      {barberView === 'operations' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Pending requests</p>
            <p className="text-2xl font-semibold text-gray-900">{performance.pendingRequests}</p>
            <p className="text-xs text-gray-500 mt-1">Booking requests awaiting your approval</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Upcoming confirmed</p>
            <p className="text-2xl font-semibold text-gray-900">{performance.acceptedUpcoming}</p>
            <p className="text-xs text-gray-500 mt-1">Accepted appointments scheduled ahead</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Completion rate</p>
            <p className="text-2xl font-semibold text-gray-900">{formatPct(performance.completionRatePct)}</p>
            <p className="text-xs text-gray-500 mt-1">Finished vs cancellations and rejections</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500">Avg take-home / booking</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrencyFromCents(performance.averageTakeHomePerAppointment)}</p>
            <p className="text-xs text-gray-500 mt-1">Average estimated barber share per paid appointment</p>
          </div>
        </div>
      )}

      {barberView === 'payouts' && (
        <footer className="bg-slate-50 border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Stripe connected</span>
            </div>
            <p className="text-xs text-gray-500 truncate">
              Bank transfers, balances, and tax forms live in Stripe Express.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStripe}
            disabled={connectBusy}
            className="inline-flex items-center justify-center shrink-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-60"
          >
            Open Stripe
          </button>
        </footer>
      )}
    </div>
  );
}
