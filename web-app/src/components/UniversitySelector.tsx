/**
 * College town selector for consumer browse.
 * Groups campuses by city/state so users pick an area, not a single university.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, X, Loader2 } from 'lucide-react';
import campusService from '../services/campus.service';
import type { CollegeTown } from '../types';
import {
  buildCollegeTownsFromCampuses,
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
        setLoadError('Failed to load college towns');
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 1 && allTowns.length > 0) {
      const matches = searchCollegeTowns(allTowns, searchQuery, 8);
      setResults(matches);
      setHighlightedIndex(0);
    } else {
      setResults([]);
    }
  }, [searchQuery, allTowns]);

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
    onChange(town);
    setSearchQuery('');
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
          setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
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
        className={`relative flex items-center bg-white border-2 rounded-xl transition-all ${
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
          className="flex-1 px-3 py-3 text-gray-900 placeholder-gray-400 bg-transparent outline-none text-base text-center"
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
            className="p-2 mr-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear selected college town"
          >
            <X className="w-5 h-5" />
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
            className="pr-4 pl-2 py-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
              <p>Loading college towns...</p>
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
          ) : searchQuery.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>Start typing to search</p>
              <p className="text-xs mt-1 text-gray-400">{allTowns.length} college towns available</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No college towns found</p>
              <p className="text-sm mt-1">Try a city or state name</p>
            </div>
          ) : (
            <ul className="py-2">
              {results.map((town, index) => (
                <li key={town.id}>
                  <button
                    onClick={() => handleSelect(town)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      index === highlightedIndex ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{town.name}</p>
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
