import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import api from '../services/api.service';
import { SERVICE_TYPES, type ServiceType } from '../config/services';
import type { Barber, WeeklySchedule } from '../types';
import { barberDisplayName, barberPhotoUrl } from '../utils/myBarbersDiscover';
import {
  formatBarberDistanceFromUser,
  getBarberDistanceMilesFromTown,
} from '../utils/consumerBrowseDistancePreference';

interface PortfolioItem {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  sort_order: number;
  created_at: string;
  specialties?: string[];
  is_cover?: boolean;
}

function itemSpecialties(item: PortfolioItem): string[] {
  return Array.isArray(item.specialties) ? item.specialties.filter((id) => typeof id === 'string' && id) : [];
}

function latestSectionPhoto(items: PortfolioItem[], specialtyId: string): PortfolioItem | undefined {
  return items
    .filter((item) => itemSpecialties(item)[0] === specialtyId && item.media_type === 'image')
    .sort((a, b) => {
      const time = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (time !== 0 && !Number.isNaN(time)) return time;
      return b.sort_order - a.sort_order;
    })[0];
}

function sectionCover(items: PortfolioItem[], specialtyId: string): PortfolioItem | undefined {
  const marked = items.find(
    (item) => itemSpecialties(item)[0] === specialtyId && item.is_cover && item.media_type === 'image'
  );
  return marked ?? latestSectionPhoto(items, specialtyId);
}

function specialtyLabel(id: string, options: ServiceType[]): string {
  return options.find((option) => option.id === id)?.name || id;
}

function formatSpecialtyPrice(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

function priceForSpecialty(id: string, options: ServiceType[], prices: Record<string, number>): string | null {
  const option = options.find((entry) => entry.id === id);
  const keys = [id, option?.name].filter((key): key is string => Boolean(key)).map((key) => key.toLowerCase());
  for (const key of keys) {
    if (prices[key] != null) return formatSpecialtyPrice(prices[key]);
  }
  return null;
}

function formatClock(time24: string): string {
  if (!time24 || !time24.includes(':')) return 'N/A';
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 'N/A';
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  return minute === 0 ? `${hour}${ampm}` : `${hour}:${minuteStr}${ampm}`;
}

export function formatWeeklyAvailability(schedule: WeeklySchedule | null | undefined): { day: string; times: string }[] {
  if (!schedule) return [];
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const dayAbbrev: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  return dayOrder
    .filter((day) => {
      const daySchedule = schedule[day];
      if (!daySchedule?.enabled) return false;
      if (daySchedule.intervals !== undefined) {
        return Array.isArray(daySchedule.intervals) && daySchedule.intervals.some((interval) => interval?.start && interval?.end);
      }
      return Boolean(daySchedule.start && daySchedule.end);
    })
    .map((day) => {
      const daySchedule = schedule[day];
      const intervals = Array.isArray(daySchedule.intervals)
        ? daySchedule.intervals.filter((interval) => interval?.start && interval?.end)
        : [];
      const times =
        intervals.length > 0
          ? intervals.map((interval) => `${formatClock(interval.start)}–${formatClock(interval.end)}`).join(', ')
          : daySchedule.start && daySchedule.end
            ? `${formatClock(daySchedule.start)}–${formatClock(daySchedule.end)}`
            : 'Available';
      return { day: dayAbbrev[day], times };
    });
}

export function OperatorInstagramLink({ handle }: { handle?: string | null }) {
  const cleaned = handle?.trim().replace(/^@/, '');
  if (!cleaned) return null;
  return (
    <a
      href={`https://instagram.com/${cleaned}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-purple-600 hover:to-pink-600 hover:shadow-md"
    >
      <Instagram className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">@{cleaned}</span>
    </a>
  );
}

export function WeeklyAvailability({ schedule }: { schedule: WeeklySchedule | null | undefined }) {
  const hours = formatWeeklyAvailability(schedule);
  if (hours.length === 0) return null;
  return (
    <div className="pt-1">
      <div className="overflow-hidden rounded-lg border border-[#e5e5e5]">
        {hours.map(({ day, times }, index) => (
          <div
            key={day}
            className={`grid grid-cols-[4.5rem_minmax(0,1fr)] text-sm ${index < hours.length - 1 ? 'border-b border-[#e5e5e5]' : ''}`}
          >
            <span className="px-3 py-2 font-semibold text-[#171717]">{day}</span>
            <span className="border-l border-[#e5e5e5] px-3 py-2 text-right text-[#525252]">{times}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function offeredServices(barber: Barber): ServiceType[] {
  const kind = (barber.provider_type || 'barber').toLowerCase() === 'beauty' ? 'beauty' : 'barber';
  const offered = new Set(
    (barber.pricing || [])
      .map((entry) => entry.name?.trim().toLowerCase())
      .filter(Boolean) as string[]
  );
  (barber.specialties || []).forEach((name) => offered.add(name.trim().toLowerCase()));
  return SERVICE_TYPES.filter((service) => {
    if ((service.providerType || 'barber') !== kind) return false;
    return offered.has(service.name.toLowerCase()) || offered.has(service.id.toLowerCase());
  });
}

function specialtyPrices(barber: Barber, options: ServiceType[]): Record<string, number> {
  const priceByKey: Record<string, number> = {};
  for (const entry of barber.pricing || []) {
    const amount = Number(entry.price);
    if (!Number.isFinite(amount)) continue;
    if (entry.name?.trim()) priceByKey[entry.name.trim().toLowerCase()] = amount;
    if (entry.id?.trim()) priceByKey[entry.id.trim().toLowerCase()] = amount;
  }
  for (const service of options) {
    const price = priceByKey[service.name.toLowerCase()] ?? priceByKey[service.id.toLowerCase()];
    if (price != null) priceByKey[service.id.toLowerCase()] = price;
  }
  return priceByKey;
}

export default function DiscoverClientPortfolio({
  barber,
  latitude,
  longitude,
  onBook,
  className = 'border-b border-[#e5e5e5] pb-6 last:border-b-0',
}: {
  barber: Barber;
  latitude: number | null;
  longitude: number | null;
  onBook?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [showAllWork, setShowAllWork] = useState(false);
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewCloseTimer = useRef<number | null>(null);

  const name = barberDisplayName(barber);
  const photo = barberPhotoUrl(barber);
  const distanceLabel = formatBarberDistanceFromUser(
    getBarberDistanceMilesFromTown(barber, latitude, longitude)
  );
  const options = useMemo(() => offeredServices(barber), [barber]);
  const prices = useMemo(() => specialtyPrices(barber, options), [barber, options]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOpenSectionId(null);
    setPreviewVisible(false);
    setPreviewItem(null);
    api
      .get<{ items?: PortfolioItem[]; specialtyIds?: string[] }>(`/barbers/${barber.id}/operator-portfolio/preview`)
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setSectionOrder(Array.isArray(data?.specialtyIds) ? data.specialtyIds : []);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setSectionOrder([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barber.id]);

  const orderedSectionIds = useMemo(() => {
    const sectionIds = Array.from(
      new Set([...options.map((option) => option.id), ...items.flatMap((item) => itemSpecialties(item))])
    );
    const known = new Set(sectionIds);
    const kept = sectionOrder.filter((id) => known.has(id));
    return [...kept, ...sectionIds.filter((id) => !kept.includes(id))];
  }, [options, items, sectionOrder]);
  const workChips = orderedSectionIds.filter((specialtyId) =>
    items.some((item) => itemSpecialties(item)[0] === specialtyId)
  );
  const openItems = openSectionId ? items.filter((item) => itemSpecialties(item)[0] === openSectionId) : [];
  const shownWork = showAllWork ? openItems : openItems.slice(0, 8);

  const openPreview = (item: PortfolioItem) => {
    if (previewCloseTimer.current) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
    setPreviewItem(item);
    setPreviewVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPreviewVisible(true));
    });
  };

  const closePreview = () => {
    setPreviewVisible(false);
    if (previewCloseTimer.current) return;
    previewCloseTimer.current = window.setTimeout(() => {
      previewCloseTimer.current = null;
      setPreviewItem(null);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (previewCloseTimer.current) window.clearTimeout(previewCloseTimer.current);
    };
  }, []);

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#5a7268] text-xl font-semibold text-white">
              {(name.trim().charAt(0) || 'O').toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold text-[#171717]">{name}</p>
            {distanceLabel && <p className="truncate text-sm text-[#525252]">{distanceLabel}</p>}
            <OperatorInstagramLink handle={barber.instagram_handle} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onBook) {
              onBook();
              return;
            }
            const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
            navigate(`${platformPrefix}/consumer/book/${barber.id}`);
          }}
          className="h-16 w-48 shrink-0 rounded-lg bg-[#5a7268] px-6 text-xl font-semibold text-white hover:bg-[#445750]"
        >
          Book
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-[#737373]">Loading portfolio…</p>
      ) : openSectionId ? (
        <>
          <div className="relative mb-4 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setOpenSectionId(null);
                setShowAllWork(false);
                closePreview();
              }}
              className="absolute left-0 text-sm font-medium text-[#525252] hover:text-[#171717]"
            >
              ‹ All specialties
            </button>
            <h3 className="px-36 text-center text-2xl font-bold text-[#171717]">
              {specialtyLabel(openSectionId, options)}
              {priceForSpecialty(openSectionId, options, prices) && (
                <span className="ml-2">{priceForSpecialty(openSectionId, options, prices)}</span>
              )}
            </h3>
          </div>
          {shownWork.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {shownWork.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openPreview(item)}
                  className="relative block w-full rounded-lg hover:outline hover:outline-2 hover:outline-[#171717] hover:-outline-offset-2"
                  aria-label={`${item.media_type === 'video' ? 'Video' : 'Photo'}, ${specialtyLabel(itemSpecialties(item)[0] || '', options)}`}
                >
                  <span className="block aspect-[9/16] overflow-hidden rounded-lg bg-[#f5f5f5]">
                    {item.media_type === 'video' ? (
                      <video src={item.media_url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={item.media_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {openItems.length > 8 && !showAllWork && (
            <button
              type="button"
              onClick={() => setShowAllWork(true)}
              className="mt-4 text-sm font-medium text-[#171717] hover:underline"
            >
              See all work
            </button>
          )}
        </>
      ) : workChips.length > 0 ? (
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,496px)_minmax(11rem,1fr)]">
          <div className="grid grid-cols-3 gap-2">
            {workChips.map((specialtyId) => {
              const label = specialtyLabel(specialtyId, options);
              const sectionItems = items.filter((item) => itemSpecialties(item)[0] === specialtyId);
              const tile = sectionCover(sectionItems, specialtyId) ?? sectionItems[0];
              if (!tile) return null;
              const price = priceForSpecialty(specialtyId, options, prices);
              return (
                <div key={specialtyId} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSectionId(specialtyId);
                      setShowAllWork(false);
                      closePreview();
                    }}
                    className="relative block w-full rounded-lg hover:outline hover:outline-2 hover:outline-[#171717] hover:-outline-offset-2"
                    aria-label={`${label} section`}
                  >
                    <span className="block aspect-[9/16] overflow-hidden rounded-lg bg-[#f5f5f5]">
                      {tile.media_type === 'video' ? (
                        <video src={tile.media_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={tile.media_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                  </button>
                  <p className="mt-2 flex items-baseline justify-center gap-1.5 text-sm font-semibold text-[#171717]">
                    <span className="truncate">{label}</span>
                    {price && <span className="shrink-0">{price}</span>}
                  </p>
                </div>
              );
            })}
          </div>
          <WeeklyAvailability schedule={barber.weekly_schedule} />
        </div>
      ) : (
        <WeeklyAvailability schedule={barber.weekly_schedule} />
      )}
      {previewItem &&
        createPortal(
          <div
            className={`fixed inset-0 z-[1200] flex items-center justify-center p-4 transition-colors duration-150 ${
              previewVisible ? 'bg-[rgba(23,23,23,0.45)]' : 'bg-transparent'
            }`}
            onClick={() => closePreview()}
          >
            <div
              className={`flex max-h-[85dvh] w-full max-w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)] transition-all duration-150 ${
                previewVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              {previewItem.media_type === 'video' ? (
                <video src={previewItem.media_url} controls className="aspect-[9/16] min-h-0 w-full max-h-[calc(85dvh-3.25rem)] rounded-t-2xl bg-black object-cover" />
              ) : (
                <img src={previewItem.media_url} alt="" className="aspect-[9/16] min-h-0 w-full max-h-[calc(85dvh-3.25rem)] rounded-t-2xl object-cover" />
              )}
              <div className="relative flex shrink-0 items-center justify-center rounded-b-2xl px-4 py-3">
                <p className="text-center text-sm font-semibold text-[#171717]">
                  {specialtyLabel(itemSpecialties(previewItem)[0] || '', options)}
                  {priceForSpecialty(itemSpecialties(previewItem)[0] || '', options, prices) && (
                    <span className="ml-1.5">{priceForSpecialty(itemSpecialties(previewItem)[0] || '', options, prices)}</span>
                  )}
                </p>
                <button type="button" onClick={() => closePreview()} className="absolute right-4 text-sm font-medium text-[#525252]">
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
