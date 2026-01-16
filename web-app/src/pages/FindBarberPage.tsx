/**
 * Find Barber Page
 * 
 * Simple page to select your university and find nearby barbers.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  ArrowLeft
} from 'lucide-react';
import UniversitySelector from '../components/UniversitySelector';
import type { University } from '../data/universities';
import { CampusCutLogo } from '@assets';
import PullToRefresh from '../components/PullToRefresh';

// Storage key
const UNIVERSITY_STORAGE_KEY = 'campuscut_selected_university';

export default function FindBarberPage() {
  const navigate = useNavigate();
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);

  // Always start with empty search bar - don't load saved university
  // User must select their campus each time they visit this page

  // Handle university selection
  const handleUniversitySelect = (university: University | null) => {
    setSelectedUniversity(university);
    if (university) {
      localStorage.setItem(UNIVERSITY_STORAGE_KEY, JSON.stringify(university));
    } else {
      localStorage.removeItem(UNIVERSITY_STORAGE_KEY);
    }
  };

  // Navigate to consumer page
  const goToConsumerPage = () => {
    if (selectedUniversity) {
      navigate('/web/consumer');
    }
  };

  // Navigate back to landing
  const goBack = () => {
    navigate('/');
  };

  return (
    <PullToRefresh onRefresh={() => window.location.reload()} className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between relative">
          <button 
            onClick={goBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors z-10"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          {/* Centered Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img 
              src={CampusCutLogo} 
              alt="CampusCut" 
              className="h-10 sm:h-12 w-auto"
            />
          </div>
          
          {/* Sign In Button - always visible */}
          <button
            onClick={() => navigate('/web')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors z-10"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Find Your Campus Barbers
            </h1>
            <p className="text-lg text-gray-600">
              What campus are you at?
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <UniversitySelector
              value={selectedUniversity}
              onChange={handleUniversitySelect}
              placeholder="Search for your university..."
            />
          </div>

          {selectedUniversity && (
            <div className="flex justify-center">
              <button
                onClick={goToConsumerPage}
                className="flex items-center gap-3 px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                Find Barbers
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer Note */}
      <footer className="max-w-2xl mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-gray-400">
          {selectedUniversity 
            ? `Searching barbers near ${selectedUniversity.shortName || selectedUniversity.name}`
            : 'Select your university to get started'
          }
        </p>
      </footer>
    </PullToRefresh>
  );
}
