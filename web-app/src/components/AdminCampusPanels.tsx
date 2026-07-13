/**
 * Admin campus management panels (locations, bookings, services, availability).
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Flag,
  RefreshCw,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Star,
  X,
  EyeOff,
  CreditCard,
  Banknote,
  RotateCcw,
  Search,
  Scissors,
  Calendar,
  Copy,
  Check
} from 'lucide-react';
import Card from './Card';
import Button from './Button';
import toast from 'react-hot-toast';
import { SERVICE_TYPES } from '../config/services';


// ═══════════════════════════════════════════════════════════════
// CAMPUS LOCATIONS PANEL
// ═══════════════════════════════════════════════════════════════

interface CampusLocation {
  id: string;
  campus_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected';
  is_universal: boolean;
  restricted_to_barber_id: string | null;
  restricted_barber_name: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  reviewed_by_name: string | null;
  barber_count: string;
}

interface CampusBarberOption {
  id: string;
  name: string;
  profilePicture: string | null;
}

interface BarberLocationAssignment {
  assignment_id: string;
  location_id: string;
  name: string;
  description: string | null;
}

interface BarberWithLocations {
  id: string;
  name: string;
  profilePicture: string | null;
  locations: BarberLocationAssignment[];
}

// ═══════════════════════════════════════════════════════════════
// BARBER AVAILABILITY PANEL
// ═══════════════════════════════════════════════════════════════

interface AvailabilitySlot {
  id?: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  intervals: AvailabilitySlot[];
}

interface WeeklySchedule {
  [day: string]: DaySchedule | AvailabilitySlot[];
}

interface BarberForAvailability {
  id: string;
  name: string;
  profileImageUrl: string | null;
  weeklySchedule?: WeeklySchedule;
  isActive: boolean;
}

export const BarberAvailabilityPanel: React.FC<{ campusId: string }> = ({ campusId }) => {
  const [barbers, setBarbers] = useState<BarberForAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedBarber, setExpandedBarber] = useState<string | null>(null);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Fetch barbers and their availability for this campus
  useEffect(() => {
    const fetchBarbersWithAvailability = async () => {
      try {
        setLoading(true);
        const barberServiceModule = await import('../services/barber.service');
        const barberService = barberServiceModule.default;
        const response = await barberService.getBarbers({ campusId, includeHidden: true } as any);
        const barbersArray = Array.isArray(response) ? response : (response?.data || []);
        
        // Map barbers and fetch their availability
        const mappedBarbers: BarberForAvailability[] = await Promise.all(
          barbersArray.map(async (barber: any) => {
            let weeklySchedule: WeeklySchedule = {};
            try {
              const availResponse = await barberService.getBarberAvailability(barber.id);
              // api.get already unwraps the response, so weeklySchedule is directly on availResponse
              const rawSchedule = availResponse?.weeklySchedule;
              // Ensure weeklySchedule is an object with array values
              if (rawSchedule && typeof rawSchedule === 'object') {
                weeklySchedule = rawSchedule;
              }
            } catch (e) {
              console.error(`Failed to fetch availability for barber ${barber.id}:`, e);
            }
            return {
              id: barber.id,
              name: barber.name || barber.display_name || `${barber.first_name || ''} ${barber.last_name || ''}`.trim() || 'Unknown',
              profileImageUrl: barber.profile_picture_url || barber.profile_image_url || barber.profileImageUrl || barber.avatarUrl || barber.avatar_url || null,
              isActive: barber.is_active !== false,
              weeklySchedule,
            };
          })
        );
        
        setBarbers(mappedBarbers);
      } catch (error) {
        console.error('Failed to fetch barbers:', error);
        toast.error('Failed to load barbers');
      } finally {
        setLoading(false);
      }
    };

    fetchBarbersWithAvailability();
  }, [campusId]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const dates = [];
    
    for (let i = 0; i < firstDay.getDay(); i++) {
      dates.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }
    
    return dates;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const getDaySchedule = (schedule: WeeklySchedule, date: Date): AvailabilitySlot[] => {
    const dayName = dayNames[date.getDay()].toLowerCase();
    const daySchedule = schedule[dayName];
    
    // Handle the new format: { enabled: boolean, intervals: [] }
    if (daySchedule && typeof daySchedule === 'object' && !Array.isArray(daySchedule)) {
      const dayObj = daySchedule as DaySchedule;
      if (dayObj.enabled && Array.isArray(dayObj.intervals)) {
        return dayObj.intervals;
      }
      return [];
    }
    
    // Handle legacy format: direct array of slots
    if (Array.isArray(daySchedule)) {
      return daySchedule;
    }
    
    return [];
  };

  const getDateRangeLabel = () => {
    return `${dayNames[currentDate.getDay()]}, ${currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const renderBarberDayView = (barber: BarberForAvailability) => {
    // Hidden barbers don't show availability
    if (!barber.isActive) {
      return null;
    }
    const schedule = getDaySchedule(barber.weeklySchedule || {}, currentDate);
    if (schedule.length === 0) {
      return <span className="text-gray-400 text-sm">No availability</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {schedule.map((slot, idx) => (
          <span key={idx} className="text-xs bg-primary-100 text-primary-700 rounded px-2 py-0.5">
            {formatTime(slot.start)} - {formatTime(slot.end)}
          </span>
        ))}
      </div>
    );
  };

  const renderBarberWeekView = (barber: BarberForAvailability) => {
    // Get dates starting from the current selected date
    const getUpcomingDates = (count: number) => {
      const dates = [];
      for (let i = 0; i < count; i++) {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() + i);
        dates.push(date);
      }
      return dates;
    };
    
    const mobileDates = getUpcomingDates(2);  // Today + tomorrow
    const desktopDates = getUpcomingDates(3); // Today + next 2 days
    
    const renderDayCard = (date: Date) => {
      const schedule = getDaySchedule(barber.weeklySchedule || {}, date);
      const isCurrentDate = date.toDateString() === currentDate.toDateString();
      const hasSlots = schedule.length > 0;
      return (
        <div 
          key={date.toISOString()} 
          className={`p-2 rounded border text-center ${isCurrentDate ? 'border-gray-400 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
        >
          <p className={`text-xs font-medium ${isCurrentDate ? 'text-primary-700' : 'text-gray-600'}`}>{shortDayNames[date.getDay()]}</p>
          <p className={`text-xs ${isCurrentDate ? 'text-primary-600' : 'text-gray-500'}`}>{date.getDate()}</p>
          {hasSlots ? (
            <div className="mt-1 space-y-0.5">
              {schedule.slice(0, 3).map((slot, slotIdx) => (
                <div key={slotIdx} className="text-xs bg-primary-100 text-primary-700 rounded px-1 py-0.5">
                  {formatTime(slot.start).replace(' ', '')} - {formatTime(slot.end).replace(' ', '')}
                </div>
              ))}
              {schedule.length > 3 && <p className="text-xs text-primary-500">+{schedule.length - 3} more</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">-</p>
          )}
        </div>
      );
    };
    
    return (
      <>
        {/* Mobile view: 2 days (today + tomorrow) */}
        <div className="grid grid-cols-2 gap-2 mt-2 sm:hidden">
          {mobileDates.map(date => renderDayCard(date))}
        </div>
        
        {/* Desktop view: 3 days (today + next 2 days) */}
        <div className="hidden sm:grid grid-cols-3 gap-2 mt-2">
          {desktopDates.map(date => renderDayCard(date))}
        </div>
      </>
    );
  };

  const renderBarberMonthView = (barber: BarberForAvailability) => {
    const monthDates = getMonthDates();
    return (
      <div className="mt-2">
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {shortDayNames.map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 text-center">{day.charAt(0)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthDates.map((date, idx) => {
            if (!date) return <div key={idx} className="h-6" />;
            const schedule = getDaySchedule(barber.weeklySchedule || {}, date);
            const isToday = date.toDateString() === new Date().toDateString();
            const hasAvailability = schedule.length > 0;
            return (
              <div
                key={idx}
                className={`h-6 rounded flex items-center justify-center text-xs ${
                  isToday ? 'bg-gray-900 text-white font-bold' : hasAvailability ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  if (barbers.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Calendar className="w-12 h-12 mb-3" />
          <p className="text-sm">No barbers found for this campus</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-medium text-gray-900">{getDateRangeLabel()}</p>
            {currentDate.toDateString() !== new Date().toDateString() && (
              <button
                onClick={() => setCurrentDate(new Date())}
                className="text-xs text-gray-900 hover:underline"
              >
                Go to today
              </button>
            )}
          </div>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </Card>

      {/* Barbers list with availability */}
      <div className="space-y-2">
        {barbers.map(barber => (
          <Card key={barber.id} className="p-3">
            <button
              onClick={() => barber.isActive && setExpandedBarber(expandedBarber === barber.id ? null : barber.id)}
              className={`w-full flex items-center gap-3 text-left ${!barber.isActive ? 'cursor-default' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {barber.profileImageUrl ? (
                  <img src={barber.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-500">
                    {barber.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium ${barber.isActive ? 'text-gray-900' : 'text-gray-500'}`}>{barber.name}</p>
                  {!barber.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">Hidden</span>
                  )}
                </div>
                {barber.isActive && expandedBarber !== barber.id && renderBarberDayView(barber)}
              </div>
              {barber.isActive && (
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedBarber === barber.id ? 'rotate-180' : ''}`} />
              )}
            </button>
            
            {/* Expanded view - only for active barbers, shows week availability */}
            {barber.isActive && expandedBarber === barber.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {renderBarberWeekView(barber)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ALL-CAMPUS LOCATIONS (admin aggregate view)
// ═══════════════════════════════════════════════════════════════

type CampusRef = { id: string; name: string };

function formatCampusLabel(name: string) {
  if (name.startsWith('University of ')) return name;
  if (name.endsWith(' University')) return name.slice(0, -11);
  return name;
}

export const AllCampusesLocationsPanel: React.FC<{ campuses: CampusRef[] }> = ({ campuses }) => {
  if (!campuses.length) {
    return (
      <Card className="text-center py-8 sm:py-12">
        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-700 font-medium text-sm sm:text-base">No campuses with barbers yet</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Locations appear here once barbers are active on a campus.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {campuses.map((campus) => (
        <section key={campus.id}>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {formatCampusLabel(campus.name)}
          </h3>
          <CampusLocationsPanel campusId={campus.id} />
        </section>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CAMPUS LOCATIONS PANEL
// ═══════════════════════════════════════════════════════════════

export const CampusLocationsPanel: React.FC<{ campusId: string }> = ({ campusId }) => {
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [campusBarbers, setCampusBarbers] = useState<CampusBarberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CampusLocation | null>(null);
  const [approvalLocation, setApprovalLocation] = useState<CampusLocation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CampusLocation | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    isUniversal: true, 
    restrictedToBarberId: '' 
  });
  const [approvalData, setApprovalData] = useState({
    isUniversal: true,
    restrictedToBarberId: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved'>('all');
  
  // Barber assignments state
  const [barbersWithLocations, setBarbersWithLocations] = useState<BarberWithLocations[]>([]);
  const [loadingBarberAssignments, setLoadingBarberAssignments] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<{ barberId: string; barberName: string } | null>(null);
  const [expandedBarbers, setExpandedBarbers] = useState<Set<string>>(new Set());
  const assignPanelRef = useRef<HTMLDivElement>(null);
  
  // Subtab state
  const [activeSubTab, setActiveSubTab] = useState<'barbers' | 'requested' | 'approved'>('barbers');

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/campus/${campusId}?status=${activeFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocations(data.data || []);
      } else {
        console.error('Failed to fetch locations:', response.status);
        toast.error('Failed to load locations');
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const fetchBarbers = async () => {
    try {
      const barberServiceModule = await import('../services/barber.service');
      const barberService = barberServiceModule.default;
      const response = await barberService.getBarbers({ campusId } as any);
      const barbersArray = Array.isArray(response) ? response : (response?.data || []);
      
      const barbersList = barbersArray.map((b: any) => ({
        id: b.id,
        name: b.name || b.display_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Unknown',
        profilePicture: b.profile_picture_url || b.profilePictureUrl || b.profile_picture || b.avatarUrl || b.avatar_url || b.avatar || null,
      }));
      
      setCampusBarbers(barbersList);
      
      // Fetch locations for each barber
      await fetchAllBarberLocations(barbersList);
    } catch (error) {
      console.error('Failed to fetch barbers:', error);
    }
  };

  const fetchAllBarberLocations = async (barbersList: CampusBarberOption[]) => {
    try {
      setLoadingBarberAssignments(true);
      const token = localStorage.getItem('accessToken');
      
      const barbersWithLocs: BarberWithLocations[] = await Promise.all(
        barbersList.map(async (barber) => {
          try {
            const response = await fetch(`/api/locations/barber/${barber.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.ok) {
              const data = await response.json();
              return {
                id: barber.id,
                name: barber.name,
                profilePicture: barber.profilePicture,
                locations: data.data || [],
              };
            }
            return { id: barber.id, name: barber.name, profilePicture: barber.profilePicture, locations: [] };
          } catch {
            return { id: barber.id, name: barber.name, profilePicture: barber.profilePicture, locations: [] };
          }
        })
      );
      
      setBarbersWithLocations(barbersWithLocs);
    } catch (error) {
      console.error('Failed to fetch barber locations:', error);
    } finally {
      setLoadingBarberAssignments(false);
    }
  };

  const handleAssignLocationToBarber = async (barberId: string, locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/admin/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ barberId, locationId }),
      });

      if (response.ok) {
        toast.success('Location assigned to barber');
        await fetchAllBarberLocations(campusBarbers);
        setShowAssignModal(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to assign location');
      }
    } catch (error) {
      console.error('Failed to assign location:', error);
      toast.error('Failed to assign location');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeLocationFromBarber = async (barberId: string, locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/admin/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ barberId, locationId }),
      });

      if (response.ok) {
        toast.success('Location revoked from barber');
        await fetchAllBarberLocations(campusBarbers);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to revoke location');
      }
    } catch (error) {
      console.error('Failed to revoke location:', error);
      toast.error('Failed to revoke location');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToAllBarbers = async (locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/admin/assign-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationId, campusId }),
      });

      if (response.ok) {
        toast.success('Location assigned to all barbers');
        await fetchAllBarberLocations(campusBarbers);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to assign to all barbers');
      }
    } catch (error) {
      console.error('Failed to assign to all:', error);
      toast.error('Failed to assign to all barbers');
    } finally {
      setSaving(false);
    }
  };

  const toggleBarberExpanded = (barberId: string) => {
    setExpandedBarbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barberId)) {
        newSet.delete(barberId);
      } else {
        newSet.add(barberId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchLocations();
    fetchBarbers();
  }, [campusId, activeFilter]);

  // Scroll modal container to top when assign panel opens
  useEffect(() => {
    if (showAssignModal && assignPanelRef.current) {
      // Find the scrollable modal container and scroll it to top instantly
      const modalContainer = assignPanelRef.current.closest('.overflow-y-auto');
      if (modalContainer) {
        modalContainer.scrollTop = 0;
      }
    }
  }, [showAssignModal]);

  const handleAddLocation = async () => {
    if (!formData.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/campus/${campusId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          isUniversal: formData.isUniversal,
          restrictedToBarberId: formData.isUniversal ? null : formData.restrictedToBarberId || null,
        }),
      });

      if (response.ok) {
        toast.success('Location added successfully');
        setShowAddModal(false);
        setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
        fetchLocations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add location');
      }
    } catch (error) {
      console.error('Failed to add location:', error);
      toast.error('Failed to add location');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation || !formData.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          isUniversal: formData.isUniversal,
          restrictedToBarberId: formData.isUniversal ? null : formData.restrictedToBarberId || null,
        }),
      });

      if (response.ok) {
        toast.success('Location updated successfully');
        setEditingLocation(null);
        setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
        fetchLocations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update location');
      }
    } catch (error) {
      console.error('Failed to update location:', error);
      toast.error('Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveLocation = async () => {
    if (!approvalLocation) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/${approvalLocation.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isUniversal: approvalData.isUniversal,
          restrictedToBarberId: approvalData.isUniversal ? null : approvalData.restrictedToBarberId || null,
        }),
      });

      if (response.ok) {
        toast.success('Location approved');
        setApprovalLocation(null);
        setApprovalData({ isUniversal: true, restrictedToBarberId: '' });
        fetchLocations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to approve location');
      }
    } catch (error) {
      console.error('Failed to approve location:', error);
      toast.error('Failed to approve location');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectLocation = async (locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/${locationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Location request rejected');
        fetchLocations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to reject location');
      }
    } catch (error) {
      console.error('Failed to reject location:', error);
      toast.error('Failed to reject location');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deleteConfirm) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Location deleted successfully');
        setDeleteConfirm(null);
        fetchLocations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete location');
      }
    } catch (error) {
      console.error('Failed to delete location:', error);
      toast.error('Failed to delete location');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (location: CampusLocation) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/${location.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !location.is_active }),
      });

      if (response.ok) {
        toast.success(`Location ${location.is_active ? 'deactivated' : 'activated'}`);
        fetchLocations();
      } else {
        toast.error('Failed to update location status');
      }
    } catch (error) {
      console.error('Failed to toggle location:', error);
      toast.error('Failed to update location status');
    }
  };

  const openEditModal = (location: CampusLocation) => {
    setFormData({
      name: location.name,
      description: location.description || '',
      isUniversal: location.is_universal,
      restrictedToBarberId: location.restricted_to_barber_id || '',
    });
    setEditingLocation(location);
  };

  const openApprovalModal = (location: CampusLocation) => {
    setApprovalData({
      isUniversal: true,
      restrictedToBarberId: '',
    });
    setApprovalLocation(location);
  };

  // Separate pending and approved locations
  const pendingLocations = locations.filter(l => l.status === 'pending');
  const approvedLocations = locations.filter(l => l.status === 'approved');
  const rejectedLocations = locations.filter(l => l.status === 'rejected');

  if (loading) {
    return (
      <Card className="text-center py-8 sm:py-12">
        <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
        <p className="text-gray-500 text-sm sm:text-base">Loading locations...</p>
      </Card>
    );
  }

  // Inline Add/Edit Location View
  if (showAddModal || editingLocation) {
    return (
      <div className="space-y-4">
          <button
          onClick={() => {
            setShowAddModal(false);
            setEditingLocation(null);
            setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Locations</span>
        </button>

        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {editingLocation ? 'Edit Location' : 'Add New Location'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Student Union, Dorm Building A"
                className="w-full px-4 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this location"
                rows={2}
                className="w-full px-4 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900 resize-none"
              />
            </div>
            
            {/* Availability Setting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Who can use this location?
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="availability-inline"
                    checked={formData.isUniversal}
                    onChange={() => setFormData({ ...formData, isUniversal: true, restrictedToBarberId: '' })}
                    className="text-gray-900 focus:ring-gray-400"
                  />
                  <div>
                    <span className="font-medium text-gray-900">All Barbers</span>
                    <p className="text-xs text-gray-500">Any barber on this campus can use this location</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="availability-inline"
                    checked={!formData.isUniversal}
                    onChange={() => setFormData({ ...formData, isUniversal: false })}
                    className="text-gray-900 focus:ring-gray-400"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Specific Barber Only</span>
                    <p className="text-xs text-gray-500">Only a selected barber can use this location</p>
                  </div>
                </label>
              </div>
              
              {!formData.isUniversal && (
                <div className="mt-3">
                  <select
                    value={formData.restrictedToBarberId}
                    onChange={(e) => setFormData({ ...formData, restrictedToBarberId: e.target.value })}
                    className="w-full px-4 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                  >
                    <option value="">Select a barber...</option>
                    {campusBarbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>{barber.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLocation(null);
                  setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
                }}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                disabled={saving || !formData.name.trim()}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingLocation ? (
                  'Update Location'
                ) : (
                  'Add Location'
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Inline Assign Location View
  if (showAssignModal) {
    const selectedBarber = barbersWithLocations.find(b => b.id === showAssignModal.barberId);
    
    // Filter locations to only show universal locations OR locations restricted to this specific barber
    const availableLocationsForBarber = approvedLocations.filter(location => 
      location.is_universal || location.restricted_to_barber_id === showAssignModal.barberId
    );
    
    return (
      <div ref={assignPanelRef} className="space-y-4">
        <button 
          onClick={() => setShowAssignModal(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Barbers</span>
        </button>

        <Card className="p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Assign Location to {showAssignModal.barberName}
          </h3>

          {availableLocationsForBarber.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No approved locations available</p>
              <p className="text-sm text-gray-400 mt-1">Create a location first in the Locations tab</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableLocationsForBarber.map((location) => {
                const isAssigned = selectedBarber?.locations.some(l => l.location_id === location.id);
                
                return (
                  <div
                    key={location.id}
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isAssigned 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                    onClick={() => !isAssigned && !saving && handleAssignLocationToBarber(showAssignModal.barberId, location.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{location.name}</span>
                      {isAssigned ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeLocationFromBarber(showAssignModal.barberId, location.id);
                          }}
                          disabled={saving}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                        >
                          Revoke
          </button>
                      ) : (
                        <span className="text-xs text-primary-600">Click to assign</span>
                      )}
                    </div>
                    {location.description && (
                      <p className="text-xs text-gray-500 mt-1 ml-6">{location.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Subtab Navigation */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setActiveSubTab('barbers')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeSubTab === 'barbers'
              ? 'bg-primary-100 text-primary-700 border border-gray-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
          }`}
        >
          Barbers
        </button>
        
        {/* Requested Locations - Only show if there are pending requests */}
        {pendingLocations.length > 0 && (
          <button
            onClick={() => setActiveSubTab('requested')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'requested'
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
            }`}
          >
            Requested
            <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {pendingLocations.length}
            </span>
          </button>
        )}
        
        <button
          onClick={() => setActiveSubTab('approved')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeSubTab === 'approved'
              ? 'bg-primary-100 text-primary-700 border border-gray-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
          }`}
        >
          Locations
        </button>
      </div>

      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Service Locations</h3>
          <p className="text-sm text-gray-500">
            {pendingLocations.length > 0 && (
              <span className="text-amber-600 font-medium">{pendingLocations.length} pending • </span>
            )}
            {approvedLocations.length} active locations
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
            setShowAddModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Location
        </Button>
      </div>

      {/* Barbers Subtab Content */}
      {activeSubTab === 'barbers' && (
        <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Barber Location Assignments</h4>
          <p className="text-xs text-gray-500">{campusBarbers.length} barbers</p>
      </div>

        {loadingBarberAssignments ? (
          <Card className="text-center py-8">
            <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-gray-500 text-sm">Loading barber assignments...</p>
          </Card>
        ) : barbersWithLocations.length === 0 ? (
          <Card className="text-center py-8 bg-gray-50">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No barbers found</p>
        </Card>
      ) : (
        <div className="space-y-3">
            {barbersWithLocations.map((barber) => (
              <Card key={barber.id} className="overflow-hidden">
                {/* Barber Header */}
                <div className="p-4 flex items-center justify-between">
                  {/* Left side - Barber info (clickable to expand) */}
                  <button
                    onClick={() => toggleBarberExpanded(barber.id)}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left flex-1"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {barber.profilePicture ? (
                        <img 
                          src={barber.profilePicture} 
                          alt={barber.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-primary-600 font-semibold text-sm">
                          {barber.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                    <div>
                      <p className="font-semibold text-gray-900">{barber.name}</p>
                      <p className="text-xs text-gray-500">
                        {barber.locations.length === 0 
                          ? 'No locations assigned' 
                          : `${barber.locations.length} location${barber.locations.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </button>
                  
                  {/* Right side - Actions */}
                  <div className="flex items-center gap-2">
                    {/* Assign Location Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAssignModal({ barberId: barber.id, barberName: barber.name });
                      }}
                      className="text-xs px-2 py-1"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Assign
                    </Button>
                    
                    {/* Expand/Collapse chevron */}
                    <button
                      onClick={() => toggleBarberExpanded(barber.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedBarbers.has(barber.id) ? 'rotate-180' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    </div>
                    </div>
                
                {/* Expanded Content - Just assigned locations */}
                {expandedBarbers.has(barber.id) && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    {barber.locations.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No locations assigned yet</p>
                    ) : (
                      <div className="space-y-2">
                        {barber.locations.map((loc) => (
                          <div 
                            key={loc.assignment_id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-white"
                          >
                            <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                            <button
                              onClick={() => handleRevokeLocationFromBarber(barber.id, loc.location_id)}
                              disabled={saving}
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
                    </div>
        )}
                    </div>
      )}

      {/* Requested Locations Subtab Content */}
      {activeSubTab === 'requested' && pendingLocations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="font-semibold text-amber-700">Pending Requests ({pendingLocations.length})</h4>
                    </div>
          <div className="space-y-3">
            {pendingLocations.map((location) => (
              <Card key={location.id} className="p-4 border-amber-200 bg-amber-50">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <h4 className="font-semibold text-gray-900">{location.name}</h4>
                      <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>
                    {location.description && (
                      <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                      <span>Requested by <strong>{location.created_by_name || location.created_by_email}</strong></span>
                      <span className="text-gray-400">•</span>
                      <span>{new Date(location.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                  <div className="flex items-center gap-2">
                  <Button 
                      variant="primary"
                    size="sm"
                      onClick={() => openApprovalModal(location)}
                      disabled={saving}
                  >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                      onClick={() => handleRejectLocation(location.id)}
                      disabled={saving}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          </div>
        </div>
      )}

      {/* Approved Locations Subtab Content */}
      {activeSubTab === 'approved' && (
          <div>
          {approvedLocations.length === 0 ? (
            <Card className="text-center py-8 sm:py-12">
              <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-700 font-medium text-sm sm:text-base">No locations configured</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Add locations where barbers can offer their services
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setFormData({ name: '', description: '', isUniversal: true, restrictedToBarberId: '' });
                  setShowAddModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add First Location
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
            {approvedLocations.map((location) => (
              <Card key={location.id} className={`p-4 ${!location.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{location.name}</h4>
                      {!location.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    {location.description && (
                      <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-500">
                      <span>{parseInt(location.barber_count)} barber{parseInt(location.barber_count) !== 1 ? 's' : ''} using</span>
                      {location.created_by_name && (
                        <span>Added by {location.created_by_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(location)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        location.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {location.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => openEditModal(location)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(location)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
          </div>
        </div>
      </Card>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      {approvalLocation && (
        <div 
          className="fixed inset-0 min-h-[100dvh] bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => !saving && setApprovalLocation(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-green-50 px-6 py-4 border-b border-green-100">
              <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Approve Location Request
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Location Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary-500" />
                  <span className="font-semibold text-gray-900">{approvalLocation.name}</span>
                </div>
                {approvalLocation.description && (
                  <p className="text-sm text-gray-600">{approvalLocation.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Requested by {approvalLocation.created_by_name || approvalLocation.created_by_email}
                </p>
    </div>

              {/* Availability Setting */}
      <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who should be able to use this location?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="approvalAvailability"
                      checked={approvalData.isUniversal}
                      onChange={() => setApprovalData({ ...approvalData, isUniversal: true, restrictedToBarberId: '' })}
                      className="text-green-600 focus:ring-green-400"
                    />
                    <div>
                      <span className="font-medium text-gray-900">All Barbers (Universal)</span>
                      <p className="text-xs text-gray-500">Any barber on this campus can use this location</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="approvalAvailability"
                      checked={!approvalData.isUniversal}
                      onChange={() => setApprovalData({ ...approvalData, isUniversal: false })}
                      className="text-green-600 focus:ring-green-400"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Only the Requesting Barber</span>
                      <p className="text-xs text-gray-500">Only {approvalLocation.created_by_name || 'the barber who requested'} can use this</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="approvalAvailability"
                      checked={!approvalData.isUniversal && approvalData.restrictedToBarberId !== ''}
                      onChange={() => setApprovalData({ ...approvalData, isUniversal: false })}
                      className="text-green-600 focus:ring-green-400"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Specific Barber</span>
                      <p className="text-xs text-gray-500">Assign to a different barber</p>
                    </div>
                  </label>
      </div>

                {!approvalData.isUniversal && (
                  <div className="mt-3">
                    <select
                      value={approvalData.restrictedToBarberId}
                      onChange={(e) => setApprovalData({ ...approvalData, restrictedToBarberId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-gray-900"
                    >
                      <option value="">Assign to the requesting barber</option>
                      {campusBarbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>{barber.name}</option>
                      ))}
                    </select>
                  </div>
                )}
          </div>

              <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                    setApprovalLocation(null);
                    setApprovalData({ isUniversal: true, restrictedToBarberId: '' });
                  }}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApproveLocation}
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 border-green-600"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Location
                    </>
                  )}
            </Button>
          </div>
        </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div 
          className="fixed inset-0 min-h-[100dvh] bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => !saving && setDeleteConfirm(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 px-6 py-4 border-b border-red-100">
              <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Delete Location
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              </p>
              {parseInt(deleteConfirm.barber_count) > 0 && (
                <p className="text-sm text-amber-600 mb-4 p-3 bg-amber-50 rounded-lg">
                  ⚠️ This location is assigned to {deleteConfirm.barber_count} barber(s). 
                  They will need to select new locations.
                </p>
              )}
        <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteLocation}
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Location'
                  )}
                </Button>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMPLETED BOOKINGS PANEL
// ═══════════════════════════════════════════════════════════════

interface CompletedBooking {
  id: string;
  campusId?: string;
  campusName?: string;
  barberId: string;
  barberRecordId: string;
  barberName: string;
  barberAvatar: string | null;
  consumerName: string;
  consumerAvatar: string | null;
  serviceType: string;
  priceUsdCents: number;
  tipAmountCents: number | null;
  totalPaidCents: number | null;
  scheduledTime: string;
  paidAt: string | null;
  completedAt: string | null;
  paymentMethod: 'card' | 'cash' | null;
  location: string | null;
  notes: string | null;
  status: string;
  review: {
    rating: number;
    comment: string | null;
    reviewedAt: string;
  } | null;
}

interface BarberOption {
  id: string;
  name: string;
}

export const CompletedBookingsPanel: React.FC<{ campusId?: string; campuses?: CampusRef[] }> = ({
  campusId,
  campuses,
}) => {
  const isMultiCampus = !campusId && (campuses?.length ?? 0) > 0;
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [bookings, setBookings] = useState<CompletedBooking[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  
  // Separate filter states for each tab
  const [upcomingBarberId, setUpcomingBarberId] = useState<string>('all');
  const [upcomingSortOrder, setUpcomingSortOrder] = useState<'latest' | 'furthest'>('latest');
  
  const [completedBarberId, setCompletedBarberId] = useState<string>('all');
  const [completedSortOrder, setCompletedSortOrder] = useState<'latest' | 'furthest'>('latest');
  const [completedPaymentMethod, setCompletedPaymentMethod] = useState<string>('all');
  
  const [cancelledBarberId, setCancelledBarberId] = useState<string>('all');
  const [cancelledSortOrder, setCancelledSortOrder] = useState<'latest' | 'furthest'>('latest');
  
  // Get current tab's filter values
  const selectedBarberId = activeTab === 'upcoming' ? upcomingBarberId : activeTab === 'completed' ? completedBarberId : cancelledBarberId;
  const setSelectedBarberId = activeTab === 'upcoming' ? setUpcomingBarberId : activeTab === 'completed' ? setCompletedBarberId : setCancelledBarberId;
  const sortOrder = activeTab === 'upcoming' ? upcomingSortOrder : activeTab === 'completed' ? completedSortOrder : cancelledSortOrder;
  const setSortOrder = activeTab === 'upcoming' ? setUpcomingSortOrder : activeTab === 'completed' ? setCompletedSortOrder : setCancelledSortOrder;
  const selectedPaymentMethod = activeTab === 'completed' ? completedPaymentMethod : 'all';
  const setSelectedPaymentMethod = setCompletedPaymentMethod;
  
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CompletedBooking | null>(null);
  const [isContentVisible, setIsContentVisible] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Pagination state for completed bookings (10 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const topPaginationRef = useRef<HTMLDivElement>(null);
  const bottomPaginationRef = useRef<HTMLDivElement>(null);
  
  // Handle page change - scroll to the pagination that was clicked
  const handlePageChange = (newPage: number, position: 'top' | 'bottom') => {
    setCurrentPage(newPage);
    // After render, scroll to the clicked pagination
    requestAnimationFrame(() => {
      const ref = position === 'top' ? topPaginationRef : bottomPaginationRef;
      ref.current?.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const barberFilter = selectedBarberId !== 'all' ? `&barberId=${selectedBarberId}` : '';
      const paymentFilter = selectedPaymentMethod !== 'all' ? `&paymentMethod=${selectedPaymentMethod}` : '';

      const fetchForCampus = async (campus: CampusRef) => {
        const response = await fetch(
          `/api/v1/bookings-simple/campus/${campus.id}?limit=100${barberFilter}${paymentFilter}&statusFilter=${activeTab}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          return { campus, bookings: [] as CompletedBooking[], barbers: [] as BarberOption[] };
        }
        const data = await response.json();
        return {
          campus,
          bookings: (data.data.bookings || []).map((booking: CompletedBooking) => ({
            ...booking,
            campusId: campus.id,
            campusName: campus.name,
          })),
          barbers: (data.data.barbers || []) as BarberOption[],
        };
      };

      if (campusId) {
        const result = await fetchForCampus({ id: campusId, name: '' });
        setBookings(result.bookings);
        setBarbers(result.barbers);
      } else if (campuses?.length) {
        const results = await Promise.all(campuses.map(fetchForCampus));
        const withBookings = results.filter((r) => r.bookings.length > 0);
        setBookings(withBookings.flatMap((r) => r.bookings));

        const barberMap = new Map<string, BarberOption>();
        results.forEach((r) => {
          r.barbers.forEach((barber) => {
            if (!barberMap.has(barber.id)) {
              const label = isMultiCampus
                ? `${barber.name} (${formatCampusLabel(r.campus.name)})`
                : barber.name;
              barberMap.set(barber.id, { ...barber, name: label });
            }
          });
        });
        setBarbers(Array.from(barberMap.values()));
      } else {
        setBookings([]);
        setBarbers([]);
      }
    } catch (error) {
      console.error('Failed to fetch campus bookings:', error);
      setBookings([]);
      setBarbers([]);
    } finally {
      setLoading(false);
      setTimeout(() => setIsContentVisible(true), 50);
    }
  };

  // Handle tab change with animation
  const handleTabChange = (tab: 'upcoming' | 'completed' | 'cancelled') => {
    if (tab === activeTab) return;
    setIsContentVisible(false);
    setTimeout(() => {
      setActiveTab(tab);
    }, 150);
  };

  useEffect(() => {
    setIsContentVisible(false);
    setCurrentPage(1); // Reset to first page when filters change
    fetchBookings();
    // Re-fetch when tab changes or when the current tab's filters change
  }, [campusId, campuses, activeTab, upcomingBarberId, completedBarberId, completedPaymentMethod, cancelledBarberId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Sort bookings based on sortOrder
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(a.scheduledTime).getTime();
    const dateB = new Date(b.scheduledTime).getTime();
    
    if (activeTab === 'upcoming') {
      // For upcoming: sort by proximity to now (closest first) or furthest first
      const now = Date.now();
      const distanceA = Math.abs(dateA - now);
      const distanceB = Math.abs(dateB - now);
      return sortOrder === 'latest' ? distanceA - distanceB : distanceB - distanceA;
    } else {
      // For completed/cancelled: sort by date (latest = most recent date first, furthest = oldest first)
      return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    }
  });

  // Pagination for completed and cancelled tabs
  const totalPages = (activeTab === 'completed' || activeTab === 'cancelled') ? Math.ceil(sortedBookings.length / ITEMS_PER_PAGE) : 1;
  const paginatedBookings = (activeTab === 'completed' || activeTab === 'cancelled')
    ? sortedBookings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : sortedBookings;

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  // Reusable pagination controls component
  const renderPaginationControls = (position: 'top' | 'bottom') => {
    if ((activeTab !== 'completed' && activeTab !== 'cancelled') || totalPages <= 1) return null;
    
    return (
      <div 
        ref={position === 'top' ? topPaginationRef : bottomPaginationRef}
        className={`flex items-center justify-center gap-2 ${
          position === 'top' ? 'mb-4 pb-4 border-b border-gray-200' : 'mt-6 pt-4 border-t border-gray-200'
        }`}
      >
        <button
          onClick={() => handlePageChange(Math.max(currentPage - 1, 1), position)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
            const showPage = page === 1 || 
              page === totalPages || 
              Math.abs(page - currentPage) <= 1;
            
            if (!showPage) {
              if (page === 2 && currentPage > 3) {
                return <span key={page} className="px-1 text-gray-400">...</span>;
              }
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                return <span key={page} className="px-1 text-gray-400">...</span>;
              }
              return null;
            }
            
            return (
              <button
                key={page}
                onClick={() => handlePageChange(page, position)}
                className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages), position)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 rotate-180" />
        </button>
      </div>
    );
  };

  // Group bookings by barber for summary
  const bookingsByBarber = bookings.reduce((acc, booking) => {
    if (!acc[booking.barberName]) {
      acc[booking.barberName] = { count: 0, totalRevenue: 0, avgRating: 0, ratings: [] as number[] };
    }
    acc[booking.barberName].count++;
    acc[booking.barberName].totalRevenue += booking.priceUsdCents;
    if (booking.review?.rating) {
      acc[booking.barberName].ratings.push(booking.review.rating);
    }
    return acc;
  }, {} as Record<string, { count: number; totalRevenue: number; avgRating: number; ratings: number[] }>);

  // Calculate averages
  Object.keys(bookingsByBarber).forEach(name => {
    const data = bookingsByBarber[name];
    data.avgRating = data.ratings.length > 0 
      ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length 
      : 0;
  });

  if (loading) {
  return (
      <Card className="text-center py-8">
        <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3 animate-spin" />
        <p className="text-gray-600">Loading bookings...</p>
      </Card>
    );
  }

  // If a booking is selected, show inline details instead of the list
  if (selectedBooking) {
    return (
      <div className="space-y-4">
        {/* Back Button */}
        <button
          onClick={() => setSelectedBooking(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Bookings</span>
        </button>

        {/* Barber Info */}
        <Card className="p-4">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {selectedBooking.barberAvatar ? (
                <img src={selectedBooking.barberAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900">{selectedBooking.barberName}</h3>
              <p className="text-sm text-gray-500">Barber</p>
            </div>
          </div>
        </Card>

        {/* Booking Details Grid */}
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Service</p>
              <p className="font-semibold text-gray-900">{selectedBooking.serviceType}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Customer</p>
              <p className="font-semibold text-gray-900">{selectedBooking.consumerName}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Scheduled</p>
              <p className="font-semibold text-gray-900 text-sm">{formatDate(selectedBooking.scheduledTime)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className={`font-semibold text-sm ${selectedBooking.status === 'PAID' || selectedBooking.paidAt ? 'text-green-600' : 'text-amber-600'}`}>
                {selectedBooking.status === 'PAID' || selectedBooking.paidAt ? 'Paid' : 'Awaiting Payment'}
        </p>
      </div>
          </div>
          {selectedBooking.location && (
            <div className="p-3 bg-gray-50 rounded-lg mt-4">
              <p className="text-xs text-gray-500 mb-1">Location</p>
              <p className="font-semibold text-gray-900">{selectedBooking.location}</p>
            </div>
          )}
          {selectedBooking.notes && (
            <div className="p-3 bg-gray-50 rounded-lg mt-4">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-gray-700 italic">"{selectedBooking.notes}"</p>
            </div>
          )}
        </Card>

        {/* Payment Details */}
        <Card className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-primary-600" />
            Payment Details
          </h4>
          {(() => {
            const serviceCents = selectedBooking.priceUsdCents || 0;
            const tipAmount =
              selectedBooking.tipAmountCents ??
              (selectedBooking.totalPaidCents != null &&
              selectedBooking.totalPaidCents > serviceCents
                ? selectedBooking.totalPaidCents - serviceCents
                : 0);
            const displayTotalCents =
              selectedBooking.totalPaidCents != null && selectedBooking.totalPaidCents > 0
                ? selectedBooking.totalPaidCents
                : serviceCents + tipAmount;

            return (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Service Price</span>
                  <span className="font-medium text-gray-900">{formatPrice(serviceCents)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tip</span>
                    <span className="font-medium text-green-600">{formatPrice(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatPrice(displayTotalCents)}
                  </span>
                </div>
              </div>
            );
          })()}
          {selectedBooking.paidAt && (
            <p className="text-xs text-gray-500 mt-2">Paid on {formatDate(selectedBooking.paidAt)}</p>
          )}
        </Card>

        {/* Customer Review */}
        {selectedBooking.review && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-yellow-500" />
              Customer Review
            </h4>
            <div className="flex items-center gap-2 mb-2">
              {renderStars(selectedBooking.review.rating)}
              <span className="text-sm text-gray-600">({selectedBooking.review.rating}/5)</span>
            </div>
            {selectedBooking.review.comment && (
              <p className="text-gray-700 italic">"{selectedBooking.review.comment}"</p>
            )}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTabChange('upcoming')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-gray-900 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => handleTabChange('completed')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-gray-900 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => handleTabChange('cancelled')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'cancelled'
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Content with transition */}
      <div 
        className={`transition-all duration-150 ease-out ${
          isContentVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Filter Button with Dropdown */}
        <div className="relative mb-4">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <span>Filter</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
            {/* Show indicator if filters are active */}
            {(selectedBarberId !== 'all' || sortOrder !== 'latest' || (activeTab === 'completed' && selectedPaymentMethod !== 'all')) && (
              <span className="w-2 h-2 bg-primary-500 rounded-full" />
            )}
          </button>

          {/* Filter Dropdown */}
          {showFilterDropdown && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowFilterDropdown(false)} 
              />
              
              {/* Dropdown Content */}
              <div className="absolute left-0 top-full mt-2 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-4 min-w-[280px]">
                <div className="space-y-4">
                  {/* Barber Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Barber</label>
                    <select
                      value={selectedBarberId}
                      onChange={(e) => setSelectedBarberId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                    >
                      <option value="all">All Barbers</option>
                      {barbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>{barber.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sort by Date</label>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'latest' | 'furthest')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                    >
                      <option value="latest">Latest First</option>
                      <option value="furthest">Furthest First</option>
                    </select>
                  </div>

                  {/* Payment Method - Only for Completed tab */}
                  {activeTab === 'completed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-900"
                      >
                        <option value="all">All</option>
                        <option value="card">Card</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>
                  )}

                  {/* Clear Filters Button */}
                  {(selectedBarberId !== 'all' || sortOrder !== 'latest' || (activeTab === 'completed' && selectedPaymentMethod !== 'all')) && (
                    <button
                      onClick={() => {
                        setSelectedBarberId('all');
                        setSortOrder('latest');
                        if (activeTab === 'completed') {
                          setSelectedPaymentMethod('all');
                        }
                      }}
                      className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
        <Card className="text-center py-8 sm:py-12">
          <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-700 font-medium text-sm sm:text-base">
            {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No completed bookings yet'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {selectedBarberId !== 'all' 
              ? `This barber has no ${activeTab} bookings` 
              : `${activeTab === 'upcoming' ? 'Upcoming' : activeTab === 'completed' ? 'Completed' : 'Cancelled'} bookings will appear here`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100dvh-200px)] sm:max-h-none overflow-y-auto overflow-x-hidden sm:overflow-visible">
          {/* Show total count above pagination */}
          {(activeTab === 'completed' || activeTab === 'cancelled') && totalPages > 1 && (
            <p className="text-sm text-gray-500 text-center sticky top-0 bg-gray-50 py-1 z-10">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedBookings.length)} of {sortedBookings.length} {activeTab} bookings
            </p>
          )}
          
          {/* Top pagination controls */}
          {renderPaginationControls('top')}
          
          {/* Booking cards wrapper - min-height prevents layout shift when switching pages */}
          <div className="space-y-3">
            {paginatedBookings.map((booking) => (
              <Card 
                key={booking.id} 
                className={`p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                  activeTab === 'upcoming' 
                    ? booking.status === 'PENDING' 
                      ? 'border-l-amber-400' 
                      : 'border-l-blue-400'
                    : activeTab === 'cancelled'
                      ? 'border-l-red-400'
                      : 'border-l-green-400'
              }`}
              onClick={() => setSelectedBooking(booking)}
            >
              {/* Payment Method Badge or Awaiting Payment - Top Left (Completed bookings only) */}
              {activeTab === 'completed' && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {booking.status === 'COMPLETED' && !booking.paidAt && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Awaiting Payment
                    </div>
                  )}
                  {booking.paymentMethod && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-900 text-white">
                      {booking.paymentMethod === 'card' ? 'Card' : 'Cash'}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                {/* Left side - booking info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {booking.barberAvatar ? (
                        <img src={booking.barberAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-gray-400" />
                      )}
                  </div>
                    <div>
                      <p className="font-semibold text-gray-900">{booking.barberName}</p>
                      {isMultiCampus && booking.campusName && (
                        <p className="text-xs text-primary-600 font-medium">
                          {formatCampusLabel(booking.campusName)}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">{booking.serviceType}</p>
                  </div>
              </div>

                  <div className="text-sm text-gray-600 space-y-1 ml-13">
                    <p><span className="text-gray-500">Customer:</span> {booking.consumerName}</p>
                    <p><span className="text-gray-500">Date:</span> {formatDate(booking.scheduledTime)}</p>
                    {activeTab === 'completed' && booking.completedAt && (
                      <p><span className="text-gray-500">Completed:</span> {formatDate(booking.completedAt)}</p>
                    )}
                    {booking.location && (
                      <p><span className="text-gray-500">Location:</span> {booking.location}</p>
                    )}
                    {booking.notes && (
                      <p className="italic text-gray-500">"{booking.notes}"</p>
                    )}
              </div>

                  {/* Tap hint on mobile */}
                  <p className={`text-xs mt-2 sm:hidden ${
                    activeTab === 'upcoming' 
                      ? booking.status === 'PENDING' ? 'text-amber-500' : 'text-blue-500'
                      : activeTab === 'cancelled'
                        ? 'text-red-500'
                        : 'text-green-500'
                  }`}>Tap for details →</p>
              </div>

                {/* Right side - price and status/review */}
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    {/* Price breakdown for completed bookings with tips */}
                    {activeTab === 'completed' && booking.totalPaidCents && booking.totalPaidCents > booking.priceUsdCents ? (
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-500">{formatPrice(booking.priceUsdCents)} + <span className="text-green-600">{formatPrice(booking.totalPaidCents - booking.priceUsdCents)} tip</span></p>
                        <p className="font-bold text-lg text-green-600">{formatPrice(booking.totalPaidCents)}</p>
                      </div>
                    ) : (
                      <p className={`font-bold text-lg ${
                        activeTab === 'upcoming' 
                          ? booking.status === 'PENDING' ? 'text-amber-600' : 'text-blue-600'
                          : activeTab === 'cancelled'
                            ? 'text-red-600'
                            : 'text-green-600'
                      }`}>{formatPrice(activeTab === 'completed' && booking.totalPaidCents ? booking.totalPaidCents : booking.priceUsdCents)}</p>
                    )}
                    
                    {activeTab === 'upcoming' ? (
                      // Show status badge for upcoming bookings
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                        booking.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {booking.status === 'PENDING' ? 'Pending' : 'Accepted'}
                      </span>
                    ) : (
                      <>
                        {/* Review */}
                        {booking.review ? (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                            {renderStars(booking.review.rating)}
                            {booking.review.comment && (
                              <p className="text-xs text-gray-600 mt-1 truncate">
                                "{booking.review.comment}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-2 italic">No review</p>
                        )}
                      </>
                    )}
                  </div>
                  {/* Arrow indicator */}
                  <div className={`hidden sm:flex items-center mt-1 ${
                    activeTab === 'upcoming'
                      ? booking.status === 'PENDING' ? 'text-amber-400' : 'text-blue-400'
                      : activeTab === 'cancelled'
                        ? 'text-red-400'
                        : 'text-green-400'
                  }`}>
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </div>
                </div>
              </div>
              </Card>
            ))}
          </div>
          
          {/* Bottom pagination controls */}
          {renderPaginationControls('bottom')}
        </div>
        )}
      </div>

    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SERVICES MANAGEMENT PANEL
// ═══════════════════════════════════════════════════════════════

interface Service {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  providerType?: 'barber' | 'beauty';
  isActive: boolean;
}

type ServiceProviderTypeFilter = 'all' | 'barber' | 'beauty';

const KNOWN_BEAUTY_KEYS = new Set(
  SERVICE_TYPES.filter((s) => s.providerType === 'beauty').flatMap((s) => [
    s.id.replace(/[^a-z0-9]+/gi, '').toLowerCase(),
    s.name.replace(/[^a-z0-9]+/gi, '').toLowerCase(),
  ])
);

function resolveServiceProviderType(service: Pick<Service, 'slug' | 'name' | 'providerType'>): 'barber' | 'beauty' {
  if (service.providerType === 'beauty') return 'beauty';
  const slugKey = String(service.slug || '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
  const nameKey = String(service.name || '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
  if (KNOWN_BEAUTY_KEYS.has(slugKey) || KNOWN_BEAUTY_KEYS.has(nameKey)) return 'beauty';
  return service.providerType === 'barber' ? 'barber' : 'barber';
}

interface ServiceBoundsForm {
  basePrice: string;
  minPrice: string;
  maxPrice: string;
  minDuration: string;
  maxDuration: string;
  providerType: 'barber' | 'beauty';
}

const emptyBoundsForm = (): ServiceBoundsForm => ({
  basePrice: '',
  minPrice: '',
  maxPrice: '',
  minDuration: '',
  maxDuration: '',
  providerType: 'barber',
});

const boundsFormFromService = (service: Service): ServiceBoundsForm => ({
  basePrice: Math.round(service.basePriceCents / 100).toString(),
  minPrice: Math.round(service.minPriceCents / 100).toString(),
  maxPrice: Math.round(service.maxPriceCents / 100).toString(),
  minDuration: String(service.minDurationMinutes),
  maxDuration: String(service.maxDurationMinutes),
  providerType: resolveServiceProviderType(service),
});

export const ServicesManagementPanel: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [providerTypeFilter, setProviderTypeFilter] = useState<ServiceProviderTypeFilter>('all');

  // Inline bounds editing state
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingBounds, setEditingBounds] = useState<ServiceBoundsForm>(emptyBoundsForm());
  const [savingBounds, setSavingBounds] = useState(false);

  // Add modal form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBasePrice, setFormBasePrice] = useState('');
  const [formProviderType, setFormProviderType] = useState<'barber' | 'beauty'>('barber');
  const [formError, setFormError] = useState('');

  const fetchServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        includeInactive: String(showInactive),
      });
      if (providerTypeFilter !== 'all') {
        params.set('providerType', providerTypeFilter);
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/admin/services?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        setServices(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [showInactive, providerTypeFilter]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Service name is required');
      return;
    }

    const basePrice = parseFloat(formBasePrice);
    if (isNaN(basePrice) || basePrice <= 0) {
      setFormError('Please enter a valid price');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          basePriceCents: Math.round(basePrice * 100),
          providerType: formProviderType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Service added successfully');
        setShowAddModal(false);
        resetForm();
        fetchServices();
      } else {
        setFormError(data.message || 'Failed to add service');
      }
    } catch (error) {
      console.error('Failed to add service:', error);
      setFormError('Failed to add service');
    }
  };

  // Start inline bounds editing
  const startEditingBounds = (service: Service) => {
    setEditingServiceId(service.id);
    setEditingBounds(boundsFormFromService(service));
  };

  const validateBoundsForm = (form: ServiceBoundsForm): string | null => {
    const basePrice = parseInt(form.basePrice, 10);
    const minPrice = parseInt(form.minPrice, 10);
    const maxPrice = parseInt(form.maxPrice, 10);
    const minDuration = parseInt(form.minDuration, 10);
    const maxDuration = parseInt(form.maxDuration, 10);

    if ([basePrice, minPrice, maxPrice, minDuration, maxDuration].some((n) => Number.isNaN(n) || n <= 0)) {
      return 'Enter valid positive numbers for all fields';
    }
    if (minPrice > basePrice || basePrice > maxPrice) {
      return 'Price bounds must satisfy min ≤ base ≤ max';
    }
    if (minDuration > maxDuration) {
      return 'Duration bounds must satisfy min ≤ max';
    }
    return null;
  };

  // Save inline bounds edit
  const saveInlineBounds = async (serviceId: number) => {
    const validationError = validateBoundsForm(editingBounds);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSavingBounds(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          basePriceCents: parseInt(editingBounds.basePrice, 10) * 100,
          minPriceCents: parseInt(editingBounds.minPrice, 10) * 100,
          maxPriceCents: parseInt(editingBounds.maxPrice, 10) * 100,
          minDurationMinutes: parseInt(editingBounds.minDuration, 10),
          maxDurationMinutes: parseInt(editingBounds.maxDuration, 10),
          providerType: editingBounds.providerType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Service limits updated');
        setEditingServiceId(null);
        fetchServices();
      } else {
        toast.error(data.message || 'Failed to update service limits');
      }
    } catch (error) {
      console.error('Failed to update service limits:', error);
      toast.error('Failed to update service limits');
    } finally {
      setSavingBounds(false);
    }
  };

  // Cancel inline bounds editing
  const cancelEditingBounds = () => {
    setEditingServiceId(null);
    setEditingBounds(emptyBoundsForm());
  };

  const handleDeleteService = async (service: Service) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"?`)) return;

    try {
      setActionLoading(service.id);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/services/${service.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Service deleted');
        fetchServices();
      } else {
        toast.error(data.message || 'Failed to delete service');
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error('Failed to delete service');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateService = async (service: Service) => {
    try {
      setActionLoading(service.id);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: true }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Service restored');
        fetchServices();
      } else {
        toast.error(data.message || 'Failed to restore service');
      }
    } catch (error) {
      console.error('Failed to restore service:', error);
      toast.error('Failed to restore service');
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormBasePrice('');
    setFormProviderType('barber');
    setFormError('');
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary-500" />
        <p className="text-sm text-gray-500 mt-2">Loading services...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        {/* Row 1: Title + Show Deleted (mobile), Title + controls (desktop) */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Service Types</h3>
          {/* Show Deleted - visible on mobile, hidden on desktop (moves to right side) */}
          <label className="flex sm:hidden items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            Show Deleted
          </label>
          {/* Desktop controls */}
          <div className="hidden sm:flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              Show Deleted
            </label>
            <Button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </Button>
          </div>
        </div>
        {/* Description */}
        <p className="text-sm text-gray-500 mt-1">
          Set default price and duration limits providers must stay within
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'barber', label: 'Barber' },
              { id: 'beauty', label: 'Beauty' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setProviderTypeFilter(option.id)}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
                providerTypeFilter === option.id
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {/* Mobile Add Service button */}
        <Button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="sm:hidden w-full mt-3 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </Button>
      </div>

      {/* Services Grid - Compact boxes like BarberServiceSpecialties */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {/* Inline Add Service Form */}
        {showAddModal && (
          <form
            onSubmit={handleAddService}
            className="p-3 rounded-lg border-2 border-dashed border-gray-400 bg-primary-50"
          >
            <div className="mb-2">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-2 py-1 text-sm font-semibold text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-gray-400 focus:border-gray-900 bg-white"
                placeholder="Service name"
                autoFocus
              />
            </div>
            <div className="mb-2 flex gap-1">
              {(['barber', 'beauty'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormProviderType(type)}
                  className={`flex-1 text-[10px] px-2 py-1 rounded border capitalize ${
                    formProviderType === type
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 mb-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formBasePrice}
                onChange={(e) => setFormBasePrice(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-14 text-lg font-bold text-gray-900 border-b-2 border-gray-300 focus:border-gray-900 focus:outline-none bg-transparent"
                placeholder="0"
              />
            </div>
            {formError && (
              <p className="text-xs text-red-600 mb-2">{formError}</p>
            )}
            <div className="flex gap-1">
              <button
                type="submit"
                className="flex-1 text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="flex-1 text-xs px-2 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        
        {services.map((service) => {
          const isEditing = editingServiceId === service.id;
          const providerType = resolveServiceProviderType(service);
          
          return (
            <div
              key={service.id}
              className={`p-3 rounded-lg border-2 transition-all ${
                service.isActive
                  ? 'border-gray-400 bg-primary-50'
                  : 'border-red-200 bg-red-50 opacity-60'
              }`}
            >
              {/* Header with name and actions */}
              <div className="flex items-start justify-between gap-1 mb-1">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                    {service.name}
                  </h4>
                  <span
                    className={`mt-1 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      providerType === 'beauty'
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {providerType === 'beauty' ? 'Beauty' : 'Barber'}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {!isEditing && (
                    <button
                      onClick={() => startEditingBounds(service)}
                      className="p-1 text-gray-400 hover:text-gray-900 rounded transition-colors"
                      title="Edit limits"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {service.isActive && (
                    <button
                      onClick={() => handleDeleteService(service)}
                      disabled={actionLoading === service.id}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                      title="Delete service"
                    >
                      {actionLoading === service.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Restore button for deleted services */}
              {!service.isActive && (
                <button
                  onClick={() => handleReactivateService(service)}
                  disabled={actionLoading === service.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors disabled:opacity-50 mb-1"
                >
                  {actionLoading === service.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Restore Service
                </button>
              )}

              {/* Limits - editable or display */}
              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <label className="text-gray-500">
                      Min $
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingBounds.minPrice}
                        onChange={(e) => setEditingBounds((prev) => ({ ...prev, minPrice: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="mt-0.5 w-full px-1 py-0.5 text-xs font-semibold border border-gray-300 rounded bg-white"
                      />
                    </label>
                    <label className="text-gray-500">
                      Base $
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingBounds.basePrice}
                        onChange={(e) => setEditingBounds((prev) => ({ ...prev, basePrice: e.target.value.replace(/[^0-9]/g, '') }))}
                        autoFocus
                        className="mt-0.5 w-full px-1 py-0.5 text-xs font-semibold border border-gray-300 rounded bg-white"
                      />
                    </label>
                    <label className="text-gray-500">
                      Max $
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingBounds.maxPrice}
                        onChange={(e) => setEditingBounds((prev) => ({ ...prev, maxPrice: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="mt-0.5 w-full px-1 py-0.5 text-xs font-semibold border border-gray-300 rounded bg-white"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <label className="text-gray-500">
                      Min min
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingBounds.minDuration}
                        onChange={(e) => setEditingBounds((prev) => ({ ...prev, minDuration: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="mt-0.5 w-full px-1 py-0.5 text-xs font-semibold border border-gray-300 rounded bg-white"
                      />
                    </label>
                    <label className="text-gray-500">
                      Max min
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editingBounds.maxDuration}
                        onChange={(e) => setEditingBounds((prev) => ({ ...prev, maxDuration: e.target.value.replace(/[^0-9]/g, '') }))}
                        className="mt-0.5 w-full px-1 py-0.5 text-xs font-semibold border border-gray-300 rounded bg-white"
                      />
                    </label>
                  </div>
                  <div className="flex gap-1">
                    {(['barber', 'beauty'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditingBounds((prev) => ({ ...prev, providerType: type }))}
                        className={`flex-1 text-[10px] px-2 py-1 rounded border capitalize ${
                          editingBounds.providerType === type
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-300 bg-white text-gray-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveInlineBounds(service.id)}
                      disabled={savingBounds}
                      className="flex-1 text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50"
                    >
                      {savingBounds ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditingBounds}
                      disabled={savingBounds}
                      className="flex-1 text-xs px-2 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-0.5">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-lg font-bold text-gray-900">
                      {Math.round(service.basePriceCents / 100)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    ${Math.round(service.minPriceCents / 100)}–${Math.round(service.maxPriceCents / 100)} price
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {service.minDurationMinutes}–{service.maxDurationMinutes} min
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {services.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {providerTypeFilter === 'all'
              ? 'No services found'
              : `No ${providerTypeFilter} services found`}
          </p>
          <Button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            variant="outline"
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add your first service
          </Button>
        </div>
      )}


      </div>
  );
};

