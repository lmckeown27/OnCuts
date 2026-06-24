/**
 * Barber Service Location Modal
 *
 * Uses the barber's device GPS for consumer discovery (aligned with iOS).
 * Preset campus location lists are no longer managed here.
 */

import React, { useState, useEffect } from 'react';
import { MapPin, X, RefreshCw, Navigation, AlertCircle, CheckCircle } from 'lucide-react';
import Button from './Button';
import toast from 'react-hot-toast';
import locationService from '../services/location.service';
import type { GeolocationState } from '../hooks/useGeolocation';

interface BarberLocationsModalProps {
  isVisible: boolean;
  onClose: () => void;
  latitude: number | null;
  longitude: number | null;
  permissionStatus: GeolocationState['permissionStatus'];
  geoLoading: boolean;
  geoError: string | null;
  onRefreshLocation: () => void;
  onRequestLocation: () => void;
}

const BarberLocationsModal: React.FC<BarberLocationsModalProps> = ({
  isVisible,
  onClose,
  latitude,
  longitude,
  permissionStatus,
  geoLoading,
  geoError,
  onRefreshLocation,
  onRequestLocation,
}) => {
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [savingRadius, setSavingRadius] = useState(false);

  const handleSaveRadius = async () => {
    try {
      setSavingRadius(true);
      await locationService.updateBarberServiceLocation({
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        service_radius_km: serviceRadiusKm,
      });
      toast.success('Service area updated');
    } catch {
      toast.error('Failed to update service area');
    } finally {
      setSavingRadius(false);
    }
  };

  const statusLabel =
    permissionStatus === 'granted'
      ? 'Location active'
      : permissionStatus === 'denied'
        ? 'Location blocked'
        : permissionStatus === 'unavailable'
          ? 'Location unavailable'
          : 'Location not enabled';

  const StatusIcon =
    permissionStatus === 'granted' ? CheckCircle : AlertCircle;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 text-white px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">Service Location</h2>
            <p className="text-white/80 text-sm">Your device location helps customers find you</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <StatusIcon
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                permissionStatus === 'granted' ? 'text-green-600' : 'text-amber-600'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{statusLabel}</p>
              <p className="text-sm text-gray-600 mt-1">
                CampusCuts uses your current device location for discovery and proximity sorting — the same
                approach as the iOS app. Move campuses freely; your pin updates when location is refreshed.
              </p>
              {geoError && (
                <p className="text-sm text-red-600 mt-2">{geoError}</p>
              )}
            </div>
          </div>

          {permissionStatus === 'granted' && latitude != null && longitude != null && (
            <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
              <div className="flex items-center gap-2 text-primary-800 font-medium mb-2">
                <Navigation className="w-4 h-4" />
                Current coordinates
              </div>
              <p className="text-sm text-primary-900 font-mono">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {permissionStatus !== 'granted' ? (
              <Button variant="primary" onClick={onRequestLocation} className="flex-1">
                <MapPin className="w-4 h-4 mr-2" />
                Enable location
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={onRefreshLocation}
                disabled={geoLoading}
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${geoLoading ? 'animate-spin' : ''}`} />
                {geoLoading ? 'Updating…' : 'Refresh location'}
              </Button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service radius ({serviceRadiusKm} km / {(serviceRadiusKm * 0.621371).toFixed(1)} mi)
            </label>
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              value={serviceRadiusKm}
              onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
              className="w-full accent-primary-500"
              disabled={savingRadius}
            />
            <p className="text-xs text-gray-500 mt-2">
              How far from your current location you are willing to travel for appointments.
            </p>
            <Button
              variant="outline"
              onClick={handleSaveRadius}
              disabled={savingRadius || permissionStatus !== 'granted'}
              className="mt-3 w-full sm:w-auto"
            >
              {savingRadius ? 'Saving…' : 'Save service radius'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarberLocationsModal;
