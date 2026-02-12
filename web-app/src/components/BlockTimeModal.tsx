/**
 * Block Time Modal
 * 
 * Allows barbers to block off specific times on specific dates.
 * These blocks are one-time only and don't affect recurring weekly availability.
 * For example: "Block Friday Feb 14, 2pm-4pm" won't affect future Fridays.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Plus, X, Trash2, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import Button from './Button';
import DatePicker from './DatePicker';
import toast from 'react-hot-toast';
import barberService, { TimeBlock } from '../services/barber.service';

interface BlockTimeModalProps {
  isVisible: boolean;
  onClose: () => void;
  barberId: string;
  initialDate?: string; // YYYY-MM-DD format
  initialStartTime?: string; // HH:MM format
  initialEndTime?: string; // HH:MM format
}

// Helper to format date for display
const formatDateForDisplay = (dateStr: string): string => {
  // Handle various date formats from API (ISO, YYYY-MM-DD, etc.)
  // Extract just the date part if it includes time
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return 'Invalid Date';
  }
  
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper to format time for display
const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Get today's date in YYYY-MM-DD format
const getTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Generate time options in 15-minute increments
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push({
        value: timeStr,
        label: formatTimeForDisplay(timeStr)
      });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const BlockTimeModal: React.FC<BlockTimeModalProps> = ({
  isVisible,
  onClose,
  barberId,
  initialDate,
  initialStartTime,
  initialEndTime,
}) => {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New block form state - use initial values if provided
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate || getTodayStr());
  const [startTime, setStartTime] = useState(initialStartTime || '09:00');
  const [endTime, setEndTime] = useState(initialEndTime || '10:00');
  
  // Auto-show create form when initial values are provided
  useEffect(() => {
    if (isVisible && initialDate && initialStartTime) {
      setSelectedDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime || initialStartTime.replace(/:\d{2}$/, ':00').replace(/^(\d{2})/, (_, h) => String(parseInt(h) + 1).padStart(2, '0')));
      setShowCreateForm(true);
    }
  }, [isVisible, initialDate, initialStartTime, initialEndTime]);
  
  // Delete confirmation
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

  const fetchTimeBlocks = async () => {
    try {
      setLoading(true);
      const blocks = await barberService.getTimeBlocks(barberId);
      setTimeBlocks(blocks);
    } catch (error) {
      console.error('Failed to fetch time blocks:', error);
      toast.error('Failed to load blocked times');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && barberId) {
      fetchTimeBlocks();
    }
  }, [isVisible, barberId]);

  const handleCreateBlock = async () => {
    // Validate times
    if (startTime >= endTime) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      setSaving(true);
      await barberService.createTimeBlock(barberId, {
        blockDate: selectedDate,
        startTime,
        endTime,
        reason: undefined
      });
      
      toast.success('Time blocked successfully');
      setShowCreateForm(false);
      setSelectedDate(getTodayStr());
      setStartTime('09:00');
      setEndTime('10:00');
      fetchTimeBlocks();
    } catch (error: any) {
      console.error('Failed to create time block:', error);
      toast.error(error.response?.data?.message || 'Failed to block time');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      setSaving(true);
      await barberService.deleteTimeBlock(barberId, blockId);
      toast.success('Time block removed');
      setDeletingBlockId(null);
      fetchTimeBlocks();
    } catch (error) {
      console.error('Failed to delete time block:', error);
      toast.error('Failed to remove time block');
    } finally {
      setSaving(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Block Time</h2>
            <p className="text-primary-100 text-sm">One-time blocks only</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Block specific times without affecting your weekly availability. 
                    Perfect for one-time events or appointments.
                  </p>
                </div>
              </div>

              {/* Existing blocks */}
              {timeBlocks.length > 0 && !showCreateForm && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Blocked Times</h3>
                  <div className="space-y-2">
                    {timeBlocks.map((block) => (
                      <div 
                        key={block.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDateForDisplay(block.blockDate)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatTimeForDisplay(block.startTime)} - {formatTimeForDisplay(block.endTime)}
                            </p>
                          </div>
                        </div>
                        
                        {deletingBlockId === block.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDeletingBlockId(null)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                              disabled={saving}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteBlock(block.id)}
                              className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded"
                              disabled={saving}
                            >
                              {saving ? 'Removing...' : 'Confirm'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingBlockId(block.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove block"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create form */}
              {showCreateForm ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Block New Time
                  </h3>
                  
                  {/* Date picker */}
                  <DatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    minDate={getTodayStr()}
                    label="Select Date"
                    required
                  />

                  {/* Time selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time *
                      </label>
                      <select
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time *
                      </label>
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Time validation warning */}
                  {startTime >= endTime && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      End time must be after start time
                    </div>
                  )}

                  {/* Form actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowCreateForm(false);
                        setSelectedDate(getTodayStr());
                        setStartTime('09:00');
                        setEndTime('10:00');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateBlock}
                      disabled={saving || startTime >= endTime}
                      className="flex-1"
                    >
                      {saving ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Blocking...
                        </div>
                      ) : (
                        'Block Time'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Add block button */
                <Button
                  onClick={() => setShowCreateForm(true)}
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Block Time Slot
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockTimeModal;

