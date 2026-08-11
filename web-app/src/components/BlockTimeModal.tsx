/**
 * Block Time — bottom-sheet editor matching iOS ProviderTimeBlockEditorSheet.
 * Date + optional entire-day toggle + start/end + Block CTA. No reason field.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, Loader2, X } from 'lucide-react';
import DatePicker from './DatePicker';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import barberService from '../services/barber.service';
import { resolveBookingAppointmentDuration } from '../config/services';
import { colors } from '../utils/colors';

interface BlockTimeModalProps {
  isVisible: boolean;
  onClose: () => void;
  /** When set, shows a back chevron that returns to Edit Schedule instead of fully dismissing. */
  onBack?: () => void;
  barberId: string;
  initialDate?: string; // YYYY-MM-DD
  initialStartTime?: string; // HH:MM
  initialEndTime?: string; // HH:MM
}

type ConflictingBooking = {
  id: string;
  scheduledTime: string;
  status: string;
  serviceType?: string;
  serviceName?: string;
  durationMinutes?: number;
  consumer?: { firstName?: string; lastName?: string };
};

const CONFLICT_STATUSES = new Set(['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

const pad2 = (n: number) => String(n).padStart(2, '0');

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const toHHMM = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Yesterday in local YYYY-MM-DD (picker lower bound, matching iOS). */
const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
};

/** Default partial window: now+1h → +1h on a given calendar day. */
function defaultPartialWindow(onDateStr?: string): {
  date: string;
  start: string;
  end: string;
} {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);
  const end = new Date(base.getTime() + 60 * 60 * 1000);

  if (onDateStr) {
    const [y, m, day] = onDateStr.split('-').map(Number);
    const startOnDay = new Date(y, m - 1, day, base.getHours(), base.getMinutes(), 0, 0);
    const endOnDay = new Date(startOnDay.getTime() + 60 * 60 * 1000);
    return { date: onDateStr, start: toHHMM(startOnDay), end: toHHMM(endOnDay) };
  }

  return { date: toDateStr(base), start: toHHMM(base), end: toHHMM(end) };
}

const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${pad2(minutes)} ${period}`;
};

const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${pad2(hour)}:${pad2(minute)}`;
      options.push({ value: timeStr, label: formatTimeForDisplay(timeStr) });
    }
  }
  // Include 23:59 for entire-day end clarity if ever needed in partial pickers
  if (!options.some((o) => o.value === '23:59')) {
    options.push({ value: '23:59', label: formatTimeForDisplay('23:59') });
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

function parseBookingLocalParts(iso: string): { date: string; startMinutes: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: toDateStr(d),
    startMinutes: d.getHours() * 60 + d.getMinutes(),
  };
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

const BlockTimeModal: React.FC<BlockTimeModalProps> = ({
  isVisible,
  onClose,
  onBack,
  barberId,
  initialDate,
  initialStartTime,
  initialEndTime,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(getYesterdayStr());
  const [blocksEntireDay, setBlocksEntireDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setError(null);

      const hasSlotPrefill = Boolean(initialDate && initialStartTime);
      if (hasSlotPrefill) {
        setBlocksEntireDay(false);
        setSelectedDate(initialDate!);
        setStartTime(initialStartTime!);
        const end =
          initialEndTime && initialEndTime > initialStartTime!
            ? initialEndTime
            : (() => {
                const mins = hhmmToMinutes(initialStartTime!) + 60;
                return `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;
              })();
        setEndTime(end);
      } else {
        // Schedule hub default: partial day, ~now+1h for 1 hour
        const defaults = defaultPartialWindow(initialDate);
        setBlocksEntireDay(false);
        setSelectedDate(defaults.date);
        setStartTime(defaults.start);
        setEndTime(defaults.end);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, initialDate, initialStartTime, initialEndTime]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => onClose(), 200);
  };

  const handleBack = () => {
    if (!onBack) {
      handleClose();
      return;
    }
    setIsAnimating(false);
    setTimeout(() => onBack(), 200);
  };

  const effectiveRange = useMemo(() => {
    if (blocksEntireDay) return { start: '00:00', end: '23:59' };
    return { start: startTime, end: endTime };
  }, [blocksEntireDay, startTime, endTime]);

  const applyDefaultsForDate = (dateStr: string) => {
    const defaults = defaultPartialWindow(dateStr);
    setStartTime(defaults.start);
    setEndTime(defaults.end);
  };

  const handleEntireDayToggle = (on: boolean) => {
    setBlocksEntireDay(on);
    setError(null);
    if (!on) {
      applyDefaultsForDate(selectedDate);
    }
  };

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    setError(null);
    if (!blocksEntireDay) {
      applyDefaultsForDate(dateStr);
    }
  };

  const findConflicts = async (): Promise<ConflictingBooking[]> => {
    const response = await api.get<{ bookings: ConflictingBooking[] }>('/bookings-simple', {
      role: 'barber',
      status: 'PENDING,ACCEPTED,IN_PROGRESS,COMPLETED',
    });
    const bookings = response.bookings || [];
    const rangeStart = hhmmToMinutes(effectiveRange.start);
    const rangeEnd = hhmmToMinutes(effectiveRange.end);

    return bookings.filter((b) => {
      const status = String(b.status || '').toUpperCase();
      if (!CONFLICT_STATUSES.has(status)) return false;
      const parts = parseBookingLocalParts(b.scheduledTime);
      if (!parts || parts.date !== selectedDate) return false;
      const duration = resolveBookingAppointmentDuration(b);
      const bStart = parts.startMinutes;
      const bEnd = bStart + duration;
      return rangesOverlap(rangeStart, rangeEnd, bStart, bEnd);
    });
  };

  const formatConflictMessage = (conflicts: ConflictingBooking[]): string => {
    const action = blocksEntireDay ? 'blocking this day' : 'blocking this time';
    const header =
      conflicts.length === 1
        ? `You have an appointment during this time. Move it to another date/time before ${action}.`
        : `You have ${conflicts.length} appointments during the affected times. Move them to another date/time before ${action}.`;

    const lines = conflicts.slice(0, 5).map((b) => {
      const name = [b.consumer?.firstName, b.consumer?.lastName].filter(Boolean).join(' ') || 'Client';
      const service = b.serviceName || b.serviceType || 'Service';
      const when = new Date(b.scheduledTime).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return `• ${name} · ${service} · ${when}`;
    });
    const more =
      conflicts.length > 5 ? `\n…and ${conflicts.length - 5} more.` : '';
    return [header, ...lines].join('\n') + more;
  };

  const handleBlock = async () => {
    setError(null);

    if (!blocksEntireDay && effectiveRange.start >= effectiveRange.end) {
      setError('End time must be after start time.');
      return;
    }

    try {
      setSaving(true);
      const conflicts = await findConflicts();
      if (conflicts.length > 0) {
        setError(formatConflictMessage(conflicts));
        return;
      }

      await barberService.createTimeBlock(barberId, {
        blockDate: selectedDate,
        startTime: effectiveRange.start,
        endTime: effectiveRange.end,
      });

      toast.success(blocksEntireDay ? 'Day blocked' : 'Time blocked');
      if (onBack) {
        handleBack();
      } else {
        handleClose();
      }
    } catch (err: unknown) {
      console.error('Failed to create time block:', err);
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ||
            (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(msg || 'Could not save time block.');
    } finally {
      setSaving(false);
    }
  };

  if (!shouldRender) return null;

  const olive = colors.olive?.[600] || colors.olive?.[500] || '#556B2F';

  return (
    <div
      className={`fixed inset-0 z-50 min-h-[100dvh] flex items-end sm:items-center justify-center transition-colors duration-200 ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-stone-50 w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out ${
          isAnimating
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Block Time"
      >
        {/* Drag indicator (bottom-sheet chrome) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-stone-200/80 shrink-0 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-stone-200/60 rounded-full transition-colors shrink-0"
                aria-label="Back to Edit Schedule"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 truncate">Block Time</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-stone-200/60 rounded-full transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</h3>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              minDate={getYesterdayStr()}
              label=""
              required
            />
          </section>

          <section className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
            <label htmlFor="block-entire-day" className="text-sm font-medium text-gray-900">
              Block entire day
            </label>
            <button
              id="block-entire-day"
              type="button"
              role="switch"
              aria-checked={blocksEntireDay}
              onClick={() => handleEntireDayToggle(!blocksEntireDay)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                blocksEntireDay ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  blocksEntireDay ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </section>

          {!blocksEntireDay && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Time</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <select
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setError(null);
                      if (e.target.value >= endTime) {
                        const mins = hhmmToMinutes(e.target.value) + 60;
                        setEndTime(`${pad2(Math.min(23, Math.floor(mins / 60)))}:${pad2(mins % 60)}`);
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                  >
                    {TIME_OPTIONS.filter((o) => o.value !== '23:59').map((opt) => (
                      <option key={`s-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <select
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={`e-${opt.value}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          <section className="pt-1">
            <button
              type="button"
              onClick={() => void handleBlock()}
              disabled={saving || !barberId}
              className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white transition-opacity disabled:opacity-45"
              style={{ backgroundColor: olive }}
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                'Block'
              )}
            </button>
          </section>

          {error && (
            <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex gap-2 text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm whitespace-pre-line leading-relaxed">{error}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockTimeModal;
