import { useState, useEffect, useRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import debounce from 'lodash.debounce';
import { Search, Loader2, MapPin } from 'lucide-react';
import geocodeService, { type GeocodePlace } from '../services/geocode.service';
import campusService from '../services/campus.service';

interface PlaceSearchInputProps {
  value: string;
  onChange: (label: string) => void;
  onSelectPlace: (place: GeocodePlace) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  showSearchIcon?: boolean;
  helperText?: string;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 800;

function campusMatchesQuery(name: string, city: string | undefined, query: string): boolean {
  const q = query.toLowerCase();
  return (
    name.toLowerCase().includes(q) ||
    (city ? city.toLowerCase().includes(q) : false) ||
    name.toLowerCase().replace(/\s+/g, '-').includes(q.replace(/\s+/g, '-'))
  );
}

export default function PlaceSearchInput({
  value,
  onChange,
  onSelectPlace,
  placeholder = 'Search campus, neighborhood, or address…',
  disabled = false,
  label = 'Public location',
  showLabel = true,
  showSearchIcon = true,
  helperText,
  className = '',
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    try {
      setLoading(true);
      setSearchError(null);

      const [places, campuses] = await Promise.all([
        geocodeService.searchPlaces(trimmed).catch(() => [] as GeocodePlace[]),
        campusService.getCampuses().catch(() => [] as Awaited<ReturnType<typeof campusService.getCampuses>>),
      ]);

      const campusPlaces: GeocodePlace[] = campuses
        .filter(
          (c) =>
            c.latitude != null &&
            c.longitude != null &&
            campusMatchesQuery(c.name, c.city, trimmed)
        )
        .slice(0, 5)
        .map((c) => ({
          label: c.name,
          latitude: c.latitude as number,
          longitude: c.longitude as number,
          placeType: 'campus',
        }));

      // Prefer OnCuts campuses at the top; dedupe by similar lat/lng
      const merged: GeocodePlace[] = [...campusPlaces];
      for (const place of places) {
        const duplicate = merged.some(
          (m) =>
            Math.abs(m.latitude - place.latitude) < 0.01 &&
            Math.abs(m.longitude - place.longitude) < 0.01
        );
        if (!duplicate) merged.push(place);
      }

      setResults(merged);
      setOpen(merged.length > 0);
      if (merged.length === 0) {
        setSearchError('No places found. Try a nearby city or campus name.');
      }
    } catch {
      setResults([]);
      setSearchError('Location search is temporarily unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce((text: string) => {
      void runSearch(text);
    }, SEARCH_DEBOUNCE_MS),
    [runSearch]
  );

  useEffect(() => {
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChange(text);
    setSearchError(null);
    if (text.trim().length < 2) {
      debouncedSearch.cancel();
      setResults([]);
      setOpen(false);
      return;
    }
    debouncedSearch(text);
  };

  const handleSelect = (place: GeocodePlace) => {
    debouncedSearch.cancel();
    setQuery(place.label);
    onChange(place.label);
    onSelectPlace(place);
    setOpen(false);
    setResults([]);
    setSearchError(null);
  };

  const submitQuery = async () => {
    const text = query.trim();
    if (text.length < 2 || disabled || loading) return;

    debouncedSearch.cancel();

    if (results.length > 0) {
      handleSelect(results[0]);
      return;
    }

    try {
      setLoading(true);
      setSearchError(null);
      const places = await geocodeService.searchPlaces(text);
      setResults(places);
      if (places.length > 0) {
        handleSelect(places[0]);
      } else {
        setSearchError('No places found. Try a nearby city or campus name.');
      }
    } catch {
      setSearchError('Location search is temporarily unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitQuery();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {showSearchIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-lg border border-gray-300 py-2.5 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-400 ${
            showSearchIcon ? 'pl-10' : 'pl-3'
          } ${loading ? 'pr-10' : 'pr-3'}`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 mt-1.5">{helperText}</p>
      )}

      {searchError && !loading && (
        <p className="text-xs text-amber-700 mt-1.5">{searchError}</p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((place, index) => (
            <li key={`${place.latitude}-${place.longitude}-${index}`}>
              <button
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-100 last:border-0"
              >
                <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-800">{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
