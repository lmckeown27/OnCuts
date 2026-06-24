/**
 * TimePickerDropdown Component
 *
 * Minute-precision time selection using the native time input.
 */

import { Clock } from 'lucide-react';

interface TimeInterval {
  start: string; // HH:MM format (24-hour)
  end: string;   // HH:MM format (24-hour)
}

interface TimePickerDropdownProps {
  value: string; // HH:MM format (24-hour)
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  minTime?: string; // Optional minimum time (HH:MM)
  maxTime?: string; // Optional maximum time (HH:MM)
  availableIntervals?: TimeInterval[]; // Optional: constrain min/max to these intervals
  className?: string;
}

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

function resolveMinMaxTime(
  minTime?: string,
  maxTime?: string,
  availableIntervals?: TimeInterval[]
): { min?: string; max?: string } {
  let min = minTime;
  let max = maxTime;

  if (availableIntervals && availableIntervals.length > 0) {
    const starts = availableIntervals.map((i) => timeToMinutes(i.start));
    const ends = availableIntervals.map((i) => timeToMinutes(i.end));
    const intervalMin = minutesToTime(Math.min(...starts));
    const intervalMax = minutesToTime(Math.max(...ends) - 1);
    min = min ? (timeToMinutes(min) > timeToMinutes(intervalMin) ? min : intervalMin) : intervalMin;
    max = max ? (timeToMinutes(max) < timeToMinutes(intervalMax) ? max : intervalMax) : intervalMax;
  }

  return { min, max };
}

export default function TimePickerDropdown({
  value,
  onChange,
  label,
  disabled = false,
  minTime,
  maxTime,
  availableIntervals,
  className = '',
}: TimePickerDropdownProps) {
  const { min, max } = resolveMinMaxTime(minTime, maxTime, availableIntervals);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs text-gray-600 mb-1">{label}</label>
      )}

      <div className="relative">
        <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="time"
          step={60}
          value={value || ''}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full rounded-lg border py-2 pl-9 pr-3 text-sm
            transition-all duration-150
            ${disabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-400'
            }
          `}
          aria-label={label || 'Select time'}
        />
      </div>

      {value && (
        <p className="mt-1 text-xs text-gray-500">{formatTimeDisplay(value)}</p>
      )}
    </div>
  );
}
