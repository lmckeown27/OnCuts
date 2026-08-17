/**
 * Location selector for consumer browse (landing + related flows).
 * Searches OnCuts campus towns and the same place geocoder used for operator location.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { ChevronDown, X, Loader2, MapPin } from 'lucide-react';
import campusService from '../services/campus.service';
import geocodeService, { type GeocodePlace } from '../services/geocode.service';
import type { CollegeTown } from '../types';
import {
  buildCollegeTownsFromCampuses,
  collegeTownFromGeocodePlace,
  searchCollegeTowns,
} from '../utils/collegeTowns';

export type { CollegeTown } from '../types';
export type University = CollegeTown;

interface UniversitySelectorProps {
  value: CollegeTown | null;
  onChange: (town: CollegeTown | null) => void;
  placeholder?: string;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 400;

let townsCache: CollegeTown[] | null = null;
let cachePromise: Promise<CollegeTown[]> | null = null;

async function loadCollegeTowns(): Promise<CollegeTown[]> {
  if (townsCache) {
    return townsCache;
  }

  if (cachePromise) {
    return cachePromise;
  }

  cachePromise = campusService.getCampuses().then((campuses) => {
    townsCache = buildCollegeTownsFromCampuses(campuses);
    return townsCache;
  });

  return cachePromise;
}

function placesNearMatch(
  aLat: number | null | undefined,
  aLng: number | null | undefined,
  bLat: number,
  bLng: number
): boolean {
  if (aLat == null || aLng == null) return false;
  return Math.abs(aLat - bLat) < 0.01 && Math.abs(aLng - bLng) < 0.01;
}

export default function UniversitySelector({
  value,
  onChange,
  placeholder = 'Search for your college town...',
  className = '',
}: UniversitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CollegeTown[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [allTowns, setAllTowns] = useState<CollegeTown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    loadCollegeTowns()
      .then((towns) => {
        setAllTowns(towns);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load college towns:', err);
        setLoadError('Failed to load locations');
        setIsLoading(false);
      });
  }, []);

  const runSearch = useCallback(
    async (query: string, towns: CollegeTown[]) => {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const townMatches = searchCollegeTowns(towns, trimmed, 8);
        const places =
          trimmed.length >= 2
            ? await geocodeService.searchPlaces(trimmed).catch(() => [] as GeocodePlace[])
            : [];

        const placeTowns = places.map(collegeTownFromGeocodePlace);
        const merged: CollegeTown[] = [...townMatches];
        for (const placeTown of placeTowns) {
          const duplicate = merged.some(
            (m) =>
              placesNearMatch(m.latitude, m.longitude, placeTown.latitude!, placeTown.longitude!) ||
              m.name.toLowerCase() === placeTown.name.toLowerCase()
          );
          if (!duplicate) merged.push(placeTown);
        }

        setResults(merged.slice(0, 12));
        setHighlightedIndex(0);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((query: string, towns: CollegeTown[]) => {
        void runSearch(query, towns);
      }, SEARCH_DEBOUNCE_MS),
    [runSearch]
  );

  useEffect(() => {
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      debouncedSearch.cancel();
      setResults([]);
      setIsSearching(false);
      return;
    }
    debouncedSearch(searchQuery, allTowns);
  }, [searchQuery, allTowns, debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (town: CollegeTown) => {
    debouncedSearch.cancel();
    onChange(town);
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[highlightedIndex]) {
            handleSelect(results[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSelect closes over stable setters
    [isOpen, results, highlightedIndex]
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchQuery('');
    setResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const getInputDisplayValue = () => {
    if (value) {
      return value.name;
    }
    return searchQuery;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`relative flex items-center bg-white border-2 rounded-2xl transition-all ${
          isOpen ? 'border-gray-900 shadow-lg' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={getInputDisplayValue()}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!value) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-4 py-4 sm:px-5 sm:py-5 text-gray-900 placeholder-gray-400 bg-transparent outline-none text-lg sm:text-xl text-center"
          readOnly={!!value}
          onClick={() => {
            if (value) {
              onChange(null);
              setSearchQuery('');
              setIsOpen(true);
            }
          }}
        />

        {value ? (
          <button
            onClick={handleClear}
            className="p-2.5 mr-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear selected location"
          >
            <X className="w-6 h-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isOpen) {
                setIsOpen(false);
                inputRef.current?.blur();
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            className="pr-5 pl-2 py-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isLoading || isSearching ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ChevronDown className={`w-6 h-6 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-gray-400 animate-spin" />
              <p>Loading locations...</p>
            </div>
          ) : loadError ? (
            <div className="p-4 text-center text-red-500">
              <p>{loadError}</p>
              <button
                onClick={() => {
                  townsCache = null;
                  cachePromise = null;
                  setIsLoading(true);
                  loadCollegeTowns()
                    .then((towns) => {
                      setAllTowns(towns);
                      setIsLoading(false);
                      setLoadError(null);
                    })
                    .catch(() => setIsLoading(false));
                }}
                className="mt-2 text-sm text-gray-900 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : searchQuery.trim().length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>Start typing to search</p>
              <p className="text-sm mt-1">Campus, city, or area</p>
            </div>
          ) : isSearching && results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-6 h-6 mx-auto mb-2 text-gray-400 animate-spin" />
              <p>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No locations found</p>
              <p className="text-sm mt-1">Try a campus, city, or neighborhood</p>
            </div>
          ) : (
            <ul className="py-2">
              {results.map((town, index) => (
                <li key={town.id}>
                  <button
                    onClick={() => handleSelect(town)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-5 py-4 text-left transition-colors flex items-start gap-3 ${
                      index === highlightedIndex ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 mt-1 text-gray-400 shrink-0" />
                    <span className="min-w-0">
                      <p className="font-medium text-base sm:text-lg text-gray-900">{town.name}</p>
                      {town.campusCount > 0 ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {town.campusCount === 1
                            ? 'Campus area'
                            : `${town.campusCount} campuses nearby`}
                        </p>
                      ) : town.city && town.city !== town.name ? (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {town.city}
                          {town.state ? `, ${town.state}` : ''}
                        </p>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export async function getNearestUniversity(lat: number, lng: number): Promise<CollegeTown | undefined> {
  const towns = await loadCollegeTowns();

  if (!lat || !lng || towns.length === 0) return undefined;

  let nearest: CollegeTown | undefined;
  let minDistance = Infinity;

  for (const town of towns) {
    if (town.latitude == null || town.longitude == null) continue;

    const distance = haversineDistance(lat, lng, town.latitude, town.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = town;
    }
  }

  return nearest;
}

export function getUniversityById(id: string): CollegeTown | undefined {
  return townsCache?.find((town) => town.id === id);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
