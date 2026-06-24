import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import geocodeService, { type GeocodePlace } from '../services/geocode.service';

interface PlaceSearchInputProps {
  value: string;
  onChange: (label: string) => void;
  onSelectPlace: (place: GeocodePlace) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  helperText?: string;
  className?: string;
}

export default function PlaceSearchInput({
  value,
  onChange,
  onSelectPlace,
  placeholder = 'Search campus, neighborhood, or address…',
  disabled = false,
  label = 'Public location',
  showLabel = true,
  helperText,
  className = '',
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      setLoading(true);
      const places = await geocodeService.searchPlaces(text);
      setResults(places);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  };

  const handleSelect = (place: GeocodePlace) => {
    setQuery(place.label);
    onChange(place.label);
    onSelectPlace(place);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {helperText && (
        <p className="text-xs text-gray-500 mt-1.5">{helperText}</p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((place, index) => (
            <li key={`${place.latitude}-${place.longitude}-${index}`}>
              <button
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 flex items-start gap-2 border-b border-gray-100 last:border-0"
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
