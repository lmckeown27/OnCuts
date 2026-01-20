/**
 * UniversitySelector Component
 * 
 * Searchable dropdown for selecting a US university.
 * Features:
 * - Type-ahead search with autocomplete
 * - Shows university name, city, and state
 * - Keyboard navigation support
 * - Mobile-friendly touch targets
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, X, GraduationCap } from 'lucide-react';
import { searchUniversities, type University } from '../data/universities';

interface UniversitySelectorProps {
  value: University | null;
  onChange: (university: University | null) => void;
  placeholder?: string;
  className?: string;
}

export default function UniversitySelector({
  value,
  onChange,
  placeholder = "Search for your university...",
  className = "",
}: UniversitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<University[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search universities when query changes
  useEffect(() => {
    if (searchQuery.length >= 1) {
      const matches = searchUniversities(searchQuery, 8);
      setResults(matches);
      setHighlightedIndex(0);
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
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
  }, [isOpen, results, highlightedIndex]);

  // Handle selection
  const handleSelect = (university: University) => {
    onChange(university);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null); // Notify parent to clear selection
    setSearchQuery('');
    setResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div
        className={`relative flex items-center bg-white border-2 rounded-xl transition-all ${
          isOpen ? 'border-primary-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={value ? `${value.shortName || value.name} — ${value.city}, ${value.state}` : searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!value) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 pl-4 pr-3 py-4 text-gray-900 placeholder-gray-400 bg-transparent outline-none text-lg"
          readOnly={!!value}
          onClick={() => {
            if (value) {
              // Clear selection and allow re-search
              onChange(null);
              setSearchQuery('');
              setIsOpen(true);
              // Focus will happen automatically
            }
          }}
        />
        
        {value ? (
          <button
            onClick={handleClear}
            className="p-2 mr-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <div className="pr-4 text-gray-400">
            <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto"
        >
          {searchQuery.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Start typing to search</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No universities found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <ul className="py-2">
              {results.map((university, index) => (
                <li key={university.id}>
                  <button
                    onClick={() => handleSelect(university)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      index === highlightedIndex
                        ? 'bg-primary-50 text-primary-900'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {university.shortName ? (
                        <>
                          {university.shortName}
                          <span className="font-normal text-gray-500"> - {university.name}</span>
                        </>
                      ) : (
                        university.name
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{university.city}, {university.state}</p>
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

