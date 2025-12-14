/**
 * Barber Service Specialties Component
 * 
 * Allows barbers to select which hair-care services they provide
 * Prices are algorithmically determined based on quality for each service type
 */

import { useState, useEffect } from 'react';
import { Check, Info, TrendingUp, TrendingDown, Scissors } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import Loading from './Loading';
import toast from 'react-hot-toast';

interface ServiceType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
}

interface BarberService {
  serviceId: string;
  serviceName: string;
  isOffered: boolean;
  algorithmicPrice: number;
  basePrice: number;
  priceMultiplier: number;
  qualityFactor: number;
  recentBookings: number;
  avgRating: number;
  priceChange: number;
  priceChangePct: number;
}

interface Props {
  barberId: string;
}

// Available service types aligned with "Earn More, Pay Less" model
// Budget tier ($23): Basic services (barber earns $21.85, beating traditional $21 max)
// Standard tier (~$28): Most haircuts
// Premium tier ($35-$45): Specialized services
const AVAILABLE_SERVICES: ServiceType[] = [
  { id: 'buzz-cut', name: 'Buzz Cut', description: 'Simple buzz cut', basePrice: 23 },
  { id: 'line-up', name: 'Line Up', description: 'Hairline and edge cleanup', basePrice: 23 },
  { id: 'beard-trim', name: 'Beard Trim', description: 'Beard shaping and trim', basePrice: 23 },
  { id: 'haircut', name: 'Haircut', description: 'Basic haircut service', basePrice: 28 },
  { id: 'taper', name: 'Taper', description: 'Tapered haircut', basePrice: 28 },
  { id: 'hot-shave', name: 'Hot Shave', description: 'Traditional hot towel shave', basePrice: 28 },
  { id: 'fade', name: 'Fade', description: 'Fade haircut', basePrice: 35 },
  { id: 'haircut-fade', name: 'Haircut & Fade', description: 'Complete haircut with fade', basePrice: 35 },
  { id: 'design', name: 'Design/Art', description: 'Custom hair designs', basePrice: 38 },
  { id: 'womens-cut', name: "Women's Cut", description: 'Womens haircut service', basePrice: 40 },
  { id: 'perm', name: 'Perm', description: 'Permanent wave treatment', basePrice: 45 },
  { id: 'color', name: 'Color Treatment', description: 'Hair coloring service', basePrice: 45 },
];

export default function BarberServiceSpecialties({ barberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barberServices, setBarberServices] = useState<BarberService[]>([]);

  useEffect(() => {
    fetchBarberServices();
  }, [barberId]);

  const fetchBarberServices = async () => {
    setLoading(true);
    
    // Mock data - in production, fetch from API
    setTimeout(() => {
      const mockServices: BarberService[] = AVAILABLE_SERVICES.map((service, idx) => {
        const isOffered = idx < 5; // First 5 services offered by default
        const qualityFactor = isOffered ? 0.85 + Math.random() * 0.3 : 1.0; // 0.85 - 1.15
        const priceMultiplier = qualityFactor;
        const algorithmicPrice = service.basePrice * priceMultiplier;
        const previousPrice = service.basePrice;
        const priceChange = algorithmicPrice - previousPrice;
        const priceChangePct = (priceChange / previousPrice) * 100;

        return {
          serviceId: service.id,
          serviceName: service.name,
          isOffered,
          algorithmicPrice,
          basePrice: service.basePrice,
          priceMultiplier,
          qualityFactor,
          recentBookings: isOffered ? Math.floor(Math.random() * 50) + 10 : 0,
          avgRating: isOffered ? 4.5 + Math.random() * 0.5 : 0,
          priceChange,
          priceChangePct,
        };
      });

      setBarberServices(mockServices);
      setLoading(false);
    }, 800);
  };

  const toggleService = async (serviceId: string) => {
    setSaving(true);
    
    // Optimistically update UI
    setBarberServices(prev =>
      prev.map(service =>
        service.serviceId === serviceId
          ? { ...service, isOffered: !service.isOffered }
          : service
      )
    );

    // Mock API call
    setTimeout(() => {
      toast.success('Services updated successfully');
      setSaving(false);
      // In production, would refetch to get updated algorithmic prices
    }, 500);
  };

  const getQualityBadge = (qualityFactor: number) => {
    if (qualityFactor >= 1.1) {
      return { label: 'Premium', color: 'bg-green-100 text-green-800 border-green-200' };
    } else if (qualityFactor >= 1.0) {
      return { label: 'Standard', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    } else if (qualityFactor >= 0.9) {
      return { label: 'Growing', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    } else {
      return { label: 'Developing', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Banner */}
      <Card className="bg-green-50 border-green-200 mb-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">You Keep 95% of Every Dollar</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="grid grid-cols-3 gap-4 my-3">
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 mb-1">$23 Service</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $21.85</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 mb-1">$28 Service</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $26.60</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-gray-500 mb-1">$35 Service</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $33.25</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                At traditional shops, barbers earn 40-60% (typically $14-$21 per $35 haircut). 
                On CampusCuts, you keep 95% with just a 5% platform fee. No overhead costs to subsidize!
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Banner */}
      <Card className="bg-primary-50 border-primary-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">How Service Pricing Works</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <strong>Select the services you offer.</strong> Prices are automatically determined by our algorithm based on:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Your service quality for that specific hair-care type</li>
                <li>Customer ratings for that service</li>
                <li>Booking volume and demand</li>
                <li>Market conditions on your campus</li>
              </ul>
              <p className="mt-3">
                <strong>Starting point:</strong> Each service begins at a base middle-ground price. As you provide excellent service and receive positive reviews, your price for that service will increase. Inconsistent quality may decrease it.
              </p>
              <p className="text-primary-700 font-medium mt-2">
                Focus on quality, and the pricing will take care of itself!
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Service Selection */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">My Service Specialties</h3>
        <p className="text-sm text-gray-600 mb-6">
          Select the hair-care services you want to offer. You can change these anytime.
        </p>

        <div className="space-y-3">
          {barberServices.map((service) => {
            const badge = getQualityBadge(service.qualityFactor);
            const serviceInfo = AVAILABLE_SERVICES.find(s => s.id === service.serviceId);

            return (
              <div
                key={service.serviceId}
                className={`p-4 rounded-lg border-2 transition-all ${
                  service.isOffered
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Service Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => toggleService(service.serviceId)}
                        disabled={saving}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          service.isOffered
                            ? 'bg-primary-400 border-primary-400'
                            : 'border-gray-300 hover:border-primary-300'
                        }`}
                      >
                        {service.isOffered && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-semibold text-gray-900">{service.serviceName}</h4>
                        <p className="text-xs text-gray-500">{serviceInfo?.description}</p>
                      </div>
                    </div>

                    {service.isOffered && (
                      <div className="ml-9 mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Bookings</p>
                          <p className="font-semibold text-gray-900">{service.recentBookings}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Rating</p>
                          <p className="font-semibold text-gray-900">{service.avgRating.toFixed(1)}★</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Quality Tier</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Multiplier</p>
                          <p className="font-semibold text-gray-900">{service.priceMultiplier.toFixed(2)}x</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Info */}
                  <div className="text-right min-w-[120px]">
                    {service.isOffered ? (
                      <>
                        <div className="mb-1">
                          <p className="text-xs text-gray-500">Your Price</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ${service.algorithmicPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Base: ${service.basePrice.toFixed(2)}
                        </div>
                        {service.priceChangePct !== 0 && (
                          <div className={`flex items-center justify-end gap-1 text-xs font-medium ${
                            service.priceChangePct > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {service.priceChangePct > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {service.priceChangePct > 0 ? '+' : ''}{service.priceChangePct.toFixed(1)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Base Price</p>
                        <p className="text-lg font-semibold text-gray-400">
                          ${service.basePrice.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* How Pricing Algorithm Works */}
      <Card className="bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Understanding Your Prices</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Algorithm Overview</h4>
            <p>
              Each service type has its own independent pricing based on your performance for that specific service.
              A barber excellent at fades may have higher fade pricing but lower perm pricing if they're still developing that skill.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">Quality Factors</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Service-Specific Ratings:</strong> Customer ratings for each service type</li>
              <li><strong>Booking Volume:</strong> How often that service is requested</li>
              <li><strong>Completion Rate:</strong> Successfully completed appointments</li>
              <li><strong>Repeat Customers:</strong> Customers who rebook that specific service</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">Quality Tiers</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                <p className="font-semibold text-green-900">Premium</p>
                <p className="text-xs text-green-700">1.10x - 1.15x</p>
                <p className="text-xs text-green-600 mt-1">High quality, excellent reviews</p>
              </div>
              <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
                <p className="font-semibold text-blue-900">Standard</p>
                <p className="text-xs text-blue-700">1.0x - 1.09x</p>
                <p className="text-xs text-blue-600 mt-1">Solid service, good feedback</p>
              </div>
              <div className="p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
                <p className="font-semibold text-yellow-900">Growing</p>
                <p className="text-xs text-yellow-700">0.90x - 0.99x</p>
                <p className="text-xs text-yellow-600 mt-1">Building reputation</p>
              </div>
              <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg">
                <p className="font-semibold text-gray-900">Developing</p>
                <p className="text-xs text-gray-700">0.85x - 0.89x</p>
                <p className="text-xs text-gray-600 mt-1">New to this service</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">Price Updates</h4>
            <p>
              Prices update nightly at 2:00 AM based on the past 30 days of performance. 
              Consistent excellent service for a specific hair-care type will gradually increase your price for that service.
            </p>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mt-4">
            <p className="text-primary-900 font-medium flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Pro Tip
            </p>
            <p className="text-primary-800 text-sm mt-1">
              Start with services you're most confident in. As you build your reputation with excellent work, 
              you can add more services and watch your prices grow based on your quality!
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

