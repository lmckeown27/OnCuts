import { useState, useEffect, useRef } from 'react';
import { X, Scissors, Camera, Clock, Award, CheckCircle, Check, MapPin, ChevronDown, Search, Mail, ClockIcon, UserX } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { barberApplicationService, BarberApplication, GuestBarberApplicationForm } from '../services/barber-application.service';
import { SERVICE_TYPES } from '../config/services';
import campusService from '../services/campus.service';
import barberService from '../services/barber.service';
import type { Campus } from '../types';
import toast from 'react-hot-toast';

interface BarberApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
  /** When true, shows email field and uses guest submission endpoint (no auth required) */
  guestMode?: boolean;
}

interface ApplicationForm {
  email: string; // Added for guest mode
  campusId: string;
  yearsExperience: string;
  hasLicense: boolean;
  licenseNumber: string;
  specialties: string[];
  portfolioDescription: string;
  whyBeBarber: string;
  availableHours: string;
  needsTools: boolean;
  toolsNeeded: string;
  socialMedia: string;
}

export default function BarberApplicationModal({ isOpen, onClose, onSubmitSuccess, guestMode = false }: BarberApplicationModalProps) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successPopupVisible, setSuccessPopupVisible] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const campusSelectorRef = useRef<HTMLDivElement>(null);
  const [existingApplication, setExistingApplication] = useState<BarberApplication | null>(null);
  const [checkingExistingApplication, setCheckingExistingApplication] = useState(true);
  const [isDemotedBarber, setIsDemotedBarber] = useState(false);
  
  // Handle open/close animations and body scroll lock
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
      // Small delay to ensure initial invisible state renders first
      const openTimer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(openTimer);
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
      // Wait for animation to complete before unmounting
      const closeTimer = setTimeout(() => {
        setShouldRender(false);
      }, 150);
      return () => clearTimeout(closeTimer);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 150);
  };

  // Check for existing application, demoted status, and load campuses on mount
  useEffect(() => {
    const checkExistingApplicationAndDemotedStatus = async () => {
      try {
        setCheckingExistingApplication(true);
        
        // First, check if user is a demoted barber (has barber record with isActive = false)
        if (user?.id) {
          try {
            const barberProfile = await barberService.getBarberByUserId(user.id);
            if (barberProfile && barberProfile.is_active === false) {
              setIsDemotedBarber(true);
              setExistingApplication(null);
              return; // Don't check for application if demoted
            }
          } catch {
            // No barber profile found, continue to check application
          }
        }
        
        // Check for existing application
        const application = await barberApplicationService.getMyApplication();
        setExistingApplication(application);
      } catch (error) {
        console.error('Failed to check existing application:', error);
        // If error, assume no existing application and let user proceed
        setExistingApplication(null);
      } finally {
        setCheckingExistingApplication(false);
      }
    };

    const loadCampuses = async () => {
      try {
        setLoadingCampuses(true);
        const campusList = await campusService.getCampuses();
        setCampuses(campusList);
      } catch (error) {
        console.error('Failed to load campuses:', error);
        toast.error('Failed to load campuses');
      } finally {
        setLoadingCampuses(false);
      }
    };
    
    if (isOpen) {
      // Skip existing application check for guest mode (no user to check)
      if (!guestMode) {
        checkExistingApplicationAndDemotedStatus();
      } else {
        setCheckingExistingApplication(false);
        setExistingApplication(null);
      }
      loadCampuses();
    }
  }, [isOpen, user?.id, guestMode]);

  const [form, setForm] = useState<ApplicationForm>({
    email: '',
    campusId: '',
    yearsExperience: '',
    hasLicense: false,
    licenseNumber: '',
    specialties: [],
    portfolioDescription: '',
    whyBeBarber: '',
    availableHours: '',
    needsTools: false,
    toolsNeeded: '',
    socialMedia: ''
  });

  const handleSpecialtyToggle = (specialty: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      let result: { applicationId?: string; id?: string; status?: string; submittedAt?: string; createdAt?: string };
      
      if (guestMode) {
        // Guest mode - use guest endpoint (no auth required)
        const guestResult = await barberApplicationService.submitGuestApplication({
          email: form.email,
          campusId: form.campusId,
          yearsExperience: form.yearsExperience,
          hasLicense: form.hasLicense,
          licenseNumber: form.licenseNumber || undefined,
          specialties: form.specialties,
          hasOwnTools: !form.needsTools,
          toolsNeeded: form.needsTools ? form.toolsNeeded : undefined,
          availableHours: form.availableHours,
          whyBeBarber: form.whyBeBarber,
          portfolioDescription: form.portfolioDescription || undefined,
          socialMedia: form.socialMedia || undefined
        });
        result = { applicationId: guestResult.id, status: guestResult.status, submittedAt: guestResult.createdAt };
      } else {
        // Authenticated mode - use regular endpoint
        result = await barberApplicationService.submit({
          campusId: form.campusId,
          yearsExperience: form.yearsExperience,
          hasLicense: form.hasLicense,
          licenseNumber: form.licenseNumber || undefined,
          specialties: form.specialties,
          hasOwnTools: !form.needsTools,
          toolsNeeded: form.needsTools ? form.toolsNeeded : undefined,
          availableHours: form.availableHours,
          whyBeBarber: form.whyBeBarber,
          portfolioDescription: form.portfolioDescription || undefined,
          socialMedia: form.socialMedia || undefined
        });
      }
      
      // API returns { applicationId, status, submittedAt } on success
      if (result && (result.applicationId || result.id)) {
        // Close the application modal smoothly
        setIsVisible(false);
        
        // After close animation, show success popup
        setTimeout(() => {
          setShouldRender(false);
          setShowSuccessPopup(true);
          setTimeout(() => setSuccessPopupVisible(true), 10);
        }, 150);
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        throw new Error('Submission failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to submit application. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Email validation helper
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  // In guest mode, email is required for step 1
  const canProceedStep1 = form.campusId && form.yearsExperience && form.specialties.length > 0 && 
    (!guestMode || (form.email && isValidEmail(form.email)));
  const canProceedStep2 = form.whyBeBarber.trim().length > 0 && form.availableHours;
  const canSubmit = canProceedStep1 && canProceedStep2;

  const handleCloseSuccessPopup = () => {
    setSuccessPopupVisible(false);
    setTimeout(() => {
      setShowSuccessPopup(false);
      document.body.style.overflow = '';
      onClose();
    }, 150);
  };

  // Success popup
  if (showSuccessPopup) {
    return (
      <div 
        className={`fixed inset-0 min-h-[100dvh] bg-black/50 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${successPopupVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleCloseSuccessPopup}
      >
        <div 
          className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transition-all duration-150 ease-out
            ${successPopupVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">Application Submitted!</h3>
          <p className="text-gray-600 mb-6">
            Your application has been submitted. A campus manager will be in touch with you shortly.
          </p>
          <button
            onClick={handleCloseSuccessPopup}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  if (!shouldRender) return null;

  // Show loading while checking for existing application
  if (checkingExistingApplication) {
    return (
      <div 
        className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
          isVisible ? 'bg-black/50' : 'bg-black/0'
        }`}
        onClick={handleClose}
      >
        <div 
          className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transition-all duration-150 ease-out ${
            isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show demoted barber status view
  if (isDemotedBarber) {
    return (
      <div 
        className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
          isVisible ? 'bg-black/50' : 'bg-black/0'
        }`}
        onClick={handleClose}
      >
        <div 
          className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-150 ease-out ${
            isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 flex items-center justify-center relative">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-xl font-bold text-white">Account Status</h2>
            </div>
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <UserX className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-3">Barber Access Removed</h3>
            <p className="text-gray-600 mb-6">
              Your barber privileges have been removed by the campus manager. You no longer have access to the barber dashboard or booking features.
            </p>

            {/* Info box */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600">
                <strong>What does this mean?</strong>
              </p>
              <ul className="text-sm text-gray-500 mt-2 space-y-1 list-disc list-inside">
                <li>You can no longer receive booking requests</li>
                <li>Your barber profile is no longer visible to consumers</li>
                <li>You can still use the platform as a consumer</li>
              </ul>
            </div>

            {/* Support section */}
            <div className="border-t pt-5">
              <p className="text-sm text-gray-500 mb-2">
                Think this was a mistake? Contact us:
              </p>
              <a 
                href="mailto:campuscuthelp@gmail.com?subject=Barber Access Removed - Appeal"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                <Mail className="w-4 h-4" />
                campuscuthelp@gmail.com
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={handleClose}
              className="w-full px-6 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show existing application status view
  if (existingApplication) {
    const statusMessages: Record<string, { title: string; description: string; color: string }> = {
      pending: {
        title: 'Application Under Review',
        description: 'Your application has been submitted and is currently being reviewed by the campus manager. They will get back to you once they\'ve reviewed your application.',
        color: 'amber'
      },
      under_review: {
        title: 'Application Under Review',
        description: 'Your application is actively being reviewed by the campus manager. They will reach out to you soon with next steps.',
        color: 'blue'
      },
      interview_scheduled: {
        title: 'Interview Scheduled',
        description: 'Great news! An interview has been scheduled. Please check your email for details.',
        color: 'green'
      },
      approved: {
        title: 'Application Approved',
        description: 'Congratulations! Your application has been approved. You should have received an email with next steps.',
        color: 'green'
      },
      rejected: {
        title: 'Application Not Approved',
        description: 'Unfortunately, your application was not approved at this time. You can submit a new application below.',
        color: 'red'
      }
    };

    const status = statusMessages[existingApplication.status] || statusMessages.pending;
    const colorClasses = {
      amber: 'bg-amber-100 text-amber-600',
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      red: 'bg-red-100 text-red-600'
    };

    return (
      <div 
        className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
          isVisible ? 'bg-black/50' : 'bg-black/0'
        }`}
        onClick={handleClose}
      >
        <div 
          className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-150 ease-out ${
            isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 flex items-center justify-center relative">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 bg-white/20 rounded-lg mb-2">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Application Status</h2>
            </div>
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <div className={`w-16 h-16 ${colorClasses[status.color as keyof typeof colorClasses]} rounded-full flex items-center justify-center mx-auto mb-5`}>
              {status.color === 'red' ? (
                <X className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-3">{status.title}</h3>
            <p className="text-gray-600 mb-6">
              {status.description}
            </p>

            {/* Submitted date */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Submitted On</p>
              <p className="font-medium text-gray-900">
                {new Date(existingApplication.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            {/* Support section */}
            <div className="border-t pt-5">
              <p className="text-sm text-gray-500 mb-2">
                Having issues or think your application wasn't submitted?
              </p>
              <a 
                href="mailto:campuscuthelp@gmail.com?subject=Barber Application Issue"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                <Mail className="w-4 h-4" />
                campuscuthelp@gmail.com
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            {existingApplication.status === 'rejected' ? (
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={() => setExistingApplication(null)}
                  className="flex-1 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Reapply
                </button>
              </div>
            ) : (
              <button
                onClick={handleClose}
                className="w-full px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85dvh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 flex items-center justify-center relative flex-shrink-0">
          <div className="flex flex-col items-center text-center">
            <div className="p-2 bg-white/20 rounded-lg mb-2">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Become a CampusCut Barber</h2>
            <p className="text-primary-100 text-sm">Apply to join our network of campus barbers</p>
          </div>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {step === 1 ? (
            /* Step 1: Campus Selection, Experience & Skills */
            <div className="space-y-6">
              {/* Email Field - Guest Mode Only */}
              {guestMode && (
                <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <Mail className="w-4 h-4 inline mr-2 text-primary-600" />
                    Your Email Address *
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    We'll use this to contact you about your application.
                  </p>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your.email@university.edu"
                    className="w-full px-4 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
                  />
                </div>
              )}

              {/* Campus Selection - First Question */}
              <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2 text-primary-600" />
                  Which campus do you want to cut at? *
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Your application will be sent to the campus manager at this location.
                </p>
                {loadingCampuses ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <span className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    Loading campuses...
                  </div>
                ) : (
                  <div className="relative" ref={campusSelectorRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={campusSearchQuery}
                        onChange={(e) => {
                          setCampusSearchQuery(e.target.value);
                          setShowCampusDropdown(true);
                        }}
                        onFocus={() => setShowCampusDropdown(true)}
                        onBlur={(e) => {
                          // Delay to allow click on dropdown items to register first
                          setTimeout(() => {
                            if (campusSelectorRef.current && !campusSelectorRef.current.contains(document.activeElement)) {
                              setShowCampusDropdown(false);
                              // Revert to selected campus name if no new selection
                              if (form.campusId) {
                                const selectedCampus = campuses.find(c => c.id === form.campusId);
                                setCampusSearchQuery(selectedCampus?.name || '');
                              } else {
                                setCampusSearchQuery('');
                              }
                            }
                          }, 150);
                        }}
                        placeholder="Search and select your campus..."
                        className="w-full pl-10 pr-10 py-3 border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
                      />
                      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform pointer-events-none ${showCampusDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Campus Dropdown */}
                    {showCampusDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[250px] overflow-y-auto overscroll-contain">
                        <div className="p-1">
                          {campuses
                            .filter(campus => 
                              campus.name.toLowerCase().includes(campusSearchQuery.toLowerCase())
                            )
                            .map(campus => (
                              <button
                                key={campus.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur from firing
                                  setForm({ ...form, campusId: campus.id });
                                  setCampusSearchQuery(campus.name);
                                  setShowCampusDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md hover:bg-primary-50 transition-colors ${
                                  form.campusId === campus.id ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-700'
                                }`}
                              >
                                {campus.name}
                              </button>
                            ))
                          }
                          {campuses.filter(campus => 
                            campus.name.toLowerCase().includes(campusSearchQuery.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              No campuses found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Experience and Tools - Side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Years of Experience *
                  </label>
                  <select
                    value={form.yearsExperience}
                    onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  >
                    <option value="">Select experience level</option>
                    <option value="less-than-1">Less than 1 year</option>
                    <option value="1-2">1-2 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5-plus">5+ years</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Do you need barber tools?
                  </label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={form.needsTools}
                        onChange={() => setForm({ ...form, needsTools: true })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!form.needsTools}
                        onChange={() => setForm({ ...form, needsTools: false, toolsNeeded: '' })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                  {form.needsTools && (
                    <input
                      type="text"
                      placeholder="What tools do you need?"
                      value={form.toolsNeeded}
                      onChange={(e) => setForm({ ...form, toolsNeeded: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Scissors className="w-4 h-4 inline mr-2" />
                  What services will you offer? * (Select all that apply)
                </label>
                <p className="text-xs text-gray-500 mb-3">These will be your specialties on your barber profile.</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {SERVICE_TYPES.map((service) => {
                    const isSelected = form.specialties.includes(service.name);
                    return (
                      <div
                        key={service.id}
                        onClick={() => handleSpecialtyToggle(service.name)}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary-400 bg-primary-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              isSelected
                                ? 'bg-primary-400 border-primary-400'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 text-sm">{service.name}</h4>
                              {service.description && (
                                <p className="text-xs text-gray-500">{service.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Base Price</p>
                            <p className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                              ${service.basePrice?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : step === 2 ? (
            /* Step 2: About You */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Why do you want to be a CampusCut barber? *
                </label>
                <textarea
                  value={form.whyBeBarber}
                  onChange={(e) => setForm({ ...form, whyBeBarber: e.target.value })}
                  placeholder="Tell us about your passion for barbering and why you'd be a great fit for CampusCut..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Hours per week? *
                  </label>
                  <select
                    value={form.availableHours}
                    onChange={(e) => setForm({ ...form, availableHours: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  >
                    <option value="">Select availability</option>
                    <option value="5-10">5-10 hours/week</option>
                    <option value="10-20">10-20 hours/week</option>
                    <option value="20-30">20-30 hours/week</option>
                    <option value="30-plus">30+ hours/week</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Camera className="w-4 h-4 inline mr-2" />
                    Social Media (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Instagram handle or link"
                    value={form.socialMedia}
                    onChange={(e) => setForm({ ...form, socialMedia: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Step 3: Review */
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Review Your Application</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {/* Show email - use form.email for guest mode, user.email for authenticated */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="font-medium">{guestMode ? form.email : user?.email}</p>
                </div>
                
                {/* Only show applicant name for authenticated users */}
                {!guestMode && user?.first_name && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Applicant</p>
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Campus</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-600" />
                    {(campuses || []).find(c => c.id === form.campusId)?.name || 'Not selected'}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Experience</p>
                  <p className="font-medium">
                    {form.yearsExperience === 'less-than-1' ? 'Less than 1 year' :
                     form.yearsExperience === '1-2' ? '1-2 years' :
                     form.yearsExperience === '3-5' ? '3-5 years' : '5+ years'}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-1">
                    {(form.specialties || []).map((s) => (
                      <span key={s} className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Availability</p>
                  <p className="font-medium">{form.availableHours} hours/week</p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Why CampusCut?</p>
                  <p className="text-gray-700 text-sm">{form.whyBeBarber}</p>
                </div>

                {form.socialMedia && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Portfolio/Social</p>
                    <p className="text-primary-600 text-sm">{form.socialMedia}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between flex-shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                className="px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Submit Application
                  </>
                )}
              </button>
            )}
          </div>
      </div>
    </div>
  );
}

