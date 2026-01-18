/**
 * Barber Service Specialties Component
 * 
 * Allows barbers to select which services they provide and set their own prices
 */

import { useState, useEffect } from 'react';
import { Check, DollarSign } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* Service Selection */}
      <Card>
        <h3 className="text-xl font-bold text-gray-900 mb-2">My Services & Pricing</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select services and set your prices.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                className={`p-3 rounded-lg border-2 transition-all ${
                  service.isOffered
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                } ${saving ? 'opacity-70' : ''}`}
              >
                {/* Header with checkbox and name */}
                <div className="flex items-start gap-2 mb-2">
                  {/* Checkbox */}
                  <div
                    onClick={(e) => {
                      if (service.isOffered && !saving) {
                        e.stopPropagation();
                        toggleService(service.serviceId);
                      }
                    }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                      service.isOffered
                        ? 'bg-primary-400 border-primary-400 cursor-pointer hover:bg-primary-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {service.isOffered && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm leading-tight">{service.serviceName}</h4>
                  </div>
                </div>

                {/* Pricing */}
                {service.isOffered ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-0.5">
                      <DollarSign className="w-4 h-4 text-gray-400" />
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
                        className={`w-14 text-lg font-bold text-gray-900 border-b-2 focus:outline-none bg-transparent ${
                          priceChanged ? 'border-orange-400' : 'border-primary-300 focus:border-primary-500'
                        }`}
                      />
                    </div>
                    
                    {/* Confirm/Cancel buttons when price changed */}
                    {priceChanged && (
                      <div className="flex flex-col gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmPrice(service.serviceId);
                          }}
                          disabled={saving}
                          className="text-xs py-1"
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelPriceEdit(service.serviceId);
                          }}
                          disabled={saving}
                          className="text-xs py-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-primary-500 mt-1">
                    + Add
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
