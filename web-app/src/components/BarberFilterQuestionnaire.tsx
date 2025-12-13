/**
 * Barber Filter Questionnaire Component
 * 
 * Progressive filtering system that asks:
 * 1. What type of haircut?
 * 2. When do you want it?
 * 3. Where do you want it?
 * 
 * Filters barbers in real-time as user answers
 */

import React, { useState } from 'react';
import { Scissors, Calendar, MapPin, ChevronRight } from 'lucide-react';
import Card from './Card';
import type { FilterCriteria } from '../types/barber-filters';

interface BarberFilterQuestionnaireProps {
  onFilterChange: (filters: FilterCriteria) => void;
  availableServices: string[];
}

export default function BarberFilterQuestionnaire({ 
  onFilterChange, 
  availableServices 
}: BarberFilterQuestionnaireProps) {
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [locationDetails, setLocationDetails] = useState<string>('');

  const handleServiceChange = (service: string) => {
    setServiceType(service);
    onFilterChange({
      serviceType: service,
      date,
      time,
      location,
      locationDetails,
    });
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    onFilterChange({
      serviceType,
      date: newDate,
      time,
      location,
      locationDetails,
    });
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    onFilterChange({
      serviceType,
      date,
      time: newTime,
      location,
      locationDetails,
    });
  };

  const handleLocationChange = (newLocation: string) => {
    setLocation(newLocation);
    onFilterChange({
      serviceType,
      date,
      time,
      location: newLocation,
      locationDetails,
    });
  };

  const handleLocationDetailsChange = (details: string) => {
    setLocationDetails(details);
    onFilterChange({
      serviceType,
      date,
      time,
      location,
      locationDetails: details,
    });
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="sticky top-0 z-20 bg-gradient-to-br from-indigo-50 to-purple-50 pb-6 -mx-4 px-4 mb-8">
      <Card className="shadow-lg">
        <div className="space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Find Your Perfect Barber</h2>
          <p className="text-sm text-gray-600">Answer a few questions to see barbers who match your needs</p>
        </div>

        {/* Question 1: Service Type */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Scissors className="w-5 h-5 text-indigo-600" />
            <label className="font-semibold">1. What type of haircut are you looking for?</label>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {availableServices.map((service) => (
              <button
                key={service}
                onClick={() => handleServiceChange(service)}
                className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                  serviceType === service
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Date & Time (only show if service selected) */}
        {serviceType && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-5 h-5 text-green-600" />
              <label className="font-semibold">2. When would you like your haircut?</label>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Preferred Date</label>
                <input
                  type="date"
                  value={date || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={getMinDate()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">Preferred Time</label>
                <input
                  type="time"
                  value={time || ''}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Question 3: Location (only show if date/time selected) */}
        {serviceType && date && time && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-5 h-5 text-purple-600" />
              <label className="font-semibold">3. Where would you like to receive your haircut?</label>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['On Campus', 'My Dorm/Apartment', "Barber's Location"].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => handleLocationChange(loc)}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                      location === loc
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              
              {location && (
                <div className="animate-fade-in">
                  <input
                    type="text"
                    value={locationDetails}
                    onChange={(e) => handleLocationDetailsChange(e.target.value)}
                    placeholder="Specific location (e.g., Building name, Room number)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Filter Progress:</span>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                serviceType ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                1
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                date && time ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                location ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                3
              </div>
            </div>
          </div>
        </div>
        </div>
      </Card>
    </div>
  );
}

