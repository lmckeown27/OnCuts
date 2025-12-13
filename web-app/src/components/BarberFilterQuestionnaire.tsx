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
import { Scissors, Calendar, MapPin } from 'lucide-react';
import Card from './Card';
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
          <p className="text-sm text-gray-600 mb-3">Answer a few questions to see barbers who match your needs</p>
          
          {/* Real-time Barber Count */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full font-semibold">
            <span className="text-2xl">{availableCount}</span>
            <span>{availableCount === 1 ? 'Barber' : 'Barbers'} Available</span>
          </div>
        </div>

        {/* Summary Pills - Show selections made */}
        {(serviceType || date || location) && (
          <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-200">
            {serviceType && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-sm font-medium">
                <Scissors className="w-3 h-3" />
                <span>{serviceType}</span>
                <button
                  onClick={() => handleServiceChange('')}
                  className="hover:bg-indigo-700 rounded-full"
                >
                  ×
                </button>
              </div>
            )}
            {date && time && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium">
                <Calendar className="w-3 h-3" />
                <span>{date} at {time}</span>
                <button
                  onClick={() => { setDate(null); setTime(null); onFilterChange({ serviceType, date: null, time: null, location, locationDetails }); }}
                  className="hover:bg-green-700 rounded-full"
                >
                  ×
                </button>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-full text-sm font-medium">
                <MapPin className="w-3 h-3" />
                <span>{location}</span>
                <button
                  onClick={() => { setLocation(null); setLocationDetails(''); onFilterChange({ serviceType, date, time, location: null, locationDetails: null }); }}
                  className="hover:bg-purple-700 rounded-full"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Question - Only show current question */}
        <div className="min-h-[200px]">
          {/* Question 1: Service Type (default view) */}
          {!serviceType && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-gray-700">
                <Scissors className="w-5 h-5 text-indigo-600" />
                <label className="font-semibold text-lg">What type of haircut are you looking for?</label>
              </div>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {availableServices.map((service) => (
                  <button
                    key={service}
                    onClick={() => handleServiceChange(service)}
                    className="px-4 py-3 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 transition-all whitespace-nowrap flex-shrink-0"
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Question 2: Date & Time (only show if service selected and date/time not set) */}
          {serviceType && (!date || !time) && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5 text-green-600" />
                <label className="font-semibold text-lg">When would you like your haircut?</label>
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

          {/* Question 3: Location (only show if date/time selected and location not set) */}
          {serviceType && date && time && !location && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-5 h-5 text-purple-600" />
                <label className="font-semibold text-lg">Where would you like to receive your haircut?</label>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {['On Campus', 'My Dorm/Apartment', "Barber's Location"].map((loc) => (
                    <button
                      key={loc}
                      onClick={() => handleLocationChange(loc)}
                      className="px-4 py-3 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-700 transition-all"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location Details (only show if location selected) */}
          {location && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="w-5 h-5 text-purple-600" />
                <label className="font-semibold text-lg">Specify the exact location</label>
              </div>
              <input
                type="text"
                value={locationDetails}
                onChange={(e) => handleLocationDetailsChange(e.target.value)}
                placeholder="Building name, Room number, or specific area"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          {/* All Complete - Show summary */}
          {serviceType && date && time && location && locationDetails && (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>All filters set! Scroll down to see matching barbers</span>
              </div>
            </div>
          )}
        </div>
        </div>
      </Card>
    </div>
  );
}

