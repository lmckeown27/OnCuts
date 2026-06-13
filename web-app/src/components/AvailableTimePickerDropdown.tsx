/**
 * AvailableTimePickerDropdown Component
 *
 * Minute-precision booking time picker validated against barber availability,
 * existing bookings, and manual blocks.
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import api from '../services/api.service';

interface TimeInterval {
  id: string;
  start: string;
  end: string;
}

interface AvailabilityResponse {
  date: string;
  dayOfWeek: string;
  available: boolean;
  intervals: TimeInterval[];
  bookedSlots: { start: string; end: string }[];
  slots: { time: string; available: boolean }[];
}

interface AvailableTimePickerDropdownProps {
  barberId: string;
  date: string; // YYYY-MM-DD format
  value: string; // HH:MM format (24-hour)
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** When editing an existing booking, exclude it from conflict checks */
  excludeBookingId?: string;
}

const APPOINTMENT_DURATION_MINUTES = 60;

const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const minutesToTime = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const formatTimeDisplay = (time24: string): string => {
  if (!time24) return '';

  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';

  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour < 12 ? 'am' : 'pm';

  return `${displayHour}:${minute}${period}`;
};

function isStartWithinIntervals(time: string, intervals: TimeInterval[]): boolean {
  const mins = timeToMinutes(time);
  return intervals.some(
    (interval) => mins >= timeToMinutes(interval.start) && mins < timeToMinutes(interval.end)
  );
}

function overlapsBookedSlot(
  time: string,
  bookedSlots: { start: string; end: string }[]
): boolean {
  const start = timeToMinutes(time);
  const end = start + APPOINTMENT_DURATION_MINUTES;

  return bookedSlots.some((booked) => {
    const bookedStart = timeToMinutes(booked.start);
    const bookedEnd = timeToMinutes(booked.end);
    return start < bookedEnd && end > bookedStart;
  });
}

function validateSelectedTime(
  time: string,
  intervals: TimeInterval[],
  bookedSlots: { start: string; end: string }[],
  minTimeMinutes?: number
): string | null {
  if (!time) return null;
  if (!intervals.length) return 'No availability for this date';
  if (minTimeMinutes !== undefined && timeToMinutes(time) < minTimeMinutes) {
    return 'Choose a future time';
  }
  if (!isStartWithinIntervals(time, intervals)) {
    return 'Outside available hours';
  }
  if (overlapsBookedSlot(time, bookedSlots)) {
    return 'This time conflicts with an existing booking or block';
  }
  return null;
}

export default function AvailableTimePickerDropdown({
  barberId,
  date,
  value,
  onChange,
  label,
  disabled = false,
  className = '',
  excludeBookingId,
}: AvailableTimePickerDropdownProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intervals, setIntervals] = useState<TimeInterval[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ start: string; end: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [minTimeMinutes, setMinTimeMinutes] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (barberId && date) {
      fetchAvailability();
    } else {
      setIntervals([]);
      setBookedSlots([]);
      setError(null);
      setMinTimeMinutes(undefined);
    }
  }, [barberId, date, excludeBookingId]);

  const availabilityUrl = useMemo(() => {
    if (!barberId || !date) return null;
    const params = new URLSearchParams({ date });
    if (excludeBookingId) {
      params.set('excludeBookingId', excludeBookingId);
    }
    return `/barbers/${barberId}/availability?${params.toString()}`;
  }, [barberId, date, excludeBookingId]);

  const { minTime, maxTime } = useMemo(() => {
    if (intervals.length === 0) {
      return { minTime: undefined, maxTime: undefined };
    }

    const starts = intervals.map((i) => timeToMinutes(i.start));
    const ends = intervals.map((i) => timeToMinutes(i.end));
    const computedMin = Math.min(...starts);
    const computedMax = Math.max(...ends) - 1;

    return {
      minTime: minutesToTime(Math.max(computedMin, minTimeMinutes ?? computedMin)),
      maxTime: minutesToTime(Math.max(computedMin, computedMax)),
    };
  }, [intervals, minTimeMinutes]);

  const fetchAvailability = async () => {
    if (!availabilityUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<AvailabilityResponse>(availabilityUrl);

      if (!response) {
        setIntervals([]);
        setBookedSlots([]);
        setError('No availability data received');
        return;
      }

      const { available, intervals: apiIntervals, bookedSlots: apiBookedSlots, slots: apiSlots } = response;

      if (!available || !apiIntervals || apiIntervals.length === 0) {
        setIntervals([]);
        setBookedSlots([]);
        setError(null);
        return;
      }

      setIntervals(apiIntervals);
      setBookedSlots(apiBookedSlots || []);

      const earliestOpenSlot = apiSlots?.find((slot) => slot.available)?.time;
      if (earliestOpenSlot) {
        setMinTimeMinutes(timeToMinutes(earliestOpenSlot));
      } else {
        setMinTimeMinutes(undefined);
      }

      if (value) {
        const nextError = validateSelectedTime(
          value,
          apiIntervals,
          apiBookedSlots || [],
          earliestOpenSlot ? timeToMinutes(earliestOpenSlot) : undefined
        );
        setValidationError(nextError);
        if (nextError) {
          onChange('');
        }
      } else {
        setValidationError(null);
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      setError('Failed to load available times');
      setIntervals([]);
      setBookedSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeChange = (nextValue: string) => {
    onChange(nextValue);
    setValidationError(
      nextValue
        ? validateSelectedTime(nextValue, intervals, bookedSlots, minTimeMinutes)
        : null
    );
  };

  const hasAvailability = intervals.length > 0;
  const displayError = error || validationError;
  const isDisabled = disabled || isLoading || !date || !hasAvailability;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs text-gray-600 mb-1">{label}</label>
      )}

      <div className="relative">
        {isLoading ? (
          <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        ) : (
          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}

        <input
          type="time"
          step={60}
          value={value || ''}
          min={minTime}
          max={maxTime}
          disabled={isDisabled}
          onChange={(e) => handleTimeChange(e.target.value)}
          className={`
            w-full rounded-lg border py-2 pl-9 pr-3 text-sm
            transition-all duration-150
            ${isDisabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : displayError
                ? 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200'
                : 'border-gray-300 bg-white text-gray-900 hover:border-primary-400 focus:border-transparent focus:ring-2 focus:ring-primary-400'
            }
          `}
          aria-label={label || 'Select time'}
        />
      </div>

      {isLoading && (
        <p className="mt-1 text-xs text-gray-500">Loading availability...</p>
      )}

      {!isLoading && !date && (
        <p className="mt-1 text-xs text-gray-500">Select a date first</p>
      )}

      {!isLoading && date && !hasAvailability && !error && (
        <p className="mt-1 text-xs text-gray-500">No available times for this date</p>
      )}

      {displayError && (
        <p className="mt-1 text-xs text-red-600">{displayError}</p>
      )}

      {value && !displayError && (
        <p className="mt-1 text-xs text-gray-500">{formatTimeDisplay(value)}</p>
      )}

      {hasAvailability && !displayError && (
        <p className="mt-1 text-xs text-gray-500">
          Choose any minute within the barber&apos;s open hours. Appointments block 1 hour.
        </p>
      )}
    </div>
  );
}
