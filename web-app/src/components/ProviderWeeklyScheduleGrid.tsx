import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimeBlock } from '../services/barber.service';

const SLOT_MINUTES = 5;
const ROW_HEIGHT_PX = 10;
const VISIBLE_HOURS = 5;
const VISIBLE_GRID_HEIGHT_PX = (VISIBLE_HOURS * 60 / SLOT_MINUTES) * ROW_HEIGHT_PX;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type DayKey = (typeof DAY_NAMES)[number];

export interface ScheduleBooking {
  id: string;
  scheduledTime: string;
  durationMinutes?: number;
  status: string;
  priceUsdCents: number;
  serviceType: string;
  serviceName?: string;
  paidAt?: string;
  consumer: {
    firstName: string;
    lastName: string;
  };
}

interface DaySchedule {
  enabled?: boolean;
  start?: string;
  end?: string;
  intervals?: { start: string; end: string }[];
}

export interface WeeklyScheduleMap {
  [key: string]: DaySchedule | undefined;
}

interface ProviderWeeklyScheduleGridProps {
  weekOffset: number;
  getToday: () => Date;
  campusTimezone?: string;
  weeklySchedule: WeeklyScheduleMap | null;
  timeBlocks: TimeBlock[];
  bookings: ScheduleBooking[];
  // Google Calendar integration (disabled)
  // googleCalendarBusyTimes: Array<{ start: Date; end: Date }>;
  isLoading?: boolean;
  onBlockTime?: (date: string, startTime: string, endTime: string) => void;
  onUnblockTime?: (blockId: string) => void;
  onViewBooking?: (booking: ScheduleBooking) => void;
  // googleCalendarConnected?: boolean | null;
  // googleCalendarLoading?: boolean;
  // onConnectGoogleCalendar?: () => void;
  // onDisconnectGoogleCalendar?: () => void;
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateKey = (value: unknown): string => {
  if (value == null) return '';
  const ymd = String(value).trim().slice(0, 10);
  return DATE_KEY_RE.test(ymd) ? ymd : '';
};

const currentMinutesInTimeZone = (timeZone?: string): number => {
  const now = new Date();
  if (!timeZone) return now.getHours() * 60 + now.getMinutes();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
};

type TimeBlockLike = TimeBlock & {
  block_date?: string;
  start_time?: string;
  end_time?: string;
};

const blockDateKey = (block: TimeBlockLike): string =>
  normalizeDateKey(block.blockDate ?? block.block_date);

const blockTimeRange = (block: TimeBlockLike): { start: number; end: number } | null => {
  const start = timeToMinutes(String(block.startTime ?? block.start_time ?? ''));
  const end = timeToMinutes(String(block.endTime ?? block.end_time ?? ''));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatTime12 = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

const getDayIntervals = (daySchedule?: DaySchedule): { start: string; end: string }[] => {
  if (!daySchedule?.enabled) return [];
  if (daySchedule.intervals && Array.isArray(daySchedule.intervals)) {
    return daySchedule.intervals.map(i => ({ start: i.start, end: i.end }));
  }
  if (daySchedule.start && daySchedule.end) {
    return [{ start: daySchedule.start, end: daySchedule.end }];
  }
  return [];
};

export function getWeekStartMonday(today: Date, weekOffset: number): Date {
  const start = new Date(today);
  const todayDay = start.getDay();
  const daysFromMonday = todayDay === 0 ? 6 : todayDay - 1;
  start.setDate(start.getDate() - daysFromMonday + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function buildWeekDays(startOfWeek: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return {
      date,
      dayKey: DAY_NAMES[date.getDay()] as DayKey,
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      shortName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: false as boolean,
    };
  });
}

type SlotStatus = 'unavailable' | 'open' | 'booked' | 'blocked';

const getMinutesFromDate = (date: Date) => date.getHours() * 60 + date.getMinutes();

const getTimeRangeLayout = (startMin: number, endMin: number, gridStartMin: number) => {
  const top = ((startMin - gridStartMin) / SLOT_MINUTES) * ROW_HEIGHT_PX;
  const height = ((endMin - startMin) / SLOT_MINUTES) * ROW_HEIGHT_PX;
  return { top, height: Math.max(height, ROW_HEIGHT_PX) };
};

const PAID_OR_COMPLETED_STATUSES = new Set(['COMPLETED', 'PAID']);

const formatBookingStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Awaiting payment',
    PAID: 'Paid',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Awaiting tip',
    DISPUTED: 'Disputed',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
  };
  return labels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const isPaidOrCompletedBookingStatus = (status: string) =>
  PAID_OR_COMPLETED_STATUSES.has(status);

const getBookingBlockStyles = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING') {
    return {
      button:
        'border-amber-300/80 bg-amber-100 hover:border-amber-400 hover:bg-amber-200 focus-visible:ring-amber-500',
      nameText: 'text-amber-950',
      statusText: 'text-amber-800',
    };
  }
  if (isPaidOrCompletedBookingStatus(normalized)) {
    return {
      button:
        'border-green-300/70 bg-green-100 hover:border-green-400/80 hover:bg-green-200 focus-visible:ring-green-500',
      nameText: 'text-green-900',
      statusText: 'text-green-700',
    };
  }

  return {
    button:
      'border-[#5C6B2E]/60 bg-[#B8C97A] hover:border-[#4A5624]/70 hover:bg-[#A8B96A] focus-visible:ring-[#5C6B2E]',
    nameText: 'text-[#2F3A14]',
    statusText: 'text-[#3D4A1F]/80',
  };
};

// Google Calendar icon (disabled)
// function GoogleCalendarIcon() { ... }

export default function ProviderWeeklyScheduleGrid({
  weekOffset,
  getToday,
  campusTimezone,
  weeklySchedule,
  timeBlocks,
  bookings,
  isLoading = false,
  onBlockTime,
  onUnblockTime,
  onViewBooking,
}: ProviderWeeklyScheduleGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = getToday();
  const todayStr = today.toDateString();
  const [nowMin, setNowMin] = useState(() => currentMinutesInTimeZone(campusTimezone));

  useEffect(() => {
    const tick = () => setNowMin(currentMinutesInTimeZone(campusTimezone));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [campusTimezone]);

  const startOfWeek = useMemo(() => getWeekStartMonday(today, weekOffset), [today, weekOffset]);

  const weekDays = useMemo(() => {
    const days = buildWeekDays(startOfWeek);
    return days.map(d => ({ ...d, isToday: d.date.toDateString() === todayStr }));
  }, [startOfWeek, todayStr]);

  const endOfWeek = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(startOfWeek.getDate() + 7);
    return end;
  }, [startOfWeek]);

  const weekBookings = useMemo(
    () =>
      bookings.filter(b => {
        const d = new Date(b.scheduledTime);
        return d >= startOfWeek && d < endOfWeek;
      }),
    [bookings, startOfWeek, endOfWeek]
  );

  const { gridStartMin, gridEndMin, timeRows } = useMemo(() => {
    let minStart = 24 * 60;
    let maxEnd = 0;
    let hasAnyAvailability = false;

    weekDays.forEach(day => {
      const intervals = getDayIntervals(weeklySchedule?.[day.dayKey]);
      intervals.forEach(interval => {
        hasAnyAvailability = true;
        minStart = Math.min(minStart, timeToMinutes(interval.start));
        maxEnd = Math.max(maxEnd, timeToMinutes(interval.end));
      });
    });

    if (!hasAnyAvailability) {
      return { gridStartMin: 0, gridEndMin: 0, timeRows: [] as number[] };
    }

    const start = Math.floor(minStart / SLOT_MINUTES) * SLOT_MINUTES;
    const end = Math.ceil(maxEnd / SLOT_MINUTES) * SLOT_MINUTES;
    const rows: number[] = [];
    for (let m = start; m < end; m += SLOT_MINUTES) {
      rows.push(m);
    }
    return { gridStartMin: start, gridEndMin: end, timeRows: rows };
  }, [weekDays, weeklySchedule]);

  const slotGrid = useMemo(() => {
    if (timeRows.length === 0) return null;

    return timeRows.map(slotStartMin => {
      const slotEndMin = slotStartMin + SLOT_MINUTES;
      const slotStart = minutesToTime(slotStartMin);
      const slotEnd = minutesToTime(slotEndMin);

      return weekDays.map(day => {
        const intervals = getDayIntervals(weeklySchedule?.[day.dayKey]);
        const inAvailability = intervals.some(interval => {
          const iStart = timeToMinutes(interval.start);
          const iEnd = timeToMinutes(interval.end);
          return slotStartMin >= iStart && slotEndMin <= iEnd;
        });

        if (!inAvailability) {
          return { status: 'unavailable' as SlotStatus };
        }

        const appointment = weekBookings.find(apt => {
          const aptStart = new Date(apt.scheduledTime);
          const aptStartMin = aptStart.getHours() * 60 + aptStart.getMinutes();
          const duration = apt.durationMinutes ?? 60;
          const aptEndMin = aptStartMin + duration;
          const sameDay = aptStart.toDateString() === day.date.toDateString();
          return sameDay && slotStartMin < aptEndMin && slotEndMin > aptStartMin;
        });

        if (appointment) {
          return { status: 'booked' as SlotStatus, appointmentId: appointment.id };
        }

        // Elapsed hours on today are not blocked time — show them as unavailable.
        if (day.isToday && slotEndMin <= nowMin) {
          return { status: 'unavailable' as SlotStatus };
        }

        // Do not paint the current day as blocked/red. Remaining today slots follow
        // weekly hours and bookings only.
        if (!day.isToday) {
          const blocks = Array.isArray(timeBlocks) ? timeBlocks : [];
          const block = blocks.find(b => {
            if (blockDateKey(b) !== day.dateStr) return false;
            const range = blockTimeRange(b);
            if (!range) return false;
            return slotStartMin < range.end && slotEndMin > range.start;
          });

          if (block) {
            return { status: 'blocked' as SlotStatus, block };
          }
        }

        // Google Calendar busy slots (disabled)
        // const googleBlock = googleCalendarBusyTimes.find(...)

        return {
          status: 'open' as SlotStatus,
          dateStr: day.dateStr,
          slotStart,
          slotEnd,
        };
      });
    });
  }, [timeRows, weekDays, weeklySchedule, timeBlocks, weekBookings, nowMin]);

  /* Stats footer hidden — slot counts and color legend commented out per product request.
  const stats = useMemo(() => {
    if (!slotGrid) return { open: 0, bookingCount: 0, manualBlocked: 0, googleBusyCount: 0 };
    let open = 0;
    let manualBlocked = 0;
    slotGrid.forEach(row => {
      row.forEach(cell => {
        if (cell.status === 'open') open += 1;
        else if (cell.status === 'blocked') manualBlocked += 1;
      });
    });
    const googleBusyCount = weekDays.reduce(
      (count, day) => count + getDayGoogleBusySegments(day.date, googleCalendarBusyTimes).length,
      0
    );
    return { open, bookingCount: weekBookings.length, manualBlocked, googleBusyCount };
  }, [slotGrid, weekBookings.length, weekDays, googleCalendarBusyTimes]);
  */

  const getDayBookings = (dayDate: Date) =>
    weekBookings.filter(apt => new Date(apt.scheduledTime).toDateString() === dayDate.toDateString());

  const getBookingLayout = (booking: ScheduleBooking) => {
    const aptStart = new Date(booking.scheduledTime);
    const aptStartMin = getMinutesFromDate(aptStart);
    const duration = booking.durationMinutes ?? 60;
    return getTimeRangeLayout(aptStartMin, aptStartMin + duration, gridStartMin);
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || timeRows.length === 0) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isCurrentWeek = weekDays.some(d => d.isToday);

    let targetMin: number;
    if (isCurrentWeek) {
      targetMin = Math.max(gridStartMin, nowMin - 60);
    } else {
      targetMin = gridStartMin;
    }

    const rowIndex = Math.floor((targetMin - gridStartMin) / SLOT_MINUTES);
    container.scrollTop = Math.max(0, rowIndex * ROW_HEIGHT_PX - 40);
  }, [weekOffset, timeRows.length, gridStartMin, weekDays]);

  if (isLoading) {
    return (
      <div className="text-center py-8 sm:py-12">
        <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading schedule…</p>
      </div>
    );
  }

  if (!weeklySchedule || timeRows.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center max-w-md mx-auto">
        <p className="text-sm text-gray-500 mb-1">No availability set for this week</p>
        <p className="text-xs text-gray-400">Use Edit Schedule to add your weekly hours</p>
      </div>
    );
  }

  const totalHeight = timeRows.length * ROW_HEIGHT_PX;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px mb-1 sticky top-0 z-20 bg-white">
            <div />
            {weekDays.map(day => (
              <div
                key={day.dateStr}
                className={`text-center py-2 rounded-t-lg ${
                  day.isToday ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">{day.shortName}</div>
                <div className="text-sm sm:text-base font-bold">{day.dayNumber}</div>
              </div>
            ))}
          </div>

          {/* Scrollable time grid */}
          <div
            ref={scrollRef}
            className="overflow-y-auto border border-gray-200 rounded-lg bg-white"
            style={{ maxHeight: VISIBLE_GRID_HEIGHT_PX }}
          >
            <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px relative" style={{ minHeight: totalHeight }}>
              {/* Time labels */}
              <div className="relative bg-gray-50 border-r border-gray-200" style={{ height: totalHeight }}>
                {timeRows.map((min, idx) => {
                  if (min % 30 !== 0) return null;
                  return (
                    <div
                      key={min}
                      className="absolute right-1 text-[10px] text-gray-400 leading-none -translate-y-1/2 select-none whitespace-nowrap"
                      style={{ top: idx * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2 }}
                    >
                      {formatTime12(minutesToTime(min))}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIdx) => (
                <div
                  key={day.dateStr}
                  className="relative bg-white"
                  style={{ height: totalHeight }}
                >
                  {timeRows.map((slotStartMin, rowIdx) => {
                    const cell = slotGrid?.[rowIdx]?.[dayIdx];
                    if (!cell) return null;

                    const top = rowIdx * ROW_HEIGHT_PX;
                    const showHourLine = slotStartMin % 60 === 0;

                    if (cell.status === 'unavailable') {
                      return (
                        <div
                          key={`${day.dateStr}-${slotStartMin}`}
                          className={`absolute inset-x-0 bg-gray-50/80 ${showHourLine ? 'border-t border-gray-100' : ''}`}
                          style={{ top, height: ROW_HEIGHT_PX }}
                        />
                      );
                    }

                    if (cell.status === 'booked') {
                      return null;
                    }

                    if (cell.status === 'blocked' && cell.block) {
                      return (
                        <button
                          key={`${day.dateStr}-${slotStartMin}`}
                          type="button"
                          title="Blocked. Click to unblock"
                          onClick={() => onUnblockTime?.(cell.block!.id)}
                          className={`absolute inset-x-0 bg-red-200 hover:bg-red-300 border-red-300/50 transition-colors ${
                            showHourLine ? 'border-t border-red-300/60' : ''
                          }`}
                          style={{ top, height: ROW_HEIGHT_PX }}
                        />
                      );
                    }

                    // Google Calendar slot status (disabled)
                    // if (cell.status === 'google') { return null; }

                    return (
                      <button
                        key={`${day.dateStr}-${slotStartMin}`}
                        type="button"
                        title={`${formatTime12(cell.slotStart!)} – tap to block`}
                        onClick={() => onBlockTime?.(cell.dateStr!, cell.slotStart!, cell.slotEnd!)}
                        className={`absolute inset-x-0 bg-primary-100/70 hover:bg-primary-200 border-primary-200/40 transition-colors ${
                          showHourLine ? 'border-t border-primary-200/60' : ''
                        }`}
                        style={{ top, height: ROW_HEIGHT_PX }}
                      />
                    );
                  })}

                  {/* Google Calendar busy segments (disabled)
                  {getDayGoogleBusySegments(day.date, googleCalendarBusyTimes).map(segment => { ... })}
                  */}

                  {getDayBookings(day.date).map(booking => {
                    const aptStart = new Date(booking.scheduledTime);
                    const aptStartMin = getMinutesFromDate(aptStart);
                    const duration = booking.durationMinutes ?? 60;
                    const { top, height } = getBookingLayout(booking);
                    const consumerName = `${booking.consumer.firstName} ${booking.consumer.lastName}`.trim();
                    const statusLabel = formatBookingStatusLabel(booking.status);
                    const blockStyles = getBookingBlockStyles(booking.status);
                    const startTime = formatTime12(minutesToTime(aptStartMin));
                    const endTime = formatTime12(minutesToTime(aptStartMin + duration));

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        title={`${consumerName} · ${statusLabel} · ${startTime} – ${endTime}`}
                        aria-label={`View booking: ${consumerName}, ${statusLabel}, ${startTime} to ${endTime}`}
                        onClick={() => onViewBooking?.(booking)}
                        className={`absolute inset-x-0.5 z-10 flex items-start overflow-hidden rounded-sm border text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${blockStyles.button}`}
                        style={{ top, height }}
                      >
                        {height >= 28 ? (
                          <span className="flex min-w-0 flex-col px-1 py-0.5 leading-tight">
                            <span className={`truncate text-[10px] font-semibold ${blockStyles.nameText}`}>
                              {consumerName}
                            </span>
                            <span className={`truncate text-[9px] font-medium ${blockStyles.statusText}`}>
                              {statusLabel}
                            </span>
                          </span>
                        ) : height >= 20 ? (
                          <span
                            className={`truncate px-1 py-0.5 text-[10px] font-semibold leading-tight ${blockStyles.nameText}`}
                          >
                            {consumerName} · {statusLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
        {/* Stats summary and legend hidden per product request.
        <p className="text-xs text-gray-600 text-center">
          {stats.open} open · {stats.bookingCount} booked · {stats.manualBlocked} blocked · {stats.googleBusyCount} calendar · 5-minute slots
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-primary-200" /> Open: tap to block
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-[#B8C97A] border border-[#5C6B2E]/40" /> Booked: tap for details
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-red-200" /> Blocked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-2 w-3 items-center justify-center rounded-sm border border-[#4285F4]/40 bg-[#E8F0FE]">
              <GoogleCalendarIcon />
            </span>{' '}
            Google Calendar
          </span>
        </div>
        */}
        {/* Google Calendar connect/disconnect (disabled)
        <div className="flex justify-center">...</div>
        */}
      </div>
    </div>
  );
}
