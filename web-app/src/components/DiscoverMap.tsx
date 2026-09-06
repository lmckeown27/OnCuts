import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DiscoverArea, DiscoverPin } from '../utils/myBarbersDiscover';
import {
  clusterDiscoverPins,
  discoverCircleRadiusMeters,
} from '../utils/myBarbersDiscover';
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
  pins: DiscoverPin[];
  selectedAreaKey: string | null;
  onSelectArea: (key: string | null) => void;
  /** Fired whenever zoom-based clusters change (for the side list). */
  onClustersChange?: (areas: DiscoverArea[]) => void;
  className?: string;
  /** Browse / device center */
  fallbackCenter?: { lat: number; lng: number } | null;
  /** Miles from BrowseUtilityPill (displayDistanceMiles) */
  searchRadiusMiles?: number | null;
  /** When false ("ALL"), no search-radius circle */
  constrainByDistance?: boolean;
}

export default function DiscoverMap({
  pins,
  selectedAreaKey,
  onSelectArea,
  onClustersChange,
  className = '',
  fallbackCenter = null,
  searchRadiusMiles = null,
  constrainByDistance = false,
}: DiscoverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectArea);
  const onClustersChangeRef = useRef(onClustersChange);
  const pinsRef = useRef(pins);
  const selectedKeyRef = useRef(selectedAreaKey);
  const searchOptsRef = useRef({ fallbackCenter, searchRadiusMiles, constrainByDistance });
  const lastSearchFitKey = useRef('');
  const didInitialFit = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelectArea;
  }, [onSelectArea]);

  useEffect(() => {
    onClustersChangeRef.current = onClustersChange;
  }, [onClustersChange]);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    selectedKeyRef.current = selectedAreaKey;
  }, [selectedAreaKey]);

  useEffect(() => {
    searchOptsRef.current = { fallbackCenter, searchRadiusMiles, constrainByDistance };
  }, [fallbackCenter, searchRadiusMiles, constrainByDistance]);

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

    const redraw = () => {
      const layer = layerRef.current;
      if (!layer) return;

      const zoom = map.getZoom();
      const nextPins = pinsRef.current;
      const clusters = clusterDiscoverPins(nextPins, zoom);
      onClustersChangeRef.current?.(clusters);

      const selectedKey = selectedKeyRef.current;
      if (selectedKey && !clusters.some((c) => c.key === selectedKey)) {
        onSelectRef.current(null);
      }

      layer.clearLayers();

      const {
        fallbackCenter: centerOpt,
        searchRadiusMiles: milesOpt,
        constrainByDistance: constrainOpt,
      } = searchOptsRef.current;

      const searchKm =
        constrainOpt &&
        milesOpt != null &&
        Number.isFinite(milesOpt) &&
        milesOpt > 0
          ? milesToKmForBrowse(milesOpt)
          : null;

      let searchCircle: L.Circle | null = null;
      if (centerOpt && searchKm != null) {
        searchCircle = L.circle([centerOpt.lat, centerOpt.lng], {
          radius: searchKm * 1000,
          color: SEARCH_RADIUS_COLOR,
          fillColor: SEARCH_RADIUS_COLOR,
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '6 6',
          interactive: false,
        });
        searchCircle.addTo(layer);
        searchCircle.bindTooltip(`${Math.round(milesOpt!)} mi search`, {
          permanent: false,
          direction: 'center',
          className: 'discover-map-tooltip',
        });
      }

      const activeKey = selectedKeyRef.current;
      for (const area of clusters) {
        const selected = activeKey === area.key;
        const circle = L.circle([area.latitude, area.longitude], {
          radius: discoverCircleRadiusMeters(area.latitude, zoom),
          color: selected ? OLIVE : UNSELECTED,
          fillColor: selected ? OLIVE : UNSELECTED,
          fillOpacity: selected ? 0.35 : 0.18,
          weight: selected ? 3 : 2,
        });

        circle.on('click', () => {
          onSelectRef.current(selected ? null : area.key);
        });

        if (area.label) {
          circle.bindTooltip(area.label, {
            permanent: false,
            direction: 'center',
            className: 'discover-map-tooltip',
          });
        }

        circle.addTo(layer);
      }

      if (searchCircle && centerOpt) {
        const fitKey = `${centerOpt.lat},${centerOpt.lng},${searchKm}`;
        if (lastSearchFitKey.current !== fitKey) {
          lastSearchFitKey.current = fitKey;
          didInitialFit.current = true;
          map.fitBounds(searchCircle.getBounds().pad(0.08), {
            maxZoom: mapZoomForRadiusKm(searchKm!),
            animate: true,
          });
        }
      } else if (!didInitialFit.current && nextPins.length > 0) {
        didInitialFit.current = true;
        const bounds = L.latLngBounds(
          nextPins.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)
        );
        map.fitBounds(bounds.pad(0.55), { maxZoom: 14 });
      } else if (!didInitialFit.current && centerOpt) {
        didInitialFit.current = true;
        map.setView([centerOpt.lat, centerOpt.lng], 12);
      }
    };

    map.on('zoomend', redraw);
    // Expose redraw for pin/search updates via map instance
    (map as L.Map & { __discoverRedraw?: () => void }).__discoverRedraw = redraw;

    const resize = () => {
      map.invalidateSize();
      redraw();
    };
    window.setTimeout(resize, 80);
    window.addEventListener('resize', resize);

    redraw();

    return () => {
      window.removeEventListener('resize', resize);
      map.off('zoomend', redraw);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      lastSearchFitKey.current = '';
      didInitialFit.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current as (L.Map & { __discoverRedraw?: () => void }) | null;
    map?.__discoverRedraw?.();
  }, [pins, fallbackCenter, searchRadiusMiles, constrainByDistance, selectedAreaKey]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        ref={containerRef}
        className="w-full flex-1 h-[min(62dvh,720px)] sm:h-[min(68dvh,800px)] lg:h-full min-h-[380px] sm:min-h-[480px] rounded-xl border border-gray-200 overflow-hidden z-0 bg-stone-100"
      />
      <p className="text-[10px] text-gray-400 mt-1.5 text-right shrink-0">
        {constrainByDistance && searchRadiusMiles != null
          ? `Search radius ${Math.round(searchRadiusMiles)} mi · zoom to split areas · © OpenStreetMap`
          : 'Zoom in to split areas · © OpenStreetMap'}
      </p>
    </div>
  );
}
