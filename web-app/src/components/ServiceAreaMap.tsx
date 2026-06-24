import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapZoomForRadiusKm } from '../constants/serviceAreaPresets';

// Vite-friendly default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface ServiceAreaMapProps {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  onPinMove: (latitude: number, longitude: number) => void;
  className?: string;
  /** Increment to force the map to fly to the current coordinates. */
  focusVersion?: number;
}

const DEFAULT_CENTER: L.LatLngExpression = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

export default function ServiceAreaMap({
  latitude,
  longitude,
  radiusKm,
  onPinMove,
  className = '',
  focusVersion = 0,
}: ServiceAreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onPinMoveRef = useRef(onPinMove);
  const lastFlyRef = useRef<string>('');

  useEffect(() => {
    onPinMoveRef.current = onPinMove;
  }, [onPinMove]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) onPinMoveRef.current(pos.lat, pos.lng);
        });
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      }
      onPinMoveRef.current(lat, lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || latitude == null || longitude == null) return;

    const latLng: L.LatLngExpression = [latitude, longitude];

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current?.getLatLng();
        if (pos) onPinMoveRef.current(pos.lat, pos.lng);
      });
    } else {
      markerRef.current.setLatLng(latLng);
    }

    const radiusMeters = radiusKm * 1000;
    if (!circleRef.current) {
      circleRef.current = L.circle(latLng, {
        radius: radiusMeters,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latLng);
      circleRef.current.setRadius(radiusMeters);
    }

    const flyKey = `${latitude},${longitude},${radiusKm},${focusVersion}`;
    if (lastFlyRef.current !== flyKey) {
      lastFlyRef.current = flyKey;
      const targetZoom = mapZoomForRadiusKm(radiusKm);
      map.invalidateSize();
      map.flyTo(latLng, targetZoom, { duration: 0.75 });
    }
  }, [latitude, longitude, radiusKm, focusVersion]);

  return (
    <div className={className}>
      <p className="text-xs text-gray-500 mb-2">
        Tap the map or drag the pin to fine-tune. Customers see your area, not your exact address.
      </p>
      <div
        ref={containerRef}
        className="w-full h-52 sm:h-60 rounded-xl border border-gray-200 overflow-hidden z-0"
      />
    </div>
  );
}
