/**
 * Barber Service Specialties Component
 *
 * Allows barbers to select which services they provide and set price + duration.
 */

import { useState, useEffect, useRef } from 'react';
import { Check, Clock, DollarSign } from 'lucide-react';
import Card from './Card';
import Loading from './Loading';
import Button from './Button';
import toast from 'react-hot-toast';
import {
  SERVICE_TYPES,
  getDefaultDurationMinutes,
  MAX_SERVICE_DURATION_MINUTES,
  MIN_SERVICE_DURATION_MINUTES,
} from '../config/services';
import barberService from '../services/barber.service';

interface BarberService {
  serviceId: string;
  serviceName: string;
  description: string;
  isOffered: boolean;
  price: number;
  suggestedPrice: number;
  originalPrice: number;
  minPrice: number;
  maxPrice: number;
  durationMinutes: number;
  originalDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  isEditing: boolean;
}

interface Props {
  barberId: string;
}

const FALLBACK_SERVICES = SERVICE_TYPES;

interface ApiService {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  isActive: boolean;
}

export default function BarberServiceSpecialties({ barberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barberServices, setBarberServices] = useState<BarberService[]>([]);
  const barberServicesRef = useRef(barberServices);

  useEffect(() => {
    barberServicesRef.current = barberServices;
  }, [barberServices]);

  useEffect(() => {
    fetchBarberServices();
  }, [barberId]);

  const fetchBarberServices = async (options?: { cacheBust?: boolean; silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const barberData = await barberService.getBarberByUserId(barberId, {
        cacheBust: options?.cacheBust,
      });
      const currentSpecialties: string[] = barberData?.specialties || [];
      const currentPricing: { name: string; price: number; duration_minutes?: number }[] =
        barberData?.pricing || [];

      let availableServices: {
        id: string;
        name: string;
        description: string;
        basePrice: number;
        minPrice: number;
        maxPrice: number;
        minDurationMinutes: number;
        maxDurationMinutes: number;
      }[] = [];
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/services`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success && data.data) {
          availableServices = data.data
            .filter((s: ApiService) => s.isActive)
            .map((s: ApiService) => ({
              id: s.slug,
              name: s.name,
              description: s.description || '',
              basePrice: Math.round(s.basePriceCents / 100),
              minPrice: Math.round((s.minPriceCents ?? s.basePriceCents) / 100),
              maxPrice: Math.round((s.maxPriceCents ?? s.basePriceCents) / 100),
              minDurationMinutes: s.minDurationMinutes ?? MIN_SERVICE_DURATION_MINUTES,
              maxDurationMinutes: s.maxDurationMinutes ?? MAX_SERVICE_DURATION_MINUTES,
            }));
        }
      } catch {
        console.log('Using fallback services from config');
      }

      if (availableServices.length === 0) {
        availableServices = FALLBACK_SERVICES.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          basePrice: s.basePrice || 25,
          minPrice: Math.max(5, Math.round((s.basePrice || 25) * 0.8)),
          maxPrice: Math.round((s.basePrice || 25) * 1.5),
          minDurationMinutes: MIN_SERVICE_DURATION_MINUTES,
          maxDurationMinutes: MAX_SERVICE_DURATION_MINUTES,
        }));
      }

      const services: BarberService[] = availableServices.map((service) => {
        const isOffered = currentSpecialties.some(
          (s) => s.toLowerCase() === service.name.toLowerCase()
        );
        const savedPrice = currentPricing.find(
          (p) => p.name?.toLowerCase() === service.name.toLowerCase()
        );
        const price = savedPrice?.price || service.basePrice;
        const durationMinutes =
          savedPrice?.duration_minutes ?? getDefaultDurationMinutes(service.name);

        return {
          serviceId: service.id,
          serviceName: service.name,
          description: service.description || '',
          isOffered,
          price,
          suggestedPrice: service.basePrice,
          originalPrice: price,
          minPrice: service.minPrice,
          maxPrice: service.maxPrice,
          durationMinutes,
          originalDurationMinutes: durationMinutes,
          minDurationMinutes: service.minDurationMinutes,
          maxDurationMinutes: service.maxDurationMinutes,
          isEditing: false,
        };
      });

      setBarberServices(services);
      barberServicesRef.current = services;
    } catch (error) {
      console.error('Failed to fetch barber services:', error);
      toast.error('Failed to load services');

      const defaultServices: BarberService[] = FALLBACK_SERVICES.map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        description: service.description || '',
        isOffered: false,
        price: service.basePrice || 25,
        suggestedPrice: service.basePrice || 25,
        originalPrice: service.basePrice || 25,
        minPrice: Math.max(5, Math.round((service.basePrice || 25) * 0.8)),
        maxPrice: Math.round((service.basePrice || 25) * 1.5),
        durationMinutes: getDefaultDurationMinutes(service.name),
        originalDurationMinutes: getDefaultDurationMinutes(service.name),
        minDurationMinutes: MIN_SERVICE_DURATION_MINUTES,
        maxDurationMinutes: MAX_SERVICE_DURATION_MINUTES,
        isEditing: false,
      }));
      setBarberServices(defaultServices);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const toggleService = async (serviceId: string) => {
    if (saving) return;

    const serviceToToggle = barberServicesRef.current.find((s) => s.serviceId === serviceId);
    if (!serviceToToggle) return;

    const newIsOffered = !serviceToToggle.isOffered;
    const updatedServices = barberServicesRef.current.map((s) =>
      s.serviceId === serviceId ? { ...s, isOffered: newIsOffered } : s
    );

    setBarberServices(updatedServices);
    await saveServices(updatedServices);
  };

  const updatePrice = (serviceId: string, newPrice: number) => {
    setBarberServices((prev) => {
      const next = prev.map((service) =>
        service.serviceId === serviceId
          ? { ...service, price: newPrice, isEditing: true }
          : service
      );
      barberServicesRef.current = next;
      return next;
    });
  };

  const updateDuration = (serviceId: string, newDuration: number) => {
    setBarberServices((prev) => {
      const next = prev.map((service) =>
        service.serviceId === serviceId
          ? { ...service, durationMinutes: newDuration, isEditing: true }
          : service
      );
      barberServicesRef.current = next;
      return next;
    });
  };

  const confirmServiceChanges = async (serviceId: string) => {
    const service = barberServicesRef.current.find((s) => s.serviceId === serviceId);
    if (!service || !service.isOffered) return;

    let validatedPrice = service.price;
    if (service.price < service.minPrice) {
      toast.error(`Minimum price is $${service.minPrice}`);
      validatedPrice = service.minPrice;
    } else if (service.price > service.maxPrice) {
      toast.error(`Maximum price is $${service.maxPrice}`);
      validatedPrice = service.maxPrice;
    }

    let validatedDuration = service.durationMinutes;
    if (validatedDuration < service.minDurationMinutes) {
      toast.error(`Minimum duration is ${service.minDurationMinutes} minutes`);
      validatedDuration = service.minDurationMinutes;
    } else if (validatedDuration > service.maxDurationMinutes) {
      toast.error(`Maximum duration is ${service.maxDurationMinutes} minutes`);
      validatedDuration = service.maxDurationMinutes;
    }

    const updatedServices = barberServicesRef.current.map((s) =>
      s.serviceId === serviceId
        ? {
            ...s,
            price: validatedPrice,
            originalPrice: validatedPrice,
            durationMinutes: validatedDuration,
            originalDurationMinutes: validatedDuration,
            isEditing: false,
          }
        : s
    );

    setBarberServices(updatedServices);
    barberServicesRef.current = updatedServices;
    await saveServices(updatedServices);
  };

  const cancelServiceEdit = (serviceId: string) => {
    setBarberServices((prev) =>
      prev.map((service) =>
        service.serviceId === serviceId
          ? {
              ...service,
              price: service.originalPrice,
              durationMinutes: service.originalDurationMinutes,
              isEditing: false,
            }
          : service
      )
    );
  };

  const saveServices = async (services: BarberService[]) => {
    setSaving(true);

    try {
      const barberData = await barberService.getBarberByUserId(barberId);
      if (!barberData?.id) {
        throw new Error('Barber profile not found');
      }

      const specialties = services.filter((s) => s.isOffered).map((s) => s.serviceName);
      const pricing = services
        .filter((s) => s.isOffered)
        .map((s) => ({
          name: s.serviceName,
          price: s.price,
          duration_minutes: s.durationMinutes,
        }));

      await barberService.updateBarberProfile(barberData.id, {
        specialties,
        pricing,
      });

      await fetchBarberServices({ cacheBust: true, silent: true });
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
      <Card>
        <p className="text-sm text-gray-600 mb-4">
          Select services and set your price and duration for each one.
        </p>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {barberServices.map((service) => {
            const hasChanges =
              service.isEditing &&
              (service.price !== service.originalPrice ||
                service.durationMinutes !== service.originalDurationMinutes);

            return (
              <div
                key={service.serviceId}
                onClick={() => {
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
                <div className="flex items-start gap-2 mb-2">
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
                    {service.isOffered && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                      {service.serviceName}
                    </h4>
                  </div>
                </div>

                {service.isOffered ? (
                  <div className="mt-2 space-y-2">
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
                          hasChanges
                            ? 'border-orange-400'
                            : 'border-primary-300 focus:border-primary-500'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={service.durationMinutes}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          updateDuration(service.serviceId, val ? Number(val) : 0);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-12 text-sm font-semibold text-gray-900 border-b-2 focus:outline-none bg-transparent ${
                          hasChanges
                            ? 'border-orange-400'
                            : 'border-primary-300 focus:border-primary-500'
                        }`}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>

                    {hasChanges && (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmServiceChanges(service.serviceId);
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
                            cancelServiceEdit(service.serviceId);
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
                  <p className="text-xs text-primary-500 mt-1">+ Add</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
