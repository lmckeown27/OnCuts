import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Award, Star, Calendar } from 'lucide-react';
import Card from './Card';
import Loading from './Loading';
import { Line } from 'react-chartjs-2';
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

// Register Chart.js components
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

type BarberPricingDashboardProps = {
  barberId: string;
};

type PriceData = {
  serviceId: number;
  serviceName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePct: number;
};

type PerformanceData = {
  totalBookings: number;
  totalRevenue: number;
  avgRating: number;
  totalReviews: number;
};

export default function BarberPricingDashboard({ barberId }: BarberPricingDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);

  useEffect(() => {
    loadPricingData();
  }, [barberId]);

  const loadPricingData = async () => {
    setIsLoading(true);

    // Mock data for development
    setTimeout(() => {
      setPerformanceData({
        totalBookings: 156,
        totalRevenue: 6240,
        avgRating: 4.8,
        totalReviews: 127,
      });

      setPrices([
        {
          serviceId: 1,
          serviceName: 'Haircut',
          currentPrice: 32.50,
          previousPrice: 30.00,
          priceChange: 2.50,
          priceChangePct: 8.3,
        },
        {
          serviceId: 2,
          serviceName: 'Haircut & Fade',
          currentPrice: 45.00,
          previousPrice: 42.00,
          priceChange: 3.00,
          priceChangePct: 7.1,
        },
        {
          serviceId: 3,
          serviceName: 'Beard Trim',
          currentPrice: 18.00,
          previousPrice: 18.00,
          priceChange: 0,
          priceChangePct: 0,
        },
      ]);

      // Generate mock revenue history (30 days)
      const history = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: 150 + Math.random() * 100,
        bookings: 4 + Math.floor(Math.random() * 4),
      }));

      setRevenueHistory(history);
      setIsLoading(false);
    }, 800);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  if (!performanceData) {
    return (
      <Card>
        <p className="text-center text-gray-600 py-8">No performance data available</p>
      </Card>
    );
  }

  const chartData = {
    labels: revenueHistory.map(h => h.date),
    datasets: [
      {
        label: 'Daily Revenue ($)',
        data: revenueHistory.map(h => h.revenue),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Daily Bookings',
        data: revenueHistory.map(h => h.bookings),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        tension: 0.4,
        borderDash: [5, 5],
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '30-Day Revenue & Booking Trends',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (context.datasetIndex === 0) {
                label += '$' + context.parsed.y.toFixed(0);
              } else {
                label += context.parsed.y.toFixed(0);
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Revenue ($)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Bookings',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Performance Overview - Public Stats Only */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Performance & Earnings</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Total Bookings */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900">{performanceData.totalBookings}</p>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">${performanceData.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Average Rating */}
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Average Rating</p>
                <p className="text-3xl font-bold text-gray-900">{performanceData.avgRating.toFixed(1)}</p>
              </div>
            </div>
          </div>

          {/* Total Reviews */}
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-6 h-6 text-primary-400" />
              <div>
                <p className="text-sm text-gray-600">Total Reviews</p>
                <p className="text-3xl font-bold text-gray-900">{performanceData.totalReviews}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            These are your public-facing statistics that customers can see. Keep providing excellent service to maintain and improve your ratings!
          </p>
        </div>
      </Card>

      {/* Current Prices */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Current Prices</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {prices.map((price) => (
            <div key={price.serviceId} className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">{price.serviceName}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">${price.currentPrice.toFixed(2)}</p>
                {price.priceChangePct !== 0 && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    price.priceChangePct > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {price.priceChangePct > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(price.priceChangePct).toFixed(1)}%
                  </div>
                )}
              </div>
              {price.previousPrice !== price.currentPrice && (
                <p className="text-xs text-gray-500 mt-1">
                  Previous: ${price.previousPrice.toFixed(2)} ({price.priceChange > 0 ? '+' : ''}${price.priceChange.toFixed(2)})
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Dynamic Pricing</p>
              <p className="text-xs text-blue-700 mt-1">
                Your prices are automatically optimized based on market conditions and customer demand.
                Continue providing excellent service to maximize your earnings.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Revenue & Booking Trends Chart */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Revenue & Booking Trends</h3>
        <div className="h-[300px]">
          <Line data={chartData} options={chartOptions} />
        </div>
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            Track your daily revenue and booking volume over the past 30 days. Consistent bookings and positive reviews help grow your business on CampusCut.
          </p>
        </div>
      </Card>
    </div>
  );
}

