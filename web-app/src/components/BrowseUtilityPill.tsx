import { useEffect, useRef, useState } from 'react';
import { Check, Filter, Search, X } from 'lucide-react';
import BrowseRadiusSlider from './BrowseRadiusSlider';
import {
  BROWSE_PROVIDER_CATEGORIES,
  type BrowseProviderCategory,
} from '../config/providerCategories';
import {
  BROWSE_MAX_DISTANCE_MILES,
  BROWSE_MIN_DISTANCE_MILES,
} from '../utils/consumerBrowseDistancePreference';

export type BrowseUtilityPillMode = 'collapsed' | 'search' | 'radius' | 'category';

type SearchSuggestion = {
  id: string;
  label: string;
  subtitle?: string;
};

interface BrowseUtilityPillProps {
  browseLabel: string;
  townShortName: string;
  onChangeTown: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchSuggestions?: SearchSuggestion[];
  onSearchSuggestionSelect?: (id: string) => void;
  browseCategory: BrowseProviderCategory;
  onBrowseCategoryChange: (category: BrowseProviderCategory) => void;
  constrainByDistance: boolean;
  onConstrainByDistanceChange: (enabled: boolean) => void;
  maxDistanceMiles: number;
  displayDistanceMiles: number;
  onMaxDistancePreview: (miles: number) => void;
  onMaxDistanceCommitted: (miles: number) => void;
  resultsCount?: number;
  showResultsCount?: boolean;
  missingTownCoords?: boolean;
}

function PillDivider({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <div className="w-px h-6 bg-gray-300/70 shrink-0" aria-hidden="true" />;
}

export default function BrowseUtilityPill({
  browseLabel,
  townShortName,
  onChangeTown,
  searchQuery,
  onSearchQueryChange,
  searchSuggestions = [],
  onSearchSuggestionSelect,
  browseCategory,
  onBrowseCategoryChange,
  constrainByDistance,
  onConstrainByDistanceChange,
  maxDistanceMiles,
  displayDistanceMiles,
  onMaxDistancePreview,
  onMaxDistanceCommitted,
  resultsCount = 0,
  showResultsCount = false,
  missingTownCoords = false,
}: BrowseUtilityPillProps) {
  const [mode, setMode] = useState<BrowseUtilityPillMode>('collapsed');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedCategory =
    BROWSE_PROVIDER_CATEGORIES.find((option) => option.id === browseCategory) ??
    BROWSE_PROVIDER_CATEGORIES[0];

  const searchTrimmed = searchQuery.trim();
  const showSuggestions =
    mode === 'search' && searchTrimmed.length > 0 && searchSuggestions.length > 0;

  useEffect(() => {
    if (mode === 'search') {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mode]);

  const closeAllModes = () => setMode('collapsed');

  const openSearch = () => {
    if (mode === 'radius') {
      onMaxDistanceCommitted(Math.round(displayDistanceMiles));
    }
    setMode('search');
  };

  const openRadius = () => {
    onSearchQueryChange('');
    if (!constrainByDistance) {
      onConstrainByDistanceChange(true);
    }
    setMode('radius');
  };

  const openCategory = () => {
    if (mode === 'radius') {
      onMaxDistanceCommitted(Math.round(displayDistanceMiles));
    }
    onSearchQueryChange('');
    setMode('category');
  };

  const closeSearch = () => {
    onSearchQueryChange('');
    closeAllModes();
  };

  const commitRadius = () => {
    onMaxDistanceCommitted(Math.round(displayDistanceMiles));
    closeAllModes();
  };

  const radiusChipLabel = constrainByDistance
    ? `${Math.round(displayDistanceMiles)} MI`
    : 'ALL';

  const sideSegmentsVisible = mode === 'collapsed';

  return (
    <div className="mb-4 sm:mb-5">
      <div className="text-center text-xs sm:text-sm text-gray-600 flex flex-wrap items-center justify-center gap-2 mb-2">
        <span>{browseLabel}</span>
        <span className="text-gray-400" aria-hidden="true">
          •
        </span>
        <button
          type="button"
          onClick={onChangeTown}
          className="text-primary-600 hover:text-black underline"
        >
          Change
        </button>
      </div>

      <div className="max-w-lg mx-auto space-y-2">
        {mode === 'radius' ? (
          <div
            className="rounded-3xl border border-gray-200/90 bg-white/85 backdrop-blur-xl shadow-sm px-4 py-3 space-y-2"
            role="region"
            aria-label="Adjust search radius"
          >
            <div className="relative flex items-center justify-center min-h-8 px-16">
              <button
                type="button"
                onClick={() => {
                  onConstrainByDistanceChange(false);
                  closeAllModes();
                }}
                className="absolute left-0 text-xs font-medium text-gray-500 hover:text-gray-800 underline"
              >
                No limit
              </button>
              <p className="text-sm font-semibold text-gray-900 text-center">
                {Math.round(displayDistanceMiles)} miles away
              </p>
              <button
                type="button"
                onClick={commitRadius}
                className="absolute right-0 p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-95"
                aria-label="Close radius adjustment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center -mt-1">from {townShortName}</p>
            <div className="px-1">
              <BrowseRadiusSlider
                min={BROWSE_MIN_DISTANCE_MILES}
                max={BROWSE_MAX_DISTANCE_MILES}
                value={maxDistanceMiles}
                onChange={onMaxDistancePreview}
                onChangeCommitted={onMaxDistanceCommitted}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{BROWSE_MIN_DISTANCE_MILES} mi</span>
                <span>{BROWSE_MAX_DISTANCE_MILES} mi</span>
              </div>
            </div>
            {missingTownCoords && (
              <p className="text-xs text-amber-700 text-center">
                This college town has no map coordinates — distance filtering may be unavailable.
              </p>
            )}
          </div>
        ) : mode === 'category' ? (
          <div
            className="rounded-full border border-gray-200/90 bg-white/85 backdrop-blur-xl shadow-sm px-4 py-3"
            role="region"
            aria-label="Provider type filter"
          >
            <div className="relative flex items-center justify-center min-h-8 mb-2 px-10">
              <p className="text-sm font-semibold text-gray-900 text-center">Provider type</p>
              <button
                type="button"
                onClick={closeAllModes}
                className="absolute right-0 p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-95"
                aria-label="Done filtering by provider type"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {BROWSE_PROVIDER_CATEGORIES.map((option) => {
                const isSelected = browseCategory === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onBrowseCategoryChange(option.id);
                      closeAllModes();
                    }}
                    aria-pressed={isSelected}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors active:scale-95 ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className={`rounded-full border bg-white/85 backdrop-blur-xl shadow-sm transition-all duration-300 ease-out h-14 flex items-center px-2 sm:px-3 ${
              mode === 'search'
                ? 'border-olive-400/80 ring-2 ring-olive-400/40'
                : 'border-gray-200/90'
            }`}
          >
            <div
              className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                sideSegmentsVisible ? 'max-w-[40%] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
              }`}
            >
              <button
                type="button"
                onClick={openRadius}
                className="shrink-0 px-3 py-2 rounded-full text-xs font-bold tracking-wider text-gray-800 hover:bg-gray-100 transition-colors active:scale-95"
                aria-label={
                  constrainByDistance
                    ? `Maximum search distance, ${Math.round(displayDistanceMiles)} miles, adjust`
                    : 'Search all providers without distance limit, adjust'
                }
              >
                {radiusChipLabel}
              </button>
              <PillDivider visible={sideSegmentsVisible} />
            </div>

            {mode === 'search' ? (
              <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
                <Search className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  id="barber-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Search barbers"
                  className="flex-1 min-w-0 bg-transparent text-base sm:text-lg font-semibold text-gray-900 placeholder-gray-400 focus:outline-none"
                  aria-label="Search barbers"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-95 shrink-0"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openSearch}
                  className="flex-1 flex items-center justify-center py-2 rounded-full text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
                  aria-label="Search barbers"
                >
                  <Search className="w-5 h-5" />
                </button>
                <PillDivider visible={sideSegmentsVisible} />
                <div
                  className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${
                    sideSegmentsVisible ? 'max-w-[45%] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <button
                    type="button"
                    onClick={openCategory}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors active:scale-95"
                    aria-label={`Provider type filter, ${selectedCategory.label}`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="truncate max-w-[5.5rem]">{selectedCategory.label}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {showSuggestions && (
          <div className="rounded-2xl border border-gray-200/90 bg-white/90 backdrop-blur-xl shadow-sm p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Providers</p>
            <ul className="space-y-1">
              {searchSuggestions.slice(0, 6).map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSearchSuggestionSelect?.(suggestion.id);
                      closeSearch();
                    }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 active:scale-[0.99] transition-transform"
                  >
                    <p className="text-sm font-bold text-gray-900">{suggestion.label}</p>
                    {suggestion.subtitle && (
                      <p className="text-xs text-gray-500">{suggestion.subtitle}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={closeSearch}
              className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 py-1"
            >
              Done
            </button>
          </div>
        )}

        {showResultsCount && (
          <p className="text-center text-xs text-gray-500">
            {resultsCount} provider{resultsCount !== 1 ? 's' : ''} found
          </p>
        )}
      </div>
    </div>
  );
}
