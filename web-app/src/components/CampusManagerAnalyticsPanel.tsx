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
  fetchCampusManagerMetrics,
  type CampusMetricsPeriod,
  type CampusMetricsDataPoint,
  type CampusManagerPerformance,
} from '../services/campus-manager-metrics.service';

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

interface CampusManagerAnalyticsPanelProps {
  campusId: string;
  campusName: string;
  performance: CampusManagerPerformance;
  isLoadingPerformance: boolean;
}

function formatCurrencyFromCents(cents: number): string {
  return `$${((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)}`;
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

function periodLabel(period: CampusMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'Past Week';
    case 'weekly':
      return 'Past Month';
    case 'monthly':
      return 'Past Year';
  }
}

function periodDescription(period: CampusMetricsPeriod): string {
  switch (period) {
    case 'daily':
      return 'Each day for the past week';
    case 'weekly':
      return 'Each week for the past month';
    case 'monthly':
      return 'Each month for the past year';
  }
}

function periodBtnClass(active: boolean): string {
  return `px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
  }`;
}

export default function CampusManagerAnalyticsPanel({
  campusId,
  campusName,
  performance,
  isLoadingPerformance,
}: CampusManagerAnalyticsPanelProps) {
  const [metricsPeriod, setMetricsPeriod] = useState<CampusMetricsPeriod>('weekly');
  const [metrics, setMetrics] = useState<CampusMetricsDataPoint[]>([]);
  const [metricsTotalUsers, setMetricsTotalUsers] = useState(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{
    label: string;
    revenue: number;
    bookings: number;
    users: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (showLoading = true) => {
      if (showLoading) setIsLoadingMetrics(true);
      try {
        const res = await fetchCampusManagerMetrics(campusId, metricsPeriod);
        if (!cancelled) {
          setMetrics(res.data || []);
          setMetricsTotalUsers(res.totalUsers || 0);
        }
      } catch {
        if (!cancelled) {
          setMetrics([]);
          setMetricsTotalUsers(0);
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
  }, [campusId, metricsPeriod]);

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
      id: 'campusManagerCrosshair',
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
              users: m.users || 0,
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
  const periodUsers = hoveredDataPoint ? hoveredDataPoint.users : metricsTotalUsers;

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
        <div>
          <p className="text-gray-500 text-xs">{campusName} Volume</p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : formatCurrencyFromCents(performance.totalRevenue)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Bookings</p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : performance.completedBookings}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Barbers</p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : performance.activeBarbers}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Consumers</p>
          <p className="font-semibold text-gray-900">
            {isLoadingPerformance ? '...' : performance.totalConsumers}
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
            <p className="text-gray-500 text-xs">Consumers</p>
            <p className="text-base font-semibold text-gray-900">{periodUsers}</p>
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
              <p className="text-xs font-medium text-gray-700 mb-2">Booking Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Completed</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.completedBookings}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Cancelled</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.cancelledBookings}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Completion</p>
                  <p className="text-sm font-semibold text-gray-900">{formatPct(performance.completionRatePct)}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-[10px] font-medium text-gray-600 mb-2">Tips</p>
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
              <p className="text-xs font-medium text-gray-700 mb-2">Campus Overview</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-500">Active Barbers</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.activeBarbers}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total Barbers</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.totalBarbers}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Consumers</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.totalConsumers}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Avg Rating</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {performance.averageRating > 0 ? performance.averageRating.toFixed(1) : '—'}
                  </p>
                </div>
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
                  <p className="text-[10px] text-gray-500">Reviews</p>
                  <p className="text-sm font-semibold text-gray-900">{performance.totalReviews}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Completion</p>
                  <p className="text-sm font-semibold text-gray-900">{formatPct(performance.completionRatePct)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
