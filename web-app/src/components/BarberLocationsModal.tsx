/**
 * Barber Service Location Modal
 *
 * Barbers pick a public service area by place name and map — no raw coordinates.
 * No background tracking. Meetup details for each booking are agreed in chat.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save } from 'lucide-react';
import Button from './Button';
import PlaceSearchInput from './PlaceSearchInput';
import ServiceAreaMap from './ServiceAreaMap';
import toast from 'react-hot-toast';
import locationService from '../services/location.service';
import barberService from '../services/barber.service';
import geocodeService, { type GeocodePlace } from '../services/geocode.service';
import {
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
  const [saving, setSaving] = useState(false);
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const [webOnly, setWebOnly] = useState(false);
  const [webOnlySaving, setWebOnlySaving] = useState(false);
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

      if (profile?.service_latitude != null && profile?.service_longitude != null) {
        setLatitude(profile.service_latitude);
        setLongitude(profile.service_longitude);

        if (profile.service_location_label) {
          setPlaceLabel(profile.service_location_label);
        } else {
          await reverseGeocodePin(profile.service_latitude, profile.service_longitude);
        }
      } else {
        setLatitude(null);
        setLongitude(null);
        setPlaceLabel('');
      }

      setWebOnly(profile?.service_location_web_only === true);

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
      loadSavedLocation();
    }
  }, [isVisible, loadSavedLocation]);

  const handleSave = async () => {
    const label = placeLabel.trim();
    if (!label) {
      toast.error('Enter or select a place name');
      return;
    }

    try {
      setSaving(true);
      if (webOnly) {
        if (latitude == null || longitude == null) {
          toast.error('Choose a location by searching or using the map');
          return;
        }
        await locationService.updateBarberServiceLocation({
          latitude,
          longitude,
          service_radius_km: serviceRadiusKm,
          service_location_label: label,
          source: 'manual',
        });
        toast.success('Service location saved');
      } else {
        // Device tracking on: label is a privacy estimate only
        await locationService.updateBarberServiceLocation({
          service_location_label: label,
        });
        toast.success('Privacy location saved');
      }
      onClose();
    } catch {
      toast.error('Failed to save service location');
    } finally {
      setSaving(false);
    }
  };

  const handleWebOnlyToggle = async () => {
    const next = !webOnly;
    try {
      setWebOnlySaving(true);
      await locationService.updateBarberServiceLocation({ web_only: next });
      setWebOnly(next);
      toast.success(next ? 'Device tracking off' : 'Device tracking on');
    } catch {
      toast.error('Failed to update location preference');
    } finally {
      setWebOnlySaving(false);
    }
  };

  const locationReady = webOnly
    ? latitude != null && longitude != null && placeLabel.trim().length > 0
    : placeLabel.trim().length > 0;

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
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-4 flex items-center justify-between z-10">
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
          {loadingProfile ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading saved location…</p>
          ) : (
            <>
              <div>
                {webOnly ? (
                  <PlaceSearchInput
                    value={placeLabel}
                    onChange={setPlaceLabel}
                    onSelectPlace={applyPlace}
                    disabled={saving || webOnlySaving}
                    showLabel={false}
                  />
                ) : (
                  <p className="py-2.5 text-sm font-bold text-gray-900 text-center">
                    {placeLabel.trim() || 'Location from device'}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    {webOnly
                      ? 'Toggle on to turn on device tracking'
                      : 'Toggle off to turn off device tracking'}
                  </p>
                  <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
                    <span className={`text-xs font-medium ${!webOnly ? 'text-gray-400' : 'text-gray-900'}`}>
                      Off
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!webOnly}
                      disabled={webOnlySaving || saving}
                      onChange={handleWebOnlyToggle}
                      aria-label="Device tracking"
                    />
                    <span
                      aria-hidden
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                        !webOnly ? 'bg-gray-900' : 'bg-gray-300'
                      } ${webOnlySaving || saving ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
                          !webOnly ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                    <span className={`text-xs font-medium ${!webOnly ? 'text-gray-900' : 'text-gray-400'}`}>
                      On
                    </span>
                  </label>
                </div>
              </div>

              {latitude != null && longitude != null && (
                <ServiceAreaMap
                  latitude={latitude}
                  longitude={longitude}
                  radiusKm={serviceRadiusKm}
                  onPinMove={handlePinMove}
                  focusVersion={mapFocusVersion}
                />
              )}

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
