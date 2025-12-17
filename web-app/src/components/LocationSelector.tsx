/**
 * Location Selector Component
 * 
 * Purpose: Allow barbers to select service locations for bookings
 * Features:
 * - Autocomplete search
 * - Show verified locations first
 * - Add new location option
 * - Crowd-sourced + AI-enriched system
 */

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Check, Plus, ChevronDown } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

interface LocationOption {
  id: string;
  name: string;
  category: string;
  cohort: string;
  usageCount: number;
  confidence: number;
  isVerified: boolean;
  aliases?: string[];
}

interface LocationSelectorProps {
  universityId: string;
  selectedLocationId?: string;
  onLocationSelect: (locationId: string, locationName: string) => void;
  className?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  universityId,
  selectedLocationId,
  onLocationSelect,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationOption[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCategory, setNewLocationCategory] = useState<string>('ON_CAMPUS');
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);

  // Fetch all locations on mount
  useEffect(() => {
    fetchLocations();
  }, [universityId]);

  // Filter locations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLocations(locations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = locations.filter(loc => 
      loc.name.toLowerCase().includes(query) ||
      loc.aliases?.some(alias => alias.toLowerCase().includes(query))
    );

    setFilteredLocations(filtered);
  }, [searchQuery, locations]);

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/locations`, {
        params: { universityId },
      });

      if (response.data.success) {
        setLocations(response.data.data.locations);
        setFilteredLocations(response.data.data.locations);

        // Find selected location if provided
        if (selectedLocationId) {
          const selected = response.data.data.locations.find(
            (loc: LocationOption) => loc.id === selectedLocationId
          );
          if (selected) {
            setSelectedLocation(selected);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleSelectLocation = (location: LocationOption) => {
    setSelectedLocation(location);
    onLocationSelect(location.id, location.name);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleSubmitNewLocation = async () => {
    if (!newLocationName.trim()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/locations/submit`,
        {
          universityId,
          locationName: newLocationName,
          category: newLocationCategory,
        }
      );

      if (response.data.success) {
        const newLocation = response.data.data.location;
        setLocations(prev => [newLocation, ...prev]);
        setSelectedLocation(newLocation);
        onLocationSelect(newLocation.id, newLocation.name);
        setIsAddingNew(false);
        setNewLocationName('');
        setNewLocationCategory('ON_CAMPUS');
      }
    } catch (error) {
      console.error('Failed to submit location:', error);
      alert('Failed to add location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected Location Display */}
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gray-500" />
          <span className={selectedLocation ? 'text-gray-900' : 'text-gray-500'}>
            {selectedLocation ? selectedLocation.name : 'Select service location...'}
          </span>
          {selectedLocation?.isVerified && (
            <Check className="w-4 h-4 text-green-500" title="Verified location" />
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isDropdownOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <Card className="absolute z-10 mt-2 w-full max-h-96 overflow-auto shadow-xl">
          {/* Search */}
          <div className="sticky top-0 bg-white p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredLocations.length > 0 ? (
              <>
                {/* Verified Locations First */}
                {filteredLocations.filter(loc => loc.isVerified).length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      Verified Locations
                    </div>
                    {filteredLocations
                      .filter(loc => loc.isVerified)
                      .map((location) => (
                        <LocationItem
                          key={location.id}
                          location={location}
                          onSelect={handleSelectLocation}
                        />
                      ))}
                  </div>
                )}

                {/* Unverified Locations */}
                {filteredLocations.filter(loc => !loc.isVerified).length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                      Other Locations
                    </div>
                    {filteredLocations
                      .filter(loc => !loc.isVerified)
                      .map((location) => (
                        <LocationItem
                          key={location.id}
                          location={location}
                          onSelect={handleSelectLocation}
                        />
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                No locations found
              </div>
            )}
          </div>

          {/* Add New Location */}
          <div className="sticky bottom-0 bg-white border-t p-3">
            {!isAddingNew ? (
              <Button
                variant="outline"
                onClick={() => setIsAddingNew(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Location
              </Button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Location name (e.g., Yak Yit Dorm)"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  autoFocus
                />
                <select
                  value={newLocationCategory}
                  onChange={(e) => setNewLocationCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                >
                  <option value="ON_CAMPUS">On Campus</option>
                  <option value="DORM">Dormitory</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="OFF_CAMPUS">Off Campus</option>
                  <option value="COMMON_AREA">Common Area</option>
                  <option value="OTHER">Other</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitNewLocation}
                    disabled={loading || !newLocationName.trim()}
                    className="flex-1"
                  >
                    {loading ? 'Adding...' : 'Add'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewLocationName('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

/**
 * Individual Location Item Component
 */
interface LocationItemProps {
  location: LocationOption;
  onSelect: (location: LocationOption) => void;
}

const LocationItem: React.FC<LocationItemProps> = ({ location, onSelect }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(location)}
      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left flex items-start justify-between group"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{location.name}</span>
          {location.isVerified && (
            <Check className="w-4 h-4 text-green-500" title="Verified" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 capitalize">
            {location.category.toLowerCase().replace('_', ' ')}
          </span>
          {location.usageCount > 0 && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                Used {location.usageCount} {location.usageCount === 1 ? 'time' : 'times'}
              </span>
            </>
          )}
        </div>
        {location.aliases && location.aliases.length > 0 && (
          <div className="text-xs text-gray-400 mt-1">
            Also known as: {location.aliases.join(', ')}
          </div>
        )}
      </div>
      <div className="ml-2">
        <ChevronDown className="w-5 h-5 text-gray-400 transform -rotate-90 group-hover:text-primary-400" />
      </div>
    </button>
  );
};

