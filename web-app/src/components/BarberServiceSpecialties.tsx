/**
 * Barber Service Specialties Component
 * 
 * Allows barbers to select which services they provide and set their own prices
 */

import { useState, useEffect } from 'react';
import { Check, Info, DollarSign, Scissors } from 'lucide-react';
import Card from './Card';
import Loading from './Loading';
import Button from './Button';
import toast from 'react-hot-toast';
import { SERVICE_TYPES } from '../config/services';
import barberService from '../services/barber.service';

interface BarberService {
  serviceId: string;
  serviceName: string;
  description: string;
  isOffered: boolean;
  price: number; // Barber's custom price in dollars
  suggestedPrice: number; // Suggested price from config
  originalPrice: number; // Price before editing (to detect changes)
  isEditing: boolean; // Whether price is being edited
}

interface Props {
  barberId: string;
}

// Use shared service types from config
const AVAILABLE_SERVICES = SERVICE_TYPES;

export default function BarberServiceSpecialties({ barberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barberServices, setBarberServices] = useState<BarberService[]>([]);

  useEffect(() => {
    fetchBarberServices();
  }, [barberId]);

  const fetchBarberServices = async () => {
    setLoading(true);
    
    try {
      // Fetch real barber data from API
      const barberData = await barberService.getBarberByUserId(barberId);
      
      // Get the barber's current specialties and pricing from the database
      const currentSpecialties: string[] = barberData?.specialties || [];
      const currentPricing: { name: string; price: number }[] = barberData?.pricing || [];
      
      // Map all available services with real data where available
      const services: BarberService[] = AVAILABLE_SERVICES.map((service) => {
        // Check if this service is offered by matching service name
        const isOffered = currentSpecialties.some(
          s => s.toLowerCase() === service.name.toLowerCase()
        );
        
        // Get the barber's custom price for this service, or use suggested price
        const savedPrice = currentPricing.find(
          p => p.name?.toLowerCase() === service.name.toLowerCase()
        );
        const price = savedPrice?.price || service.basePrice || 25;

        return {
          serviceId: service.id,
          serviceName: service.name,
          description: service.description || '',
          isOffered,
          price,
          suggestedPrice: service.basePrice || 25,
          originalPrice: price,
          isEditing: false,
        };
      });

      setBarberServices(services);
    } catch (error) {
      console.error('Failed to fetch barber services:', error);
      toast.error('Failed to load services');
      
      // Initialize with default services on error
      const defaultServices: BarberService[] = AVAILABLE_SERVICES.map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        description: service.description || '',
        isOffered: false,
        price: service.basePrice || 25,
        suggestedPrice: service.basePrice || 25,
        originalPrice: service.basePrice || 25,
        isEditing: false,
      }));
      setBarberServices(defaultServices);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = async (serviceId: string) => {
    if (saving) return;
    
    // Find the service being toggled
    const serviceToToggle = barberServices.find(s => s.serviceId === serviceId);
    if (!serviceToToggle) return;
    
    const newIsOffered = !serviceToToggle.isOffered;
    
    // Optimistically update UI
    setBarberServices(prev =>
      prev.map(service =>
        service.serviceId === serviceId
          ? { ...service, isOffered: newIsOffered }
          : service
      )
    );
    
    // Save to database
    await saveServices(
      barberServices.map(s => 
        s.serviceId === serviceId ? { ...s, isOffered: newIsOffered } : s
      )
    );
  };

  const updatePrice = (serviceId: string, newPrice: number) => {
    setBarberServices(prev =>
      prev.map(service =>
        service.serviceId === serviceId
          ? { ...service, price: newPrice, isEditing: true }
          : service
      )
    );
  };

  const confirmPrice = async (serviceId: string) => {
    const service = barberServices.find(s => s.serviceId === serviceId);
    if (!service || !service.isOffered) return;
    
    // Validate price
    let validatedPrice = service.price;
    if (service.price < 5) {
      toast.error('Minimum price is $5');
      validatedPrice = 5;
    } else if (service.price > 500) {
      toast.error('Maximum price is $500');
      validatedPrice = 500;
    }
    
    // Update with validated price and mark as not editing
    setBarberServices(prev =>
      prev.map(s =>
        s.serviceId === serviceId 
          ? { ...s, price: validatedPrice, originalPrice: validatedPrice, isEditing: false } 
          : s
      )
    );
    
    // Save to database
    await saveServices(
      barberServices.map(s =>
        s.serviceId === serviceId 
          ? { ...s, price: validatedPrice, originalPrice: validatedPrice, isEditing: false }
          : s
      )
    );
  };

  const cancelPriceEdit = (serviceId: string) => {
    setBarberServices(prev =>
      prev.map(service =>
        service.serviceId === serviceId
          ? { ...service, price: service.originalPrice, isEditing: false }
          : service
      )
    );
  };

  const saveServices = async (services: BarberService[]) => {
    setSaving(true);
    
    try {
      // Get barber profile to get the barber ID
      const barberData = await barberService.getBarberByUserId(barberId);
      
      if (!barberData?.id) {
        throw new Error('Barber profile not found');
      }
      
      // Build specialties array (service names that are offered)
      const specialties = services
        .filter(s => s.isOffered)
        .map(s => s.serviceName);
      
      // Build pricing array (service names and prices for offered services)
      const pricing = services
        .filter(s => s.isOffered)
        .map(s => ({ name: s.serviceName, price: s.price }));
      
      // Save to database
      await barberService.updateBarberProfile(barberData.id, {
        specialties,
        pricing,
      });
      
      toast.success('Services saved');
    } catch (error) {
      console.error('Failed to save services:', error);
      toast.error('Failed to save services');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loading />
      </div>
    );
  }

  const offeredServices = barberServices.filter(s => s.isOffered);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-primary-50 border-primary-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Set Your Own Prices</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <strong>You're in control!</strong> Select the services you offer and set your own prices.
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Click on a service to add it to your offerings</li>
                <li>Enter the price you want to charge for each service</li>
                <li>Click "Confirm Price" to save your changes</li>
                <li>Suggested prices are shown as a starting point</li>
              </ul>
              <p className="text-primary-700 font-medium mt-2">
                Tip: Competitive pricing helps attract more customers while you build reviews!
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      {offeredServices.length > 0 && (
        <Card>
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900">
              {offeredServices.length} Service{offeredServices.length !== 1 ? 's' : ''} Offered
            </h3>
            <p className="text-lg text-gray-600 mt-1">
              Price range: ${Math.min(...offeredServices.map(s => s.price))} - ${Math.max(...offeredServices.map(s => s.price))}
            </p>
          </div>
        </Card>
      )}

      {/* Service Selection */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-4">My Services & Pricing</h3>
        <p className="text-sm text-gray-600 mb-6">
          Select services and set your prices. Click "Confirm Price" after editing.
        </p>

        <div className="space-y-3">
          {barberServices.map((service) => {
            const priceChanged = service.isEditing && service.price !== service.originalPrice;
            
            return (
              <div
                key={service.serviceId}
                onClick={() => {
                  // Only allow clicking entire card to SELECT (not deselect)
                  if (!service.isOffered && !saving) {
                    toggleService(service.serviceId);
                  }
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  service.isOffered
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                } ${saving ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Service Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {/* Checkbox - only this can deselect when service is offered */}
                      <div
                        onClick={(e) => {
                          if (service.isOffered && !saving) {
                            e.stopPropagation();
                            toggleService(service.serviceId);
                          }
                        }}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          service.isOffered
                            ? 'bg-primary-400 border-primary-400 cursor-pointer hover:bg-primary-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {service.isOffered && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{service.serviceName}</h4>
                        <p className="text-xs text-gray-500">{service.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="text-right min-w-[160px]">
                    {service.isOffered ? (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Your Price</p>
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={service.price}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              updatePrice(service.serviceId, val ? Number(val) : 0);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-20 text-2xl font-bold text-gray-900 text-right border-b-2 focus:outline-none bg-transparent ${
                              priceChanged ? 'border-orange-400' : 'border-primary-300 focus:border-primary-500'
                            }`}
                          />
                        </div>
                        
                        {/* Confirm/Cancel buttons when price changed */}
                        {priceChanged && (
                          <div className="flex gap-2 mt-2 justify-end">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmPrice(service.serviceId);
                              }}
                              disabled={saving}
                            >
                              Confirm Price
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelPriceEdit(service.serviceId);
                              }}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-primary-500">
                          Click to add
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

      {/* Pricing Tips */}
      <Card className="bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing Tips</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900 mb-1">Start Competitive</p>
              <p className="text-gray-600">
                New barbers often start slightly below suggested prices to attract early customers and build reviews.
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900 mb-1">Increase With Reviews</p>
              <p className="text-gray-600">
                As you get 5-star reviews, you can gradually increase prices. Quality builds reputation!
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900 mb-1">Know Your Market</p>
              <p className="text-gray-600">
                Check what other barbers on campus charge. Price fairly for your skill level.
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900 mb-1">Value Your Time</p>
              <p className="text-gray-600">
                Consider time, supplies, and effort for each service when setting prices.
              </p>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mt-4">
            <p className="text-primary-900 font-medium flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Pro Tip
            </p>
            <p className="text-primary-800 text-sm mt-1">
              Offer a few services you're confident in at first. As you gain experience and reviews, 
              expand your offerings and adjust prices based on demand!
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
