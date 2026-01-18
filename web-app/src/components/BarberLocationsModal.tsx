/**
 * Barber Locations Modal
 * 
 * Allows barbers to manage their assigned locations
 * - View available campus locations
 * - Assign/unassign locations
 * - Set primary location
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check, X, RefreshCw, Star, Trash2 } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import toast from 'react-hot-toast';

interface AssignedLocation {
  assignment_id: string;
  is_primary: boolean;
  location_id: string;
  name: string;
  description: string | null;
  address: string | null;
}

interface AvailableLocation {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
}

interface LocationsData {
  assigned: AssignedLocation[];
  available: AvailableLocation[];
}

interface BarberLocationsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const BarberLocationsModal: React.FC<BarberLocationsModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [data, setData] = useState<LocationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/my-locations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
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

  useEffect(() => {
    if (isVisible) {
      fetchLocations();
    }
  }, [isVisible]);

  const handleAssignLocation = async (locationId: string, isPrimary: boolean = false) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/barber/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationId, isPrimary }),
      });

      if (response.ok) {
        toast.success('Location added');
        fetchLocations();
      } else {
        const result = await response.json();
        toast.error(result.error || 'Failed to add location');
      }
    } catch (error) {
      console.error('Failed to assign location:', error);
      toast.error('Failed to add location');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignLocation = async (locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/locations/barber/unassign/${locationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Location removed');
        fetchLocations();
      } else {
        const result = await response.json();
        toast.error(result.error || 'Failed to remove location');
      }
    } catch (error) {
      console.error('Failed to unassign location:', error);
      toast.error('Failed to remove location');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (locationId: string) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/locations/barber/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationId, isPrimary: true }),
      });

      if (response.ok) {
        toast.success('Primary location updated');
        fetchLocations();
      } else {
        toast.error('Failed to set primary location');
      }
    } catch (error) {
      console.error('Failed to set primary:', error);
      toast.error('Failed to set primary location');
    } finally {
      setSaving(false);
    }
  };

  // Get unassigned available locations
  const assignedLocationIds = new Set(data?.assigned.map(a => a.location_id) || []);
  const unassignedLocations = data?.available.filter(loc => !assignedLocationIds.has(loc.id)) || [];

  return (
    <div 
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              My Locations
            </h2>
            <p className="text-sm text-gray-500">Manage where you offer services</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading locations...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Assigned Locations */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Your Locations</h3>
                {data?.assigned.length === 0 ? (
                  <Card className="p-4 text-center bg-gray-50">
                    <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No locations assigned yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add locations from the list below</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {data?.assigned.map((loc) => (
                      <Card key={loc.assignment_id} className={`p-4 ${loc.is_primary ? 'border-primary-300 bg-primary-50' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary-500" />
                              <span className="font-medium text-gray-900">{loc.name}</span>
                              {loc.is_primary && (
                                <span className="text-xs bg-primary-200 text-primary-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  Primary
                                </span>
                              )}
                            </div>
                            {loc.description && (
                              <p className="text-sm text-gray-600 mt-1">{loc.description}</p>
                            )}
                            {loc.address && (
                              <p className="text-xs text-gray-500 mt-0.5">{loc.address}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {!loc.is_primary && (
                              <button
                                onClick={() => handleSetPrimary(loc.location_id)}
                                disabled={saving}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Set as primary"
                              >
                                <Star className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleUnassignLocation(loc.location_id)}
                              disabled={saving}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove location"
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

              {/* Available Locations to Add */}
              {unassignedLocations.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Available Locations</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Add locations where you can offer services
                  </p>
                  <div className="space-y-2">
                    {unassignedLocations.map((loc) => (
                      <Card key={loc.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{loc.name}</span>
                            </div>
                            {loc.description && (
                              <p className="text-sm text-gray-600 mt-1">{loc.description}</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignLocation(loc.id)}
                            disabled={saving}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* No Available Locations */}
              {unassignedLocations.length === 0 && data?.available.length === data?.assigned.length && data?.assigned.length > 0 && (
                <Card className="p-4 text-center bg-green-50 border-green-200">
                  <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 text-sm font-medium">All available locations added</p>
                </Card>
              )}

              {/* No Locations at All */}
              {data?.available.length === 0 && (
                <Card className="p-6 text-center bg-amber-50 border-amber-200">
                  <MapPin className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-amber-800 font-medium">No locations available yet</p>
                  <p className="text-amber-600 text-sm mt-1">
                    Contact your campus manager to add service locations for your campus.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarberLocationsModal;

