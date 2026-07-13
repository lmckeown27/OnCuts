/**
 * Services Offered — ledger UI matching iOS ProviderBarberServicesView.
 * Catalog filtered by provider profession (barber / beauty).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Check, CheckCircle2, Square, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  SERVICE_TYPES,
  getDefaultDurationMinutes,
  MAX_SERVICE_DURATION_MINUTES,
  MIN_SERVICE_DURATION_MINUTES,
  findService,
} from '../config/services';
import barberService from '../services/barber.service';
import { colors } from '../utils/colors';

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
  priceDirty: boolean;
  durationDirty: boolean;
}

interface Props {
  barberId: string;
}

type ProviderKind = 'barber' | 'beauty';

type LedgerCategory =
  | 'haircuts'
  | 'beardAndGrooming'
  | 'textureAndDesign'
  | 'colorAndTreatments'
  | 'beauty';

const LEDGER_SECTIONS: { id: LedgerCategory; title: string }[] = [
  { id: 'haircuts', title: 'Haircuts' },
  { id: 'beardAndGrooming', title: 'Beard & Grooming' },
  { id: 'textureAndDesign', title: 'Texture & Design' },
  { id: 'colorAndTreatments', title: 'Color & Treatments' },
  { id: 'beauty', title: 'Beauty' },
];

/** Match iOS ServiceLedgerCategorizer keyword order (first match wins). */
function ledgerCategoryForService(slug: string, name: string): LedgerCategory {
  const hay = `${slug} ${name}`.toLowerCase();
  if (
    hay.includes('beard') ||
    hay.includes('shave') ||
    hay.includes('lineup') ||
    hay.includes('line-up') ||
    hay.includes('line up')
  ) {
    return 'beardAndGrooming';
  }
  if (
    hay.includes('color') ||
    hay.includes('perm') ||
    hay.includes('treatment') ||
    hay.includes('dye')
  ) {
    return 'colorAndTreatments';
  }
  if (
    hay.includes('design') ||
    hay.includes('afro') ||
    hay.includes('texture') ||
    hay.includes('art')
  ) {
    return 'textureAndDesign';
  }
  if (
    hay.includes('hair') ||
    hay.includes('fade') ||
    hay.includes('cut') ||
    hay.includes('buzz') ||
    hay.includes('taper') ||
    hay.includes('mullet') ||
    hay.includes('kids') ||
    hay.includes('women')
  ) {
    return 'haircuts';
  }
  return 'beauty';
}

function sortServicesInSection(a: BarberService, b: BarberService): number {
  const aName = a.serviceName.toLowerCase();
  const bName = b.serviceName.toLowerCase();
  if (aName === 'haircut' && bName === 'buzz cut') return -1;
  if (aName === 'buzz cut' && bName === 'haircut') return 1;
  return a.serviceName.localeCompare(b.serviceName);
}

function normalizeProviderKind(raw: unknown): ProviderKind {
  return String(raw ?? 'barber').trim().toLowerCase() === 'beauty' ? 'beauty' : 'barber';
}

function resolveCatalogProviderType(service: {
  id?: string | number;
  slug?: string;
  name: string;
  providerType?: string | null;
}): ProviderKind {
  if (service.providerType === 'beauty' || service.providerType === 'barber') {
    return service.providerType;
  }
  const found = findService(service.slug || String(service.id ?? '') || service.name);
  if (found?.providerType === 'beauty') return 'beauty';
  if (found?.providerType === 'barber') return 'barber';
  return 'barber';
}

const FALLBACK_SERVICES = SERVICE_TYPES;
const olive = colors.olive.DEFAULT;
const oliveMuted = `${colors.olive.DEFAULT}24`; // ~14% opacity hex

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
  providerType?: string;
  isActive: boolean;
}

export default function BarberServiceSpecialties({ barberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [barberServices, setBarberServices] = useState<BarberService[]>([]);
  const [providerKind, setProviderKind] = useState<ProviderKind>('barber');
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const barberServicesRef = useRef(barberServices);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    barberServicesRef.current = barberServices;
  }, [barberServices]);

  useEffect(() => {
    void fetchBarberServices();
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [barberId]);

  const showInlineToast = (message: string) => {
    setInlineToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setInlineToast(null), 2800);
  };

  const fetchBarberServices = async (options?: { cacheBust?: boolean; silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setLoadError(null);
    }

    try {
      const barberData = await barberService.getBarberByUserId(barberId, {
        cacheBust: options?.cacheBust,
      });
      const kind = normalizeProviderKind(
        (barberData as { provider_type?: string; providerType?: string } | null)?.provider_type ??
          (barberData as { providerType?: string } | null)?.providerType
      );
      setProviderKind(kind);

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
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/admin/services?providerType=${kind}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
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
              providerType: resolveCatalogProviderType(s),
            }))
            .filter(
              (s: { providerType: ProviderKind }) => s.providerType === kind
            );
        }
      } catch {
        // fall through to config
      }

      if (availableServices.length === 0) {
        availableServices = FALLBACK_SERVICES.filter(
          (s) => (s.providerType || 'barber') === kind
        ).map((s) => ({
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
          priceDirty: false,
          durationDirty: false,
        };
      });

      setBarberServices(services);
      barberServicesRef.current = services;
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch barber services:', error);
      setLoadError('Could not load services.');
      if (!options?.silent) {
        toast.error('Failed to load services');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const groupedSections = useMemo(() => {
    return LEDGER_SECTIONS.map((section) => {
      const rows = barberServices
        .filter((s) => ledgerCategoryForService(s.serviceId, s.serviceName) === section.id)
        .sort(sortServicesInSection);
      return { ...section, rows };
    }).filter((section) => section.rows.length > 0);
  }, [barberServices]);

  const toggleService = async (serviceId: string) => {
    if (saving) return;
    const serviceToToggle = barberServicesRef.current.find((s) => s.serviceId === serviceId);
    if (!serviceToToggle) return;

    const updatedServices = barberServicesRef.current.map((s) =>
      s.serviceId === serviceId
        ? {
            ...s,
            isOffered: !s.isOffered,
            priceDirty: false,
            durationDirty: false,
            price: s.originalPrice,
            durationMinutes: s.originalDurationMinutes,
          }
        : s
    );
    setBarberServices(updatedServices);
    await saveServices(updatedServices);
  };

  const updatePrice = (serviceId: string, newPrice: number) => {
    setBarberServices((prev) => {
      const next = prev.map((service) =>
        service.serviceId === serviceId
          ? {
              ...service,
              price: newPrice,
              priceDirty: newPrice !== service.originalPrice,
            }
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
          ? {
              ...service,
              durationMinutes: newDuration,
              durationDirty: newDuration !== service.originalDurationMinutes,
            }
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
    let priceClamped = false;
    if (service.price < service.minPrice) {
      validatedPrice = service.minPrice;
      priceClamped = true;
    } else if (service.price > service.maxPrice) {
      validatedPrice = service.maxPrice;
      priceClamped = true;
    }

    let validatedDuration = service.durationMinutes;
    let durationClamped = false;
    if (validatedDuration < service.minDurationMinutes) {
      validatedDuration = service.minDurationMinutes;
      durationClamped = true;
    } else if (validatedDuration > service.maxDurationMinutes) {
      validatedDuration = service.maxDurationMinutes;
      durationClamped = true;
    }

    if (priceClamped) {
      showInlineToast(
        `Price must be $${service.minPrice}–$${service.maxPrice}; saved $${validatedPrice}.`
      );
    } else if (durationClamped) {
      showInlineToast(
        `Duration must be ${service.minDurationMinutes}–${service.maxDurationMinutes} minutes; saved ${validatedDuration} min.`
      );
    }

    const updatedServices = barberServicesRef.current.map((s) =>
      s.serviceId === serviceId
        ? {
            ...s,
            price: validatedPrice,
            originalPrice: validatedPrice,
            durationMinutes: validatedDuration,
            originalDurationMinutes: validatedDuration,
            priceDirty: false,
            durationDirty: false,
          }
        : s
    );

    setBarberServices(updatedServices);
    barberServicesRef.current = updatedServices;
    await saveServices(updatedServices);
  };

  const cancelServiceEdit = (serviceId: string) => {
    setBarberServices((prev) => {
      const next = prev.map((service) =>
        service.serviceId === serviceId
          ? {
              ...service,
              price: service.originalPrice,
              durationMinutes: service.originalDurationMinutes,
              priceDirty: false,
              durationDirty: false,
            }
          : service
      );
      barberServicesRef.current = next;
      return next;
    });
  };

  const saveServices = async (services: BarberService[]) => {
    setSaving(true);
    try {
      const barberData = await barberService.getBarberByUserId(barberId);
      if (!barberData?.id) {
        throw new Error('Could not determine your barber profile. Pull to refresh.');
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
      showInlineToast('Saved.');
    } catch (error) {
      console.error('Failed to save services:', error);
      const msg =
        error instanceof Error ? error.message : 'Failed to save services';
      toast.error(msg);
      await fetchBarberServices({ cacheBust: true, silent: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[280px]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: olive }} />
      </div>
    );
  }

  if (loadError && barberServices.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-sm text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => void fetchBarberServices()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: olive }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (barberServices.length === 0) {
    return (
      <p className="text-sm text-gray-600 text-center py-12 px-4 leading-relaxed">
        No campus services are configured yet. An Admin can add services in the Admin dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-4 relative">
      {inlineToast && (
        <div className="sticky top-0 z-10 flex justify-center pointer-events-none">
          <div
            className="pointer-events-auto px-4 py-2 rounded-full text-sm font-medium text-white shadow-md"
            style={{ backgroundColor: colors.olive[600] }}
          >
            {inlineToast}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600 leading-relaxed">
        Choose the services you offer, then set a price and duration within each service&apos;s
        allowed range.
      </p>

      <div className="space-y-6">
        {groupedSections.map((section, sectionIndex) => (
          <section key={section.id}>
            <h3
              className={`text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500 mb-2 ${
                sectionIndex === 0 ? '' : 'pt-2'
              }`}
            >
              {section.title}
            </h3>
            <div className="space-y-2.5">
              {section.rows.map((service) => {
                const hasChanges = service.priceDirty || service.durationDirty;
                return (
                  <div
                    key={service.serviceId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!service.isOffered && !saving) {
                        void toggleService(service.serviceId);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        (e.key === 'Enter' || e.key === ' ') &&
                        !service.isOffered &&
                        !saving
                      ) {
                        e.preventDefault();
                        void toggleService(service.serviceId);
                      }
                    }}
                    className={`rounded-[14px] border-2 px-4 py-4 transition-opacity ${
                      saving ? 'opacity-70' : ''
                    } ${!service.isOffered ? 'cursor-pointer' : ''}`}
                    style={{
                      backgroundColor: oliveMuted,
                      borderColor: `${olive}b8`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          aria-label={
                            service.isOffered
                              ? `Remove ${service.serviceName}`
                              : `Offer ${service.serviceName}`
                          }
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!saving) void toggleService(service.serviceId);
                          }}
                          className="mt-0.5 shrink-0 text-left"
                        >
                          {service.isOffered ? (
                            <span
                              className="inline-flex w-5 h-5 items-center justify-center rounded-[3px]"
                              style={{ backgroundColor: olive }}
                            >
                              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            </span>
                          ) : (
                            <Square className="w-5 h-5 text-gray-500" strokeWidth={2} />
                          )}
                        </button>
                        <h4 className="font-bold text-gray-900 text-[15px] leading-snug line-clamp-2">
                          {service.serviceName}
                        </h4>
                      </div>

                      <div
                        className={`shrink-0 space-y-2 min-w-[10.5rem] ${
                          service.isOffered ? '' : 'opacity-40 pointer-events-none'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">
                            Price:
                          </span>
                          <span className="text-sm text-gray-700">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={!service.isOffered || saving}
                            value={service.isOffered ? service.price : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              updatePrice(service.serviceId, val ? Number(val) : 0);
                            }}
                            className={`w-[3.25rem] text-sm font-semibold text-gray-900 rounded-md px-1.5 py-1 border focus:outline-none ${
                              service.priceDirty
                                ? 'border-2 bg-white'
                                : 'border bg-white/70 border-stone-300'
                            }`}
                            style={
                              service.priceDirty
                                ? { borderColor: olive, backgroundColor: '#fff' }
                                : undefined
                            }
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-600 w-12 shrink-0">
                            Time:
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={!service.isOffered || saving}
                            value={service.isOffered ? service.durationMinutes : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              updateDuration(service.serviceId, val ? Number(val) : 0);
                            }}
                            className={`w-[3.25rem] text-sm font-semibold text-gray-900 rounded-md px-1.5 py-1 border focus:outline-none ${
                              service.durationDirty
                                ? 'border-2 bg-white'
                                : 'border bg-white/70 border-stone-300'
                            }`}
                            style={
                              service.durationDirty
                                ? { borderColor: olive, backgroundColor: '#fff' }
                                : undefined
                            }
                          />
                          <span className="text-xs text-gray-500">min</span>
                          {hasChanges && (
                            <div className="flex items-center gap-0.5 ml-auto">
                              <button
                                type="button"
                                aria-label="Confirm changes"
                                disabled={saving}
                                onClick={() => void confirmServiceChanges(service.serviceId)}
                                className="p-0.5"
                              >
                                <CheckCircle2 className="w-5 h-5" style={{ color: olive }} />
                              </button>
                              <button
                                type="button"
                                aria-label="Cancel changes"
                                disabled={saving}
                                onClick={() => cancelServiceEdit(service.serviceId)}
                                className="p-0.5 text-gray-400 hover:text-gray-600"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 pt-1">
        Showing {providerKind === 'beauty' ? 'Beauty' : 'Barber'} services for your provider type.
      </p>
    </div>
  );
}
