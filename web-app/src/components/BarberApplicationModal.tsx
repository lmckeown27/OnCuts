import { useState, useEffect } from 'react';
import { X, Scissors, Camera, Clock, Award, CheckCircle, AlertCircle, Check } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { barberApplicationService } from '../services/barber-application.service';
import { SERVICE_TYPES } from '../config/services';
import toast from 'react-hot-toast';

interface BarberApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

interface ApplicationForm {
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
  additionalNotes: string;
}

export default function BarberApplicationModal({ isOpen, onClose, onSubmitSuccess }: BarberApplicationModalProps) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  
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

  const [form, setForm] = useState<ApplicationForm>({
    yearsExperience: '',
    hasLicense: false,
    licenseNumber: '',
    specialties: [],
    portfolioDescription: '',
    whyBeBarber: '',
    availableHours: '',
    needsTools: false,
    toolsNeeded: '',
    socialMedia: '',
    additionalNotes: ''
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
      const result = await barberApplicationService.submit({
        yearsExperience: form.yearsExperience,
        hasLicense: form.hasLicense,
        licenseNumber: form.licenseNumber || undefined,
        specialties: form.specialties,
        hasOwnTools: !form.needsTools,
        toolsNeeded: form.needsTools ? form.toolsNeeded : undefined,
        availableHours: form.availableHours,
        whyBeBarber: form.whyBeBarber,
        portfolioDescription: form.portfolioDescription || undefined,
        socialMedia: form.socialMedia || undefined,
        additionalNotes: form.additionalNotes || undefined
      });
      
      // API returns { applicationId, status, submittedAt } on success
      if (result && result.applicationId) {
        setSubmitted(true);
        toast.success('Application submitted successfully!');
        
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

  const canProceedStep1 = form.yearsExperience && form.specialties.length > 0;
  const canProceedStep2 = form.whyBeBarber.length >= 50 && form.availableHours;
  const canSubmit = canProceedStep1 && canProceedStep2;

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-150 ease-out ${
        isVisible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-150 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 flex items-center justify-center relative">
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {submitted ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Application Submitted!</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Thank you for applying to become a CampusCut barber. Our campus manager will review your application and reach out to schedule an interview within 2-3 business days.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-blue-800">What's Next?</p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• Campus manager reviews your application</li>
                      <li>• You'll receive an email to schedule an interview</li>
                      <li>• Complete a brief skills demonstration</li>
                      <li>• Get onboarded as an official CampusCut barber!</li>
                    </ul>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="mt-8 px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : step === 1 ? (
            /* Step 1: Experience & Skills */
            <div className="space-y-6">
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
                <p className={`text-xs mt-1 ${form.whyBeBarber.length >= 50 ? 'text-green-600' : 'text-gray-500'}`}>
                  {form.whyBeBarber.length}/50 minimum characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  How many hours per week can you dedicate? *
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
                  Portfolio / Social Media (optional)
                </label>
                <input
                  type="text"
                  placeholder="Instagram handle or portfolio link"
                  value={form.socialMedia}
                  onChange={(e) => setForm({ ...form, socialMedia: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Share your work! This helps us see your style and skill level.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Anything else you'd like us to know? (optional)
                </label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                />
              </div>
            </div>
          ) : (
            /* Step 3: Review */
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Review Your Application</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Applicant</p>
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Experience</p>
                  <p className="font-medium">
                    {form.yearsExperience === 'less-than-1' ? 'Less than 1 year' :
                     form.yearsExperience === '1-2' ? '1-2 years' :
                     form.yearsExperience === '3-5' ? '3-5 years' : '5+ years'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {form.hasLicense ? `Licensed barber${form.licenseNumber ? ` (#${form.licenseNumber})` : ''}` : 'Not yet licensed'}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-1">
                    {form.specialties.map((s) => (
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> By submitting this application, you agree to be contacted by a CampusCut campus manager for an interview. Your application will be reviewed within 2-3 business days.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
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
        )}
      </div>
    </div>
  );
}

