import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Award, Info, Clock } from 'lucide-react';
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

type PerformanceScore = {
  qualityScore: number;
  reliabilityScore: number;
  demandScore: number;
  performanceScore: number;
  effectiveScore: number;
  isNewBarber: boolean;
  totalLifetimeBookings: number;
};

type PriceData = {
  serviceId: number;
  serviceName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePct: number;
};

export default function BarberPricingDashboard({ barberId }: BarberPricingDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    loadPricingData();
  }, [barberId]);

  const loadPricingData = async () => {
    setIsLoading(true);

    // Mock data for development
    setTimeout(() => {
      setPerformanceScore({
        qualityScore: 92,
        reliabilityScore: 88,
        demandScore: 75,
        performanceScore: 87,
        effectiveScore: 89,
        isNewBarber: false,
        totalLifetimeBookings: 156,
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

      // Generate mock score history (30 days)
      const history = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        performanceScore: 87 + Math.random() * 10 - 5,
        qualityScore: 92 + Math.random() * 6 - 3,
        reliabilityScore: 88 + Math.random() * 8 - 4,
        demandScore: 75 + Math.random() * 10 - 5,
      }));

      setScoreHistory(history);
      setIsLoading(false);
    }, 800);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 75) return 'bg-yellow-100';
    return 'bg-orange-100';
  };

  const getImprovementTips = () => {
    if (!performanceScore) return [];

    const tips = [];

    if (performanceScore.qualityScore < 90) {
      tips.push({
        category: 'Quality',
        tip: 'Encourage customers to leave reviews and focus on building repeat clientele',
        impact: 'High',
      });
    }

    if (performanceScore.reliabilityScore < 90) {
      tips.push({
        category: 'Reliability',
        tip: 'Minimize no-shows and ensure you arrive on time for appointments',
        impact: 'Medium',
      });
    }

    if (performanceScore.demandScore < 80) {
      tips.push({
        category: 'Demand',
        tip: 'Increase booking volume by promoting availability and offering competitive pricing',
        impact: 'Low',
      });
    }

    return tips;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  if (!performanceScore) {
    return (
      <Card>
        <p className="text-center text-gray-600 py-8">No pricing data available</p>
      </Card>
    );
  }

  const chartData = {
    labels: scoreHistory.map(h => h.date),
    datasets: [
      {
        label: 'Performance Score',
        data: scoreHistory.map(h => h.performanceScore),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Quality Score',
        data: scoreHistory.map(h => h.qualityScore),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        tension: 0.4,
        borderDash: [5, 5],
      },
      {
        label: 'Reliability Score',
        data: scoreHistory.map(h => h.reliabilityScore),
        borderColor: 'rgb(234, 179, 8)',
        backgroundColor: 'rgba(234, 179, 8, 0.05)',
        tension: 0.4,
        borderDash: [5, 5],
      },
      {
        label: 'Demand Score',
        data: scoreHistory.map(h => h.demandScore),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        tension: 0.4,
        borderDash: [5, 5],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '30-Day Performance Trends',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value.toFixed(0);
          }
        }
      },
    },
  };

  const improvementTips = getImprovementTips();

  return (
    <div className="space-y-6">
      {/* Performance Score Overview */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Your Performance Score</h3>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
          >
            <Info className="w-4 h-4" />
            {showBreakdown ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Overall Score */}
          <div className={`p-6 rounded-lg ${getScoreBg(performanceScore.performanceScore)}`}>
            <div className="flex items-center gap-3 mb-2">
              <Award className={`w-8 h-8 ${getScoreColor(performanceScore.performanceScore)}`} />
              <div>
                <p className="text-sm text-gray-600">Overall Performance</p>
                <p className={`text-4xl font-bold ${getScoreColor(performanceScore.performanceScore)}`}>
                  {performanceScore.performanceScore}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {performanceScore.isNewBarber
                ? 'New barber! Keep up the great work!'
                : `Based on ${performanceScore.totalLifetimeBookings} completed bookings`}
            </p>
          </div>

          {/* Component Scores */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Quality</span>
                <span className="text-sm font-semibold text-gray-900">{performanceScore.qualityScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${performanceScore.qualityScore}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Reliability</span>
                <span className="text-sm font-semibold text-gray-900">{performanceScore.reliabilityScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${performanceScore.reliabilityScore}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Demand</span>
                <span className="text-sm font-semibold text-gray-900">{performanceScore.demandScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${performanceScore.demandScore}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        {showBreakdown && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Score Breakdown</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><strong>Quality (70% weight):</strong> Based on your average rating and repeat customer rate</p>
              <p><strong>Reliability (20% weight):</strong> Based on your on-time percentage and low no-show rate</p>
              <p><strong>Demand (10% weight):</strong> Based on your booking volume compared to other barbers on campus</p>
              <p className="text-indigo-600 font-medium mt-4">
                Performance Score = (Quality × 0.7) + (Reliability × 0.2) + (Demand × 0.1)
              </p>
            </div>
          </div>
        )}
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
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Prices update daily</p>
              <p className="text-xs text-blue-700 mt-1">
                Your prices are automatically adjusted based on your performance score and market conditions.
                They update every night at 2 AM.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Performance Trends Chart */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Performance Trends</h3>
        <div className="h-[300px]">
          <Line data={chartData} options={chartOptions} />
        </div>
      </Card>

      {/* Improvement Tips */}
      {improvementTips.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">How to Increase Your Prices</h3>
          <div className="space-y-3">
            {improvementTips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                  tip.impact === 'High' ? 'bg-red-100 text-red-800' :
                  tip.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {tip.impact} Impact
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{tip.category}</p>
                  <p className="text-sm text-gray-600 mt-1">{tip.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

