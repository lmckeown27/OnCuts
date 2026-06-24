/**
 * AvailableTimePickerDropdown Component
 *
 * Booking time picker constrained to barber schedule slots from the availability API.
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, Loader2, ChevronDown } from 'lucide-react';
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
  appointmentDurationMinutes?: number;
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
  /** Length of the appointment in minutes (from barber's service settings) */
  appointmentDurationMinutes?: number;
}

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

const formatTimeDisplay = (time24: string): string => {
  if (!time24) return '';

  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';

  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour < 12 ? 'am' : 'pm';

  return `${displayHour}:${minute}${period}`;
};

export default function AvailableTimePickerDropdown({
  barberId,
  date,
  value,
  onChange,
  label,
  disabled = false,
  className = '',
  excludeBookingId,
  appointmentDurationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
}: AvailableTimePickerDropdownProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  const availabilityUrl = useMemo(() => {
    if (!barberId || !date) return null;
    const params = new URLSearchParams({
      date,
      durationMinutes: String(appointmentDurationMinutes),
    });
    if (excludeBookingId) {
      params.set('excludeBookingId', excludeBookingId);
    }
    return `/barbers/${barberId}/availability?${params.toString()}`;
  }, [barberId, date, excludeBookingId, appointmentDurationMinutes]);

  useEffect(() => {
    if (barberId && date) {
      fetchAvailability();
    } else {
      setAvailableTimes([]);
      setError(null);
    }
  }, [availabilityUrl]);

  useEffect(() => {
    if (value && availableTimes.length > 0 && !availableTimes.includes(value)) {
      onChange('');
    }
  }, [availableTimes, value, onChange]);

  const fetchAvailability = async () => {
    if (!availabilityUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<AvailabilityResponse>(availabilityUrl);

      if (!response?.available || !response.slots?.length) {
        setAvailableTimes([]);
        if (value) onChange('');
        return;
      }

      const times = response.slots
        .filter((slot) => slot.available)
        .map((slot) => slot.time);

      setAvailableTimes(times);

      if (value && !times.includes(value)) {
        onChange('');
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      setError('Failed to load available times');
      setAvailableTimes([]);
      if (value) onChange('');
    } finally {
      setIsLoading(false);
    }
  };

  const hasAvailability = availableTimes.length > 0;
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
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <select
          value={value || ''}
          disabled={isDisabled}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full appearance-none rounded-lg border py-2 pl-9 pr-9 text-sm
            transition-all duration-150
            ${isDisabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : error
                ? 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200'
                : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-400'
            }
          `}
          aria-label={label || 'Select time'}
        >
          <option value="" disabled>
            {isLoading ? 'Loading times...' : hasAvailability ? 'Select a time' : 'No times available'}
          </option>
          {availableTimes.map((time) => (
            <option key={time} value={time}>
              {formatTimeDisplay(time)}
            </option>
          ))}
        </select>
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

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {value && !error && (
        <p className="mt-1 text-xs text-gray-500">
          {formatTimeDisplay(value)} · {appointmentDurationMinutes}-minute appointment
        </p>
      )}
    </div>
  );
}
