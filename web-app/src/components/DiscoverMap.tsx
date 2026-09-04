import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DiscoverArea } from '../utils/myBarbersDiscover';
import { mapZoomForRadiusKm } from '../constants/serviceAreaPresets';
import { colors } from '../utils/colors';
import { milesToKmForBrowse } from '../utils/consumerBrowseDistancePreference';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const OLIVE = colors.olive[500];
const UNSELECTED = '#000000';
const SEARCH_RADIUS_COLOR = '#708d81';

interface DiscoverMapProps {
  areas: DiscoverArea[];
  selectedAreaKey: string | null;
  onSelectArea: (key: string | null) => void;
  className?: string;
  /** Browse / device center */
  fallbackCenter?: { lat: number; lng: number } | null;
  /** Miles from BrowseUtilityPill (displayDistanceMiles) */
  searchRadiusMiles?: number | null;
  /** When false ("ALL"), no search-radius circle */
  constrainByDistance?: boolean;
}

export default function DiscoverMap({
  areas,
  selectedAreaKey,
  onSelectArea,
  className = '',
  fallbackCenter = null,
  searchRadiusMiles = null,
  constrainByDistance = false,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectArea);
  const lastSearchFitKey = useRef('');

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
      lastSearchFitKey.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const searchKm =
      constrainByDistance &&
      searchRadiusMiles != null &&
      Number.isFinite(searchRadiusMiles) &&
      searchRadiusMiles > 0
        ? milesToKmForBrowse(searchRadiusMiles)
        : null;

    let searchCircle: L.Circle | null = null;
    if (fallbackCenter && searchKm != null) {
      searchCircle = L.circle([fallbackCenter.lat, fallbackCenter.lng], {
        radius: searchKm * 1000,
        color: SEARCH_RADIUS_COLOR,
        fillColor: SEARCH_RADIUS_COLOR,
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6 6',
        interactive: false,
      });
      searchCircle.addTo(layer);
      searchCircle.bindTooltip(`${Math.round(searchRadiusMiles!)} mi search`, {
        permanent: false,
        direction: 'center',
        className: 'discover-map-tooltip',
      });
    }

    for (const area of areas) {
      const selected = selectedAreaKey === area.key;
      const circle = L.circle([area.latitude, area.longitude], {
        radius: area.radiusKm * 1000,
        color: selected ? OLIVE : UNSELECTED,
        fillColor: selected ? OLIVE : UNSELECTED,
        fillOpacity: selected ? 0.35 : 0.18,
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
    }

    if (selectedAreaKey) {
      const selected = areas.find((a) => a.key === selectedAreaKey);
      if (selected) {
        map.flyTo(
          [selected.latitude, selected.longitude],
          mapZoomForRadiusKm(Math.max(selected.radiusKm, 1)),
          { duration: 0.5 }
        );
      }
    } else if (searchCircle && fallbackCenter) {
      const fitKey = `${fallbackCenter.lat},${fallbackCenter.lng},${searchKm}`;
      if (lastSearchFitKey.current !== fitKey) {
        lastSearchFitKey.current = fitKey;
        map.fitBounds(searchCircle.getBounds().pad(0.08), {
          maxZoom: mapZoomForRadiusKm(searchKm!),
          animate: true,
        });
      }
    } else if (areas.length > 0) {
      const bounds = L.latLngBounds(
        areas.map((a) => [a.latitude, a.longitude] as L.LatLngTuple)
      );
      map.fitBounds(bounds.pad(0.6), { maxZoom: 15 });
    } else if (fallbackCenter) {
      map.setView([fallbackCenter.lat, fallbackCenter.lng], 12);
    }

    window.setTimeout(() => map.invalidateSize(), 50);
  }, [
    areas,
    selectedAreaKey,
    fallbackCenter,
    searchRadiusMiles,
    constrainByDistance,
  ]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        ref={containerRef}
        className="w-full flex-1 h-[280px] sm:h-[420px] lg:h-full min-h-[280px] rounded-xl border border-gray-200 overflow-hidden z-0 bg-stone-100"
      />
      <p className="text-[10px] text-gray-400 mt-1.5 text-right shrink-0">
        {constrainByDistance && searchRadiusMiles != null
          ? `Search radius ${Math.round(searchRadiusMiles)} mi · areas approximate · © OpenStreetMap`
          : 'Service areas are approximate · © OpenStreetMap'}
      </p>
    </div>
  );
}
