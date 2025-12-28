import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import TabChairLogo from '../assets/logos/Tab_Chair.webp';
import { useViewport } from '../hooks/useViewport';

type AuthMode = 'login' | 'signup';

interface LoginForm {
  email: string;
  password: string;
}

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Login form state
  const [loginData, setLoginData] = useState<LoginForm>({
    email: '',
    password: ''
  });

  // Signup form state
  const [signupData, setSignupData] = useState<SignupForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

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

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if email is valid (any email allowed for testing)
  const isUniversityEmail = (email: string): boolean => {
    // Allow any email domain for testing purposes
    return isValidEmail(email);
  };

  const isLoginFormValid = loginData.email.trim() !== '' && 
    loginData.password.trim() !== '' &&
    isValidEmail(loginData.email);

  const isSignupFormValid = 
    signupData.firstName.trim() !== '' &&
    signupData.lastName.trim() !== '' &&
    signupData.email.trim() !== '' &&
    isValidEmail(signupData.email) &&
    signupData.password.length >= 8 &&
    signupData.password === signupData.confirmPassword;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(loginData.email, loginData.password);
      toast.success('Login successful!');
      
      // Redirect admin to role selection page
      if (result.isAdmin) {
        navigate('/web/admin-role-select');
      } else {
        navigate('/web/consumer');
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.error?.code;
      let errorMessage: string;
      
      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        errorMessage = 'Account not in the system. Please sign up first.';
      } else if (errorCode === 'INVALID_PASSWORD') {
        errorMessage = 'Incorrect password. Please try again.';
      } else {
        errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Login failed. Please try again.';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const errors: {[key: string]: string} = {};
    if (!signupData.firstName.trim()) errors.firstName = 'First name is required';
    if (!signupData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!signupData.email.trim()) errors.email = 'Email is required';
    else if (!isValidEmail(signupData.email)) errors.email = 'Invalid email address';
    if (!signupData.password) errors.password = 'Password is required';
    else if (signupData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (signupData.password !== signupData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signup({
        first_name: signupData.firstName,
        last_name: signupData.lastName,
        email: signupData.email,
        password: signupData.password,
        user_type: 'student', // All users start as consumers; barber applications are separate
      });
      
      toast.success('Verification email sent! Please check your inbox.');
      
      // If in auto-verify mode (development), show the code
      if (result.verificationCode) {
        toast.success(`Dev Mode - Code: ${result.verificationCode}`, { duration: 10000 });
      }
      
      // Redirect to email verification page
      navigate('/web/verify-email');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Signup failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setValidationErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Viewport detection
  const { isMobile, isMobilePortrait } = useViewport();
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center py-6 sm:py-12 px-3 sm:px-4"
      style={{ backgroundColor: '#022b19' }}
    >
      <div className="max-w-md w-full">
        {/* Header - Logo & Title */}
        <div className="flex flex-col items-center justify-center mb-4 sm:mb-8">
          <Link to="/" className="hover:opacity-80 active:scale-95 transition-all duration-150">
            <img 
              src={TabChairLogo} 
              alt="CampusCut Logo" 
              className="h-12 sm:h-16 w-auto mb-2 sm:mb-4"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm sm:text-base text-gray-300">
            {mode === 'login' ? 'Access your CampusCut account' : 'Join CampusCut today'}
          </p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8"
          style={{ maxWidth: '440px', margin: '0 auto' }}
        >
          {/* Tab Switcher */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="relative">
                <label 
                  htmlFor="login-email" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="login-email"
                    name="email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                      loginData.email && isValidEmail(loginData.email) 
                        ? 'border-green-400 focus:border-green-500' 
                        : 'border-primary-400 focus:border-primary-500'
                    }`}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {loginData.email && (
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      {isValidEmail(loginData.email) ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <label 
                  htmlFor="login-password" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  className="w-full pt-5 pb-3 px-4 pr-12 border-2 border-primary-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 focus:border-primary-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={!isLoginFormValid || isLoading}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  isLoginFormValid && !isLoading
                    ? 'bg-primary-400 hover:bg-primary-500 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Forgot Password */}
              <div className="text-center">
                <button 
                  type="button"
                  className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label 
                    htmlFor="firstName" 
                    className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={signupData.firstName}
                    onChange={handleSignupChange}
                    className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                      validationErrors.firstName ? 'border-red-400' : 'border-primary-400 focus:border-primary-500'
                    }`}
                    placeholder="John"
                  />
                </div>
                <div className="relative">
                  <label 
                    htmlFor="lastName" 
                    className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={signupData.lastName}
                    onChange={handleSignupChange}
                    className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                      validationErrors.lastName ? 'border-red-400' : 'border-primary-400 focus:border-primary-500'
                    }`}
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="relative">
                <label 
                  htmlFor="signup-email" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="signup-email"
                    name="email"
                    value={signupData.email}
                    onChange={handleSignupChange}
                    className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                      validationErrors.email ? 'border-red-400' : 
                      (signupData.email && isValidEmail(signupData.email)) ? 'border-green-400 focus:border-green-500' :
                      'border-primary-400 focus:border-primary-500'
                    }`}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {signupData.email && (
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      {isValidEmail(signupData.email) ? (
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
              </div>

              {/* Password Field */}
              <div className="relative">
                <label 
                  htmlFor="signup-password" 
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="signup-password"
                  name="password"
                  value={signupData.password}
                  onChange={handleSignupChange}
                  className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    validationErrors.password ? 'border-red-400' : 'border-primary-400 focus:border-primary-500'
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
                
                {/* Password Strength Indicator */}
                {signupData.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Strength:</span>
                      <span className={getPasswordStrengthColor(passwordStrength)}>
                        {getPasswordStrengthText(passwordStrength)}
                      </span>
                    </div>
                    <div className="mt-1 flex space-x-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
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
                  value={signupData.confirmPassword}
                  onChange={handleSignupChange}
                  className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    validationErrors.confirmPassword || (signupData.confirmPassword && signupData.password !== signupData.confirmPassword)
                      ? 'border-red-400' 
                      : 'border-primary-400 focus:border-primary-500'
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
                {signupData.confirmPassword && (
                  <div className="flex items-center gap-1 mt-1">
                    {signupData.password === signupData.confirmPassword ? (
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

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Signup Button */}
              <button
                type="submit"
                disabled={!isSignupFormValid || isLoading}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  isSignupFormValid && !isLoading
                    ? 'bg-primary-400 hover:bg-primary-500 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
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
          )}

          {/* Footer */}
          <div className="mt-6 text-center space-y-3">
            <p className="text-gray-500 text-sm">
              Need help?{' '}
              <a 
                href="mailto:campuscuthelp@gmail.com"
                className="text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
              >
                <Mail size={14} />
                Contact Support
              </a>
            </p>

            <p className="text-gray-400 text-xs">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary-500 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary-500 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Back to Landing */}
        <div className="text-center mt-6">
          <Link 
            to="/"
            className="text-gray-400 hover:text-white text-sm transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to CampusCut
          </Link>
        </div>
      </div>
    </div>
  );
}

