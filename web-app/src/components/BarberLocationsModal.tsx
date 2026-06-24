/**
 * Barber Service Location Modal
 *
 * Barbers pick a public service area by place name and map — no raw coordinates.
 * No background tracking. Meetup details for each booking are agreed in chat.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, X, Navigation, AlertCircle, CheckCircle, Save, GraduationCap } from 'lucide-react';
import Button from './Button';
import PlaceSearchInput from './PlaceSearchInput';
import ServiceAreaMap from './ServiceAreaMap';
import toast from 'react-hot-toast';
import locationService from '../services/location.service';
import barberService from '../services/barber.service';
import campusService from '../services/campus.service';
import geocodeService, { type GeocodePlace } from '../services/geocode.service';
import {
  SERVICE_AREA_PRESETS,
  presetFromRadiusKm,
  radiusKmFromPreset,
  type ServiceAreaPresetId,
} from '../constants/serviceAreaPresets';

interface BarberLocationsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const BarberLocationsModal: React.FC<BarberLocationsModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [placeLabel, setPlaceLabel] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [areaPreset, setAreaPreset] = useState<ServiceAreaPresetId>('campus');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [detectingDevice, setDetectingDevice] = useState(false);
  const [loadingCampus, setLoadingCampus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [hasSavedLocation, setHasSavedLocation] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const reverseGeocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serviceRadiusKm = radiusKmFromPreset(areaPreset);

  const applyPlace = useCallback((place: GeocodePlace) => {
    setPlaceLabel(place.label);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setMapFocusVersion((v) => v + 1);
  }, []);

  const reverseGeocodePin = useCallback(async (lat: number, lng: number) => {
    try {
      const place = await geocodeService.reverseGeocode(lat, lng);
      setPlaceLabel(place.label);
    } catch {
      // Keep existing label if reverse geocode fails
    }
  }, []);

  const handlePinMove = useCallback(
    (lat: number, lng: number) => {
      setLatitude(lat);
      setLongitude(lng);
      if (reverseGeocodeRef.current) clearTimeout(reverseGeocodeRef.current);
      reverseGeocodeRef.current = setTimeout(() => reverseGeocodePin(lat, lng), 500);
    },
    [reverseGeocodePin]
  );

  const loadSavedLocation = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const profile = await barberService.getMyBarberProfile();
      setCampusId(profile?.campus_id ?? null);

      if (profile?.service_latitude != null && profile?.service_longitude != null) {
        setLatitude(profile.service_latitude);
        setLongitude(profile.service_longitude);
        setHasSavedLocation(true);

        if (profile.service_location_label) {
          setPlaceLabel(profile.service_location_label);
        } else {
          await reverseGeocodePin(profile.service_latitude, profile.service_longitude);
        }
      } else {
        setLatitude(null);
        setLongitude(null);
        setPlaceLabel('');
        setHasSavedLocation(false);
      }

      if (profile?.service_radius_km != null) {
        setAreaPreset(presetFromRadiusKm(profile.service_radius_km));
      }
      setMapFocusVersion((v) => v + 1);
    } catch {
      toast.error('Failed to load service location');
    } finally {
      setLoadingProfile(false);
    }
  }, [reverseGeocodePin]);

  useEffect(() => {
    if (isVisible) {
      setDeviceError(null);
      loadSavedLocation();
    }
  }, [isVisible, loadSavedLocation]);

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      setDeviceError('Geolocation is not supported by your browser');
      return;
    }

    setDetectingDevice(true);
    setDeviceError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat);
        setLongitude(lng);
        setMapFocusVersion((v) => v + 1);
        setDetectingDevice(false);
        try {
          const place = await geocodeService.reverseGeocode(lat, lng);
          setPlaceLabel(place.label);
          toast.success('Location loaded — tap Save when ready');
        } catch {
          setPlaceLabel('My current area');
          toast.success('Location loaded — tap Save when ready');
        }
      },
      (error) => {
        let message = 'Unable to get your location';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Search for a place or use your campus instead.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Try again or search for a place.';
        }
        setDeviceError(message);
        setDetectingDevice(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleUseCampus = async () => {
    if (!campusId) {
      toast.error('No campus linked to your profile');
      return;
    }
    try {
      setLoadingCampus(true);
      const campus = await campusService.getCampusById(campusId);
      if (campus.latitude == null || campus.longitude == null) {
        toast.error('Campus coordinates are not available');
        return;
      }
      const label = [campus.shortName || campus.name, campus.city, campus.state]
        .filter(Boolean)
        .join(', ');
      applyPlace({
        label,
        latitude: campus.latitude,
        longitude: campus.longitude,
      });
      setAreaPreset('campus');
      toast.success('Campus area loaded — adjust if needed');
    } catch {
      toast.error('Failed to load campus location');
    } finally {
      setLoadingCampus(false);
    }
  };

  const handleSave = async () => {
    if (latitude == null || longitude == null) {
      toast.error('Choose a location by searching, using the map, or a quick action');
      return;
    }
    const label = placeLabel.trim();
    if (!label) {
      toast.error('Enter or select a place name');
      return;
    }

    try {
      setSaving(true);
      await locationService.updateBarberServiceLocation({
        latitude,
        longitude,
        service_radius_km: serviceRadiusKm,
        service_location_label: label,
      });
      setHasSavedLocation(true);
      toast.success('Service location saved');
      onClose();
    } catch {
      toast.error('Failed to save service location');
    } finally {
      setSaving(false);
    }
  };

  const locationReady = latitude != null && longitude != null && placeLabel.trim().length > 0;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 text-white px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">Service Location</h2>
            <p className="text-white/80 text-sm">Where customers can find you for booking</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            {hasSavedLocation ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {hasSavedLocation ? 'Service area set' : 'No service area saved yet'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Pick as broad or specific an area as you like — campus, neighborhood, or a particular
                spot. CampusCuts does not track your device. Where to meet for each appointment is
                agreed in chat.
              </p>
            </div>
          </div>

          {loadingProfile ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading saved location…</p>
          ) : (
            <>
              <PlaceSearchInput
                value={placeLabel}
                onChange={setPlaceLabel}
                onSelectPlace={applyPlace}
                disabled={saving || detectingDevice}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={handleUseDeviceLocation}
                  disabled={saving || detectingDevice || loadingCampus}
                  className="flex-1"
                >
                  <Navigation className={`w-4 h-4 mr-2 ${detectingDevice ? 'animate-pulse' : ''}`} />
                  {detectingDevice ? 'Detecting…' : 'Use my device once'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUseCampus}
                  disabled={saving || detectingDevice || loadingCampus || !campusId}
                  className="flex-1"
                >
                  <GraduationCap className={`w-4 h-4 mr-2 ${loadingCampus ? 'animate-pulse' : ''}`} />
                  {loadingCampus ? 'Loading…' : 'Use my campus'}
                </Button>
              </div>

              {deviceError && <p className="text-sm text-red-600">{deviceError}</p>}

              {latitude != null && longitude != null && (
                <ServiceAreaMap
                  latitude={latitude}
                  longitude={longitude}
                  radiusKm={serviceRadiusKm}
                  onPinMove={handlePinMove}
                  focusVersion={mapFocusVersion}
                />
              )}

              {locationReady && (
                <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
                  <div className="flex items-center gap-2 text-primary-800 font-medium mb-1">
                    <MapPin className="w-4 h-4" />
                    Public area preview
                  </div>
                  <p className="text-sm text-primary-900">{placeLabel.trim()}</p>
                </div>
              )}

              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">
                  How broad should your public area be?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICE_AREA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAreaPreset(preset.id)}
                      disabled={saving}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        areaPreset === preset.id
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                          : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !locationReady}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving…' : 'Save service location'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarberLocationsModal;
