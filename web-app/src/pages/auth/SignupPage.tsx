import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ROUTES } from '../../config/constants';
import { AvilaPlatformsLogo } from '../../assets';
import { isValidE164Phone } from '../../utils/phoneE164';

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formData, setFormData] = useState<SignupForm>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  /** Prefill phone after phone OTP verified with no account yet (e.g. from AuthPage). */
  useEffect(() => {
    const pending = sessionStorage.getItem('avilaplatforms_pending_signup_phone');
    if (pending?.trim()) {
      setFormData((prev) => ({ ...prev, phoneNumber: pending.trim() }));
      sessionStorage.removeItem('avilaplatforms_pending_signup_phone');
    }
  }, []);
  
  // Password strength checker
  const checkPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const getPasswordStrengthText = (strength: number): string => {
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength <= 3) return 'Good';
    if (strength <= 4) return 'Strong';
    return 'Very Strong';
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength <= 1) return 'text-red-600';
    if (strength <= 2) return 'text-orange-500';
    if (strength <= 3) return 'text-yellow-600';
    if (strength <= 4) return 'text-blue-600';
    return 'text-green-600';
  };

  const getPasswordStrengthBarColor = (strength: number, level: number): string => {
    if (level > strength) return 'bg-gray-200';
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 2) return 'bg-orange-500';
    if (strength <= 3) return 'bg-yellow-500';
    if (strength <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(formData.password));
  }, [formData.password]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear specific validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (error) setError(null);
  };

  const isValidEmail = (email: string): boolean => {
    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return false;
    
    // Whitelist of valid TLDs
    const validTLDs = [
      // Generic TLDs
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
      // Popular new TLDs
      'io', 'co', 'app', 'dev', 'tech', 'ai', 'me', 'tv', 'cc', 'xyz', 'online', 'site', 'web', 'cloud', 'email',
      // Country code TLDs
      'us', 'uk', 'ca', 'au', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at', 'jp', 'cn', 'kr', 'in', 'br', 'mx', 
      'ar', 'cl', 'ru', 'pl', 'cz', 'se', 'no', 'dk', 'fi', 'ie', 'nz', 'sg', 'hk', 'tw', 'th', 'ph', 'my', 'id',
      'za', 'ng', 'ke', 'eg', 'il', 'ae', 'sa', 'pk', 'bd', 'vn', 'ua', 'gr', 'pt', 'hu', 'ro', 'bg', 'hr', 'sk',
      // Other common TLDs
      'mobi', 'asia', 'jobs', 'museum', 'travel', 'coop', 'aero', 'cat', 'post',
      // Company/brand TLDs
      'google', 'amazon', 'apple', 'microsoft', 'yahoo', 'gmail'
    ];
    
    const tld = email.split('.').pop()?.toLowerCase();
    if (!tld || !validTLDs.includes(tld)) return false;
    
    return true;
  };

  // Check if email has a valid domain (any email allowed for testing)
  const isUniversityEmail = (email: string): boolean => {
    // Allow any email domain for testing purposes
    return isValidEmail(email);
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    const phone = formData.phoneNumber.trim();
    if (phone && !isValidE164Phone(phone)) {
      errors.phoneNumber = 'Use E.164 format with country code (e.g. +14155552671)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = 
    formData.email.trim() !== '' &&
    isValidEmail(formData.email) &&
    isUniversityEmail(formData.email) &&
    formData.password.length >= 8 &&
    formData.password === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signup({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email,
        password: formData.password,
        user_type: 'student', // All users start as consumers; barber applications are separate
        phoneNumber: formData.phoneNumber.trim() || undefined,
      });
      
      toast.success('Verification email sent! Please check your inbox.');
      
      // If in auto-verify mode (development), show the code
      if (result.verificationCode) {
        toast.success(`Dev Mode - Code: ${result.verificationCode}`, { duration: 10000 });
      }
      
      // Redirect to email verification page
      navigate('/web/verify-email');
    } catch (err: any) {
      const statusCode = err.response?.status;
      let errorMessage: string;
      
      if (statusCode === 429 || err.isRateLimitError) {
        errorMessage = 'Rate limit reached. Please wait a moment and reload the page.';
      } else {
        errorMessage = err.response?.data?.message || err.message || 'Signup failed. Please try again.';
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-[100dvh] flex items-center justify-center py-12 px-4"
      style={{ backgroundColor: '#022b19' }}
    >
      <div className="max-w-md w-full">
        {/* Header - Logo & Title */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Link to="/" className="hover:opacity-80 active:scale-95 transition-all duration-150">
            <img 
              src={AvilaPlatformsLogo} 
              alt="AvilaPlatforms Logo" 
              className="h-16 w-auto mb-4"
            />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create Account
          </h1>
          <p className="text-gray-300">Join AvilaPlatforms today</p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl p-8"
          style={{ maxWidth: '440px', margin: '0 auto' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* First name (optional) */}
              <div className="relative">
                <label 
                  htmlFor="firstName" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  First name (optional)
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    validationErrors.firstName ? 'border-red-400 focus:border-red-500' : 'border-gray-400 focus:border-gray-900'
                  }`}
                  placeholder="John"
                />
                {validationErrors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.firstName}</p>
                )}
              </div>

              {/* Last name (optional) */}
              <div className="relative">
                <label 
                  htmlFor="lastName" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Last name (optional)
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    validationErrors.lastName ? 'border-red-400 focus:border-red-500' : 'border-gray-400 focus:border-gray-900'
                  }`}
                  placeholder="Doe"
                />
                {validationErrors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="relative">
              <label 
                htmlFor="email" 
                className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    validationErrors.email ? 'border-red-400 focus:border-red-500' : 
                    (formData.email && isUniversityEmail(formData.email)) ? 'border-green-400 focus:border-green-500' :
                    'border-gray-400 focus:border-gray-900'
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {/* Email validation indicator */}
                {formData.email && (
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    {isValidEmail(formData.email) ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {validationErrors.email && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">We'll send a verification code to this email</p>
            </div>

            {/* Phone (optional) */}
            <div className="relative">
              <label
                htmlFor="phoneNumber"
                className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
              >
                Mobile phone (optional)
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                  validationErrors.phoneNumber ? 'border-red-400 focus:border-red-500' : 'border-gray-400 focus:border-gray-900'
                }`}
                placeholder="+14155552671"
                autoComplete="tel"
              />
              {validationErrors.phoneNumber && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.phoneNumber}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">Include country code (E.164). You can add this later instead.</p>
            </div>

            {/* Password Field */}
            <div className="relative">
              <label 
                htmlFor="password" 
                className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
              >
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                  validationErrors.password ? 'border-red-400 focus:border-red-500' : 'border-gray-400 focus:border-gray-900'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              {validationErrors.password && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
              )}
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Password strength:</span>
                    <span className={getPasswordStrengthColor(passwordStrength)}>
                      {getPasswordStrengthText(passwordStrength)}
                    </span>
                  </div>
                  <div className="mt-1 flex space-x-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                          getPasswordStrengthBarColor(passwordStrength, level)
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <label 
                htmlFor="confirmPassword" 
                className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
              >
                Confirm Password
              </label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                  validationErrors.confirmPassword || (formData.confirmPassword && formData.password !== formData.confirmPassword)
                    ? 'border-red-400 focus:border-red-500' 
                    : 'border-gray-400 focus:border-gray-900'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="flex items-center gap-1 mt-1">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircle size={14} className="text-green-500" />
                      <span className="text-green-600 text-xs">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-red-600 text-xs">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-primary-50/80 p-4 text-sm text-gray-700">
              <p>
                We’ll email you a verification code. <strong>No account is created yet.</strong> On the next
                screen you’ll read and accept the{' '}
                <Link to="/web/terms" className="text-primary-600 font-medium underline hover:text-black">
                  Terms of Service
                </Link>{' '}
                to finish signing up.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-800 font-medium text-sm">Sign Up Failed</p>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                isFormValid && !isLoading
                  ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Footer Links */}
          <div className="text-center space-y-4">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link 
                to={ROUTES.LOGIN} 
                className="text-primary-500 hover:text-gray-900 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>

            {/* Support Link */}
            <p className="text-gray-500 text-sm">
              Need help?{' '}
              <a 
                href="mailto:avilaplatformshelp@gmail.com"
                className="text-primary-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
              >
                <Mail size={14} />
                Contact Support
              </a>
            </p>

            {/* Terms */}
            <p className="text-gray-400 text-xs">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-emerald-600 hover:text-emerald-700 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-emerald-600 hover:text-emerald-700 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Back to Landing */}
        <div className="text-center mt-6">
          <Link 
            to="/"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Back to AvilaPlatforms
          </Link>
        </div>
      </div>

    </div>
  );
}
