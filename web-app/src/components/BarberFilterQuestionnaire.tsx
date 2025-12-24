/**
 * Barber Filter Questionnaire Component
 * 
 * Progressive filtering system that asks:
 * 1. What type of haircut?
 * 2. When do you want it?
 * 3. Where do you want it?
 * 
 * Features:
 * - Smart tag deletion (cascade resets)
 * - Clickable tags for editing
 * - Confirmation for date/time
 * - Progressive questionnaire flow
 */

import React, { useState } from 'react';
import { Scissors, Calendar, MapPin, Check } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { LocationSelector } from './LocationSelector';
import type { FilterCriteria } from '../types/barber-filters';

interface BarberFilterQuestionnaireProps {
  onFilterChange: (filters: FilterCriteria) => void;
  availableServices: string[];
  availableCount: number;
}

export default function BarberFilterQuestionnaire({ 
  onFilterChange, 
  availableServices,
  availableCount 
}: BarberFilterQuestionnaireProps) {
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [dateTimeConfirmed, setDateTimeConfirmed] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  
  // Track which step we're editing (for clickable tags)
  const [editingStep, setEditingStep] = useState<'service' | 'datetime' | 'location' | null>(null);

  // Format date for display: "2025-12-30" → "Dec 30"
  const formatDateDisplay = (dateString: string): string => {
    const dateObj = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    return dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format time for display: "18:30" → "6:30 PM"
  const formatTimeDisplay = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const notifyFilterChange = (filters: FilterCriteria) => {
    onFilterChange(filters);
  };

  // Handle service type change
  const handleServiceChange = (service: string) => {
    setServiceType(service);
    setEditingStep(null);
    notifyFilterChange({
      serviceType: service,
      date,
      time,
      location: locationName,
      locationDetails: locationName,
    });
  };

  // Handle service type deletion - CLEARS EVERYTHING
  const handleServiceDelete = () => {
    setServiceType(null);
    setDate(null);
    setTime(null);
    setDateTimeConfirmed(false);
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    setEditingStep(null);
    notifyFilterChange({
      serviceType: null,
      date: null,
      time: null,
      location: null,
      locationDetails: null,
    });
  };

  // Handle service tag click - return to service selection
  const handleServiceTagClick = () => {
    setEditingStep('service');
    setServiceType(null);
    setDate(null);
    setTime(null);
    setDateTimeConfirmed(false);
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    notifyFilterChange({
      serviceType: null,
      date,
      time,
      location: null,
      locationDetails: null,
    });
  };

  // Handle date/time confirmation
  const handleDateTimeConfirm = () => {
    if (date && time) {
      setDateTimeConfirmed(true);
      setEditingStep(null);
    }
  };

  // Handle date/time deletion - keeps service, clears location
  const handleDateTimeDelete = () => {
    setDate(null);
    setTime(null);
    setDateTimeConfirmed(false);
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    setEditingStep(null);
    notifyFilterChange({
      serviceType,
      date: null,
      time: null,
      location: null,
      locationDetails: null,
    });
  };

  // Handle date/time tag click - return to date/time with values prefilled
  const handleDateTimeTagClick = () => {
    setDateTimeConfirmed(false);
    setEditingStep('datetime');
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    notifyFilterChange({
      serviceType,
      date,
      time,
      location: null,
      locationDetails: null,
    });
  };

  // Handle location selection from LocationSelector
  const handleLocationSelect = (newLocationId: string, newLocationName: string) => {
    setLocationId(newLocationId);
    setLocationName(newLocationName);
    setEditingStep(null);
    notifyFilterChange({
      serviceType,
      date,
      time,
      location: newLocationName,
      locationDetails: newLocationName,
    });
  };

  // Handle location confirmation
  const handleLocationConfirm = () => {
    if (locationId && locationName) {
      setLocationConfirmed(true);
      setEditingStep(null);
    }
  };

  // Handle location deletion - keeps service and date/time
  const handleLocationDelete = () => {
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    setEditingStep(null);
    notifyFilterChange({
      serviceType,
      date,
      time,
      location: null,
      locationDetails: null,
    });
  };

  // Handle location tag click - return to location selection
  const handleLocationTagClick = () => {
    setEditingStep('location');
    setLocationId(null);
    setLocationName(null);
    setLocationConfirmed(false);
    notifyFilterChange({
      serviceType,
      date,
      time,
      location: null,
      locationDetails: null,
    });
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Determine which question to show
  const showServiceQuestion = !serviceType || editingStep === 'service';
  const showDateTimeQuestion = serviceType && !dateTimeConfirmed && editingStep !== 'service';
  const showLocationQuestion = serviceType && dateTimeConfirmed && !locationConfirmed && editingStep !== 'service';

  return (
    <>
      {/* Questionnaire Section - Scrolls away normally */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-50 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-4 sm:pt-6 pb-4 sm:pb-6">
        <Card className="shadow-lg rounded-xl">
          {/* Selected Filter Pills - Fully clickable for editing */}
          {(serviceType || (date && time && dateTimeConfirmed) || (location && locationConfirmed)) && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-3 sm:pt-4 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-gray-200 px-2 sm:px-4">
              {serviceType && (
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary-400 text-white rounded-full text-xs sm:text-sm font-medium group">
                  <button
                    onClick={handleServiceTagClick}
                    className="flex items-center gap-1 sm:gap-2 hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    <Scissors className="w-3 h-3" />
                    <span className="group-hover:underline">{serviceType}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceDelete();
                    }}
                    className="hover:bg-primary-500 rounded-full px-1 ml-0.5 sm:ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
              {date && time && dateTimeConfirmed && (
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600 text-white rounded-full text-xs sm:text-sm font-medium group">
                  <button
                    onClick={handleDateTimeTagClick}
                    className="flex items-center gap-1 sm:gap-2 hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    <Calendar className="w-3 h-3" />
                    <span className="group-hover:underline">
                      {formatDateDisplay(date)} at {formatTimeDisplay(time)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDateTimeDelete();
                    }}
                    className="hover:bg-green-700 rounded-full px-1 ml-0.5 sm:ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
              {locationName && locationConfirmed && (
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary-400 text-white rounded-full text-xs sm:text-sm font-medium group">
                  <button
                    onClick={handleLocationTagClick}
                    className="flex items-center gap-1 sm:gap-2 hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    <MapPin className="w-3 h-3" />
                    <span className="group-hover:underline">{locationName}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLocationDelete();
                    }}
                    className="hover:bg-primary-500 rounded-full px-1 ml-0.5 sm:ml-1"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Question - Progressive flow */}
          <div className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-2 sm:px-4">
            {/* Question 1: Service Type */}
            {showServiceQuestion && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-gray-700 px-2">
                  <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" />
                  <label className="font-semibold text-sm sm:text-lg text-center">What type of haircut are you looking for?</label>
                </div>
                
                {/* Mobile: 2-column grid with vertical scroll */}
                <div className="lg:hidden max-h-36 overflow-y-auto px-2">
                  <div className="grid grid-cols-2 gap-2">
                    {availableServices.map((service) => (
                      <button
                        key={service}
                        onClick={() => handleServiceChange(service)}
                        className="px-3 py-4 rounded-xl font-semibold text-base bg-white text-primary-400 border-2 border-primary-400 hover:bg-primary-400 hover:text-white hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer"
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Desktop: Horizontal row with horizontal scroll */}
                <div className="hidden lg:block overflow-x-auto px-4 pb-2">
                  <div className="flex justify-center gap-3">
                    {availableServices.map((service) => (
                      <button
                        key={service}
                        onClick={() => handleServiceChange(service)}
                        className="flex-shrink-0 px-6 py-4 rounded-xl font-semibold text-lg bg-white text-primary-400 border-2 border-primary-400 hover:bg-primary-400 hover:text-white hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Question 2: Date & Time with Confirmation */}
            {showDateTimeQuestion && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-gray-700 px-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                  <label className="font-semibold text-sm sm:text-lg text-center">When would you like your haircut?</label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Enhanced Date Input */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Preferred Date</label>
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => {
                        const input = document.getElementById('date-picker-input') as HTMLInputElement;
                        if (input) {
                          input.showPicker?.();
                        }
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-50 to-green-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="relative flex items-center">
                        <Calendar className="absolute left-3 w-5 h-5 text-primary-400 pointer-events-none z-10" />
                        <input
                          id="date-picker-input"
                          type="date"
                          value={date || ''}
                          onChange={(e) => setDate(e.target.value)}
                          min={getMinDate()}
                          className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 hover:border-primary-300 transition-all bg-white cursor-pointer text-gray-700 font-medium"
                          style={{
                            colorScheme: 'light',
                            accentColor: '#708d81',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Time Input */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Preferred Time</label>
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => {
                        const input = document.getElementById('time-picker-input') as HTMLInputElement;
                        if (input) {
                          input.showPicker?.();
                        }
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-50 to-green-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="relative flex items-center">
                        <svg 
                          className="absolute left-3 w-5 h-5 text-primary-400 pointer-events-none z-10" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                          />
                        </svg>
                        <input
                          id="time-picker-input"
                          type="time"
                          value={time || ''}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 hover:border-primary-300 transition-all bg-white cursor-pointer text-gray-700 font-medium"
                          style={{
                            colorScheme: 'light',
                            accentColor: '#708d81',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirmation Button */}
                {date && time && (
                  <div className="flex justify-center pt-2">
                    <Button
                      onClick={handleDateTimeConfirm}
                      variant="primary"
                      className="px-6 py-2"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirm Date & Time
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Question 3: Location */}
            {showLocationQuestion && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-gray-700 px-2">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" />
                  <label className="font-semibold text-sm sm:text-lg text-center">Where would you like your haircut?</label>
                </div>
                
                <div className="max-w-md mx-auto">
                  <LocationSelector
                    universityId="00000000-0000-0000-0000-000000000001"
                    selectedLocationId={locationId || undefined}
                    onLocationSelect={handleLocationSelect}
                  />
                  
                  {/* Location Confirmation Button */}
                  {locationId && locationName && (
                    <div className="flex justify-center mt-3 sm:mt-4">
                      <Button
                        onClick={handleLocationConfirm}
                        variant="primary"
                        className="px-4 sm:px-6 py-2 text-sm sm:text-base"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirm Location
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Complete - Show summary */}
            {serviceType && dateTimeConfirmed && locationConfirmed && (
              <div className="text-center animate-fade-in px-2">
                <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-green-100 text-green-700 rounded-lg font-semibold text-sm sm:text-base">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All filters set! Scroll to see barbers</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Barber Count Section - Stays sticky at top */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-primary-50 to-primary-50 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 sm:py-4 mb-4 sm:mb-6 shadow-md">
        <div className="text-center">
          <div className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-primary-100 text-primary-500 rounded-full font-bold text-xl sm:text-2xl">
            <span>{availableCount === 1 ? 'Barber' : 'Barbers'} Available: {availableCount}</span>
          </div>
        </div>
      </div>
    </>
  );
}
