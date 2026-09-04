import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DiscoverArea } from '../utils/myBarbersDiscover';
import { mapZoomForRadiusKm } from '../constants/serviceAreaPresets';
import { colors } from '../utils/colors';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OLIVE = colors.olive[500];
const GREY = '#9ca3af';

interface DiscoverMapProps {
  areas: DiscoverArea[];
  selectedAreaKey: string | null;
  onSelectArea: (key: string | null) => void;
  className?: string;
  /** Fallback center when no areas */
  fallbackCenter?: { lat: number; lng: number } | null;
}

export default function DiscoverMap({
  areas,
  selectedAreaKey,
  onSelectArea,
  className = '',
  fallbackCenter = null,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectArea);
  const fittedRef = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelectArea;
  }, [onSelectArea]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = fallbackCenter
      ? [fallbackCenter.lat, fallbackCenter.lng]
      : [35.2828, -120.6596];

    const map = L.map(containerRef.current, {
      center,
      zoom: 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    window.setTimeout(resize, 80);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const area of areas) {
      const selected = selectedAreaKey === area.key;
      const circle = L.circle([area.latitude, area.longitude], {
        radius: area.radiusKm * 1000,
        color: selected ? OLIVE : GREY,
        fillColor: selected ? OLIVE : GREY,
        fillOpacity: selected ? 0.28 : 0.12,
        weight: selected ? 3 : 2,
      });

      circle.on('click', () => {
        onSelectRef.current(selected ? null : area.key);
      });

      circle.bindTooltip(area.label, {
        permanent: false,
        direction: 'center',
        className: 'discover-map-tooltip',
      });

      circle.addTo(layer);
      bounds.extend([area.latitude, area.longitude]);
    }

    if (areas.length > 0) {
      if (selectedAreaKey) {
        const selected = areas.find((a) => a.key === selectedAreaKey);
        if (selected) {
          map.flyTo(
            [selected.latitude, selected.longitude],
            mapZoomForRadiusKm(selected.radiusKm),
            { duration: 0.5 }
          );
        }
      } else if (!fittedRef.current) {
        fittedRef.current = true;
        map.fitBounds(bounds.pad(0.6), { maxZoom: 15 });
      } else if (areas.length === 1) {
        const only = areas[0];
        map.setView(
          [only.latitude, only.longitude],
          mapZoomForRadiusKm(only.radiusKm)
        );
      }
    } else if (fallbackCenter) {
      map.setView([fallbackCenter.lat, fallbackCenter.lng], 11);
    }

    window.setTimeout(() => map.invalidateSize(), 50);
  }, [areas, selectedAreaKey, fallbackCenter]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        ref={containerRef}
        className="w-full flex-1 h-[280px] sm:h-[420px] lg:h-full min-h-[280px] rounded-xl border border-gray-200 overflow-hidden z-0 bg-stone-100"
      />
      <p className="text-[10px] text-gray-400 mt-1.5 text-right shrink-0">
        Service areas are approximate · © OpenStreetMap
      </p>
    </div>
  );
}
