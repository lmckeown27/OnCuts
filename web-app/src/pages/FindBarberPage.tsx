/**
 * Find Barber Page
 * 
 * Multi-step questionnaire to help users find the right barber.
 * Steps:
 * 1. Select your university
 * 2. What service do you need?
 * 3. Navigate to consumer page with filters applied
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Scissors, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Sparkles
} from 'lucide-react';
import UniversitySelector from '../components/UniversitySelector';
import type { University } from '../data/universities';
import { SPECIALTY_OPTIONS } from '../config/services';
import { CampusCutLogo } from '@assets';

// Storage keys
const UNIVERSITY_STORAGE_KEY = 'campuscut_selected_university';
const FILTER_STORAGE_KEY = 'campuscut_filter_criteria';

type Step = 'university' | 'service';

export default function FindBarberPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('university');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Load saved university on mount
  useEffect(() => {
    const saved = localStorage.getItem(UNIVERSITY_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedUniversity(parsed);
      } catch (e) {
        localStorage.removeItem(UNIVERSITY_STORAGE_KEY);
      }
    }
  }, []);

  // Handle university selection
  const handleUniversitySelect = (university: University) => {
    setSelectedUniversity(university);
    localStorage.setItem(UNIVERSITY_STORAGE_KEY, JSON.stringify(university));
  };

  // Handle service selection
  const handleServiceSelect = (service: string) => {
    setSelectedService(prev => prev === service ? null : service);
  };

  // Navigate to next step with animation
  const goToNextStep = () => {
    if (currentStep === 'university' && selectedUniversity) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep('service');
        setIsAnimating(false);
      }, 200);
    } else if (currentStep === 'service') {
      // Save filters and navigate to consumer page
      const filters = {
        serviceType: selectedService,
        date: null,
        time: null,
        location: null,
        locationDetails: null,
      };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
      navigate('/web/consumer');
    }
  };

  // Navigate to previous step
  const goToPreviousStep = () => {
    if (currentStep === 'service') {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep('university');
        setIsAnimating(false);
      }, 200);
    } else {
      navigate('/');
    }
  };

  // Skip service selection
  const skipServiceSelection = () => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      serviceType: null,
      date: null,
      time: null,
      location: null,
      locationDetails: null,
    }));
    navigate('/web/consumer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={goToPreviousStep}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <img 
            src={CampusCutLogo} 
            alt="CampusCut" 
            className="h-8"
          />
          
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              currentStep === 'university' ? 'bg-primary-500' : 'bg-primary-200'
            }`} />
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              currentStep === 'service' ? 'bg-primary-500' : 'bg-gray-200'
            }`} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className={`transition-all duration-200 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
          
          {/* Step 1: University Selection */}
          {currentStep === 'university' && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-10 h-10 text-primary-600" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  Find Your Campus Barbers
                </h1>
                <p className="text-lg text-gray-600">
                  What university do you attend?
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
                    onClick={goToNextStep}
                    className="flex items-center gap-3 px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Service Selection */}
          {currentStep === 'service' && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Scissors className="w-10 h-10 text-primary-600" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  What do you need?
                </h1>
                <p className="text-lg text-gray-600">
                  Select a service (optional)
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {SPECIALTY_OPTIONS.map((service) => (
                    <button
                      key={service}
                      onClick={() => handleServiceSelect(service)}
                      className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all text-left ${
                        selectedService === service
                          ? 'border-primary-500 bg-primary-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {selectedService === service && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-5 h-5 text-primary-600" />
                        </div>
                      )}
                      <Sparkles className={`w-6 h-6 mb-2 ${
                        selectedService === service ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                      <p className={`font-medium text-sm sm:text-base ${
                        selectedService === service ? 'text-primary-900' : 'text-gray-700'
                      }`}>
                        {service}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={goToNextStep}
                  className="flex items-center gap-3 px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Find Barbers
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={skipServiceSelection}
                  className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Skip, show all barbers
                </button>
              </div>
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
    </div>
  );
}

