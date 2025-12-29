/**
 * useGeolocation Hook
 * 
 * Provides browser-based geolocation with permission handling.
 * Used to determine closest barbers to the user.
 * Automatically syncs location to backend for authenticated users.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import locationService from '../services/location.service';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => void;
  clearLocation: () => void;
  syncToBackend: () => Promise<void>;
}

const STORAGE_KEY = 'campuscut_user_location';

// Calculate distance between two points using Haversine formula (returns km)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Convert km to miles
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    permissionStatus: 'prompt',
  });
  
  const { isAuthenticated } = useAuthStore();

  // Sync location to backend for authenticated users
  const syncToBackend = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      await locationService.updateLocation({
        latitude: state.latitude ?? undefined,
        longitude: state.longitude ?? undefined,
        permission: state.permissionStatus,
      });
    } catch (error) {
      console.warn('Failed to sync location to backend:', error);
      // Don't throw - this is a non-critical operation
    }
  }, [isAuthenticated, state.latitude, state.longitude, state.permissionStatus]);

  // Check permission status on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, permissionStatus: 'unavailable' }));
      return;
    }

    // Check if we have stored location
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { latitude, longitude, accuracy, timestamp } = JSON.parse(stored);
        // Use stored location if less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          setState(prev => ({
            ...prev,
            latitude,
            longitude,
            accuracy,
            permissionStatus: 'granted',
          }));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Check permission status if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState(prev => ({ ...prev, permissionStatus: result.state as any }));
        
        result.onchange = () => {
          setState(prev => ({ ...prev, permissionStatus: result.state as any }));
        };
      }).catch(() => {
        // Permissions API not fully supported
      });
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const newState = {
        ...state,
        error: 'Geolocation is not supported by your browser',
        permissionStatus: 'unavailable' as const,
      };
      setState(newState);
      
      // Sync unavailable status to backend
      if (isAuthenticated) {
        locationService.updateLocation({ permission: 'unavailable' }).catch(() => {});
      }
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        // Store location for later use
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
        }));

        setState({
          latitude,
          longitude,
          accuracy,
          error: null,
          loading: false,
          permissionStatus: 'granted',
        });

        // Sync to backend for authenticated users
        if (isAuthenticated) {
          try {
            await locationService.updateLocation({
              latitude,
              longitude,
              permission: 'granted',
            });
          } catch (error) {
            console.warn('Failed to sync location to backend:', error);
          }
        }
      },
      async (error) => {
        let errorMessage = 'Unable to get your location';
        let permissionStatus: GeolocationState['permissionStatus'] = 'denied';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            permissionStatus = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            permissionStatus = 'prompt';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            permissionStatus = 'prompt';
            break;
        }

        setState(prev => ({
          ...prev,
          error: errorMessage,
          loading: false,
          permissionStatus,
        }));

        // Sync denied/unavailable status to backend
        if (isAuthenticated && permissionStatus === 'denied') {
          try {
            await locationService.updateLocation({ permission: 'denied' });
          } catch (err) {
            console.warn('Failed to sync location denial to backend:', err);
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, [isAuthenticated, state]);

  const clearLocation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      error: null,
      loading: false,
      permissionStatus: 'prompt',
    });
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
    syncToBackend,
  };
}

export default useGeolocation;

