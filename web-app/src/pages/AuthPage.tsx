import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, XCircle, ArrowLeft, X /*, Phone */ } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import authService from '../services/auth.service';
import { TivelaPlatformsLogo } from '../assets';
import { useViewport } from '../hooks/useViewport';
import { isValidE164Phone, normalizeE164Phone } from '../utils/phoneE164';
import {
  isGoogleSignInConfigured,
  requestGoogleIdToken,
} from '../utils/googleSignIn';
import {
  LEGACY_PENDING_SIGNUP_PHONE_KEY,
  PENDING_SIGNUP_PHONE_KEY,
  readSessionStorageWithMigration,
  removeSessionStorageKeys,
} from '../utils/storageMigration';
import { isPaymentTakeoverDeferred } from '../store/deferredPaymentBookings';

type AuthMode = 'login' | 'signup';
type LoginChannel = 'email' | 'phone';
type SignupChannel = 'email' | 'phone';

interface LoginForm {
  email: string;
  password: string;
}

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect'); // For email links like ?redirect=/web/consumer/messages/123
  const { login, signup, loginWithPhone, loginWithGoogle, resendVerificationCode } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResendingCode, setIsResendingCode] = useState(false);
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
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });

  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  /** Sign-in with SMS (same API as Intera / iOS). */
  const [loginChannel, setLoginChannel] = useState<LoginChannel>('email');
  const [phoneLogin, setPhoneLogin] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);

  /** Sign up: email-only, or verify phone first then email + password. */
  const [signupChannel, setSignupChannel] = useState<SignupChannel>('email');
  const [signupPhoneOtp, setSignupPhoneOtp] = useState('');
  const [signupPhoneCodeSent, setSignupPhoneCodeSent] = useState(false);
  const [signupPhoneVerified, setSignupPhoneVerified] = useState(false);

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

  // Check if email is valid (any email allowed for testing)
  const isUniversityEmail = (email: string): boolean => {
    // Allow any email domain for testing purposes
    return isValidEmail(email);
  };

  const isLoginFormValid =
    loginChannel === 'email'
      ? loginData.email.trim() !== '' &&
        loginData.password.trim() !== '' &&
        isValidEmail(loginData.email)
      : isValidE164Phone(phoneLogin.trim()) && phoneOtp.trim().length === 6 && /^\d{6}$/.test(phoneOtp.trim());

  const canSendPhoneCode = isValidE164Phone(phoneLogin.trim());
  const canSendSignupPhoneCode = isValidE164Phone(signupData.phoneNumber.trim());

  const isSignupFormValid =
    signupChannel === 'email'
      ? signupData.email.trim() !== '' &&
        isValidEmail(signupData.email) &&
        signupData.password.length >= 8 &&
        signupData.password === signupData.confirmPassword
      : signupPhoneVerified &&
        isValidE164Phone(signupData.phoneNumber.trim()) &&
        signupData.email.trim() !== '' &&
        isValidEmail(signupData.email) &&
        signupData.password.length >= 8 &&
        signupData.password === signupData.confirmPassword;

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup' || modeParam === 'register') {
      setMode('signup');
    }
  }, [searchParams]);

  useEffect(() => {
    const pending = readSessionStorageWithMigration(PENDING_SIGNUP_PHONE_KEY, [
      LEGACY_PENDING_SIGNUP_PHONE_KEY,
    ]);
    if (pending?.trim()) {
      const p = pending.trim();
      setSignupData((prev) => ({ ...prev, phoneNumber: p }));
      setSignupChannel('phone');
      setSignupPhoneVerified(true);
      setSignupPhoneCodeSent(false);
      setSignupPhoneOtp('');
      removeSessionStorageKeys(PENDING_SIGNUP_PHONE_KEY, LEGACY_PENDING_SIGNUP_PHONE_KEY);
      setMode('signup');
    }
  }, []);

  const finishLoginRedirect = async (result: { isAdmin: boolean }) => {
    if (redirectUrl?.startsWith('/')) {
      navigate(redirectUrl);
      return;
    }

    const postLoginRedirect = localStorage.getItem('postLoginRedirect');
    if (postLoginRedirect) {
      try {
        const redirect = JSON.parse(postLoginRedirect);
        localStorage.removeItem('postLoginRedirect');

        if (redirect.type === 'schedule' && redirect.barber) {
          navigate(`/web/consumer/book/${redirect.barberId}`, {
            state: { barber: redirect.barber },
          });
          return;
        }
        if (redirect.type === 'waitlist') {
          navigate(
            typeof redirect.path === 'string' && redirect.path.startsWith('/')
              ? redirect.path
              : '/web/consumer'
          );
          return;
        }
      } catch {
        localStorage.removeItem('postLoginRedirect');
      }
    }

    const currentUser = useAuthStore.getState().user;

    if (currentUser?.user_type !== 'barber' && !result.isAdmin) {
      try {
        const api = (await import('../services/api.service')).default;
        const response = await api.get('/bookings-simple', {
          role: 'consumer',
          status: 'COMPLETED',
        });

        const completedBookings = response.bookings || [];
        const pendingPayment = completedBookings.find(
          (b: any) =>
            b.status === 'COMPLETED' &&
            !b.paidAt &&
            !isPaymentTakeoverDeferred(b.id)
        );

        if (pendingPayment) {
          navigate(`/web/payment/${pendingPayment.id}`);
          return;
        }
      } catch (err) {
        console.error('Error checking for pending payments:', err);
      }
    }

    if (result.isAdmin || currentUser?.user_type === 'barber') {
      // Admin without a barber profile stays on consumer (Admin UI lives there)
      if (result.isAdmin && !currentUser?.has_barber_profile && currentUser?.user_type !== 'barber') {
        navigate('/web/consumer');
      } else {
        navigate('/web/barber');
      }
    } else {
      navigate('/web/consumer');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(loginData.email, loginData.password);
      toast.success('Login successful!');
      await finishLoginRedirect(result);
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

  const handleGoogleSignIn = async () => {
    if (!isGoogleSignInConfigured()) {
      setError('Google sign-in is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idToken = await requestGoogleIdToken();
      const result = await loginWithGoogle(idToken);
      toast.success('Login successful!');
      await finishLoginRedirect(result);
    } catch (err: any) {
      const errorCode = err.response?.data?.error?.code;
      const msg = String(err?.message || '');
      if (msg.includes('cancelled') || msg.includes('canceled')) {
        setError(null);
        return;
      }
      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        setError(
          'Account not in the system. Please sign up first, then try Google again.'
        );
      } else {
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Google sign-in failed. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSendCode = async () => {
    const raw = phoneLogin.trim();
    if (!isValidE164Phone(raw)) {
      toast.error('Enter a valid number with country code (e.g. +1 408 921 9541 or 14089219541)');
      return;
    }
    const p = normalizeE164Phone(raw);
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestPhoneOtp(p);
      setPhoneCodeSent(true);
      toast.success('Verification code sent.');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Could not send code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = phoneLogin.trim();
    if (!isValidE164Phone(raw) || !/^\d{6}$/.test(phoneOtp.trim())) return;
    const p = normalizeE164Phone(raw);
    setIsLoading(true);
    setError(null);
    try {
      const result = await loginWithPhone(p, phoneOtp.trim());
      if (result.kind === 'no_account') {
        sessionStorage.setItem(PENDING_SIGNUP_PHONE_KEY, result.phoneNumber);
        sessionStorage.removeItem(LEGACY_PENDING_SIGNUP_PHONE_KEY);
        setSignupData((prev) => ({ ...prev, phoneNumber: result.phoneNumber }));
        setSignupChannel('phone');
        setSignupPhoneVerified(true);
        setSignupPhoneCodeSent(false);
        setSignupPhoneOtp('');
        setMode('signup');
        setPhoneCodeSent(false);
        setPhoneOtp('');
        toast.success(
          result.message ||
            'Phone verified. Enter your email and password below to finish signing up.',
          { duration: 7000 }
        );
        setIsLoading(false);
        return;
      }
      toast.success('Signed in with phone!');
      await finishLoginRedirect({
        isAdmin: result.isAdmin,
      });
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Verification failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupPhoneSendCode = async () => {
    const raw = signupData.phoneNumber.trim();
    if (!isValidE164Phone(raw)) {
      toast.error('Enter a valid number with country code (e.g. +1 408 921 9541 or 14089219541)');
      return;
    }
    const p = normalizeE164Phone(raw);
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestPhoneOtp(p);
      setSignupPhoneCodeSent(true);
      toast.success('Verification code sent.');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Could not send code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupPhoneVerifyOtp = async () => {
    const raw = signupData.phoneNumber.trim();
    if (!isValidE164Phone(raw) || !/^\d{6}$/.test(signupPhoneOtp.trim())) return;
    const p = normalizeE164Phone(raw);
    setIsLoading(true);
    setError(null);
    try {
      const data = await authService.verifyPhoneOtp(p, signupPhoneOtp.trim());
      if (data.accountExists) {
        toast.error('An account with this phone already exists. Sign in with Phone instead.');
        return;
      }
      setSignupPhoneVerified(true);
      toast.success('Phone verified. Enter your email and password below.');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Verification failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupChannel === 'phone' && !signupPhoneVerified) {
      return;
    }

    // Validate
    const errors: {[key: string]: string} = {};
    if (!signupData.email.trim()) errors.email = 'Email is required';
    else if (!isValidEmail(signupData.email)) errors.email = 'Invalid email address';
    if (!signupData.password) errors.password = 'Password is required';
    else if (signupData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (signupData.password !== signupData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    const phoneRaw = signupData.phoneNumber.trim();
    if (signupChannel === 'phone') {
      if (!phoneRaw || !isValidE164Phone(phoneRaw)) {
        errors.phoneNumber = 'Enter a valid number with country code (e.g. +14089219541)';
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signup({
        first_name: signupData.firstName.trim(),
        last_name: signupData.lastName.trim(),
        email: signupData.email,
        password: signupData.password,
        user_type: 'student', // All users start as consumers; barber applications are separate
        phoneNumber: signupChannel === 'phone' ? normalizeE164Phone(phoneRaw) : undefined,
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
      // Pending signup already exists — stash email so verification / resend works.
      if (/verification already in progress/i.test(errorMessage) && signupData.email.trim()) {
        localStorage.setItem('pendingVerificationEmail', signupData.email.trim());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isPendingVerificationError = Boolean(
    error && /verification already in progress/i.test(error)
  );

  const goToVerificationPage = () => {
    const email = signupData.email.trim();
    if (email) {
      localStorage.setItem('pendingVerificationEmail', email);
    }
    navigate('/web/verify-email');
  };

  const handleResendVerificationFromSignup = async () => {
    const email = signupData.email.trim();
    if (!email) {
      toast.error('Enter your email address first');
      return;
    }
    setIsResendingCode(true);
    setError(null);
    try {
      localStorage.setItem('pendingVerificationEmail', email);
      await resendVerificationCode(email);
      toast.success('Verification code sent! Check your inbox.');
      navigate('/web/verify-email');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to resend code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsResendingCode(false);
    }
  };

  // Handle forgot password request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    setIsSendingReset(true);
    
    try {
      await authService.requestPasswordReset(forgotPasswordEmail);
      setResetEmailSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      // Don't reveal if email exists or not for security
      setResetEmailSent(true);
      toast.success('If an account exists with this email, you will receive a password reset link.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setResetEmailSent(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setValidationErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoginChannel('email');
    setPhoneLogin('');
    setPhoneOtp('');
    setPhoneCodeSent(false);
    setSignupChannel('email');
    setSignupPhoneOtp('');
    setSignupPhoneCodeSent(false);
    setSignupPhoneVerified(false);
  };

  // Viewport detection
  const { isMobile, isMobilePortrait } = useViewport();
  
  return (
    <>
      {/* Fixed full-screen background to cover overscroll areas on mobile */}
      <div 
        className="fixed inset-0 z-0"
        style={{ backgroundColor: '#022b19' }}
      />
      <div 
        className="relative z-10 min-h-[100dvh] flex items-center justify-center py-6 sm:py-12 px-3 sm:px-4"
        style={{ backgroundColor: '#022b19' }}
      >
        <div className="max-w-md w-full">
        {/* Header - Logo & Title */}
        <div className="flex flex-col items-center justify-center mb-4 sm:mb-8">
          <Link to="/" className="hover:opacity-80 active:scale-95 transition-all duration-150">
            <img 
              src={TivelaPlatformsLogo} 
              alt="OnCuts Logo" 
              className="h-12 sm:h-16 w-auto mb-2 sm:mb-4"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-sm sm:text-base text-gray-300">
            {mode === 'login' ? 'Access your OnCuts account' : 'Join OnCuts today'}
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

          {/* Login: email/password or phone SMS code */}
          {mode === 'login' && (
            <>
              {/* Phone sign-in temporarily disabled — email only
              <div className="flex mb-4 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setLoginChannel('email');
                    setError(null);
                    setPhoneCodeSent(false);
                    setPhoneOtp('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    loginChannel === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail size={16} aria-hidden />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginChannel('phone');
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    loginChannel === 'phone' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Phone size={16} aria-hidden />
                  Phone
                </button>
              </div>
              */}

              {loginChannel === 'email' && (
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
                    className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                      loginData.email && isValidEmail(loginData.email) 
                        ? 'border-green-400 focus:border-green-500' 
                        : 'border-gray-400 focus:border-gray-900'
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
                  className="w-full pt-5 pb-3 px-4 pr-12 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 focus:border-gray-900 transition-all duration-200 text-gray-900 placeholder-gray-400"
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
                    ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
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

              {isGoogleSignInConfigured() && (
                <>
                  <div className="relative flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className={`w-full py-3.5 px-6 rounded-lg font-semibold text-base transition-all duration-200 flex items-center justify-center gap-3 border-2 ${
                      isLoading
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                      />
                      <path
                        fill="#34A853"
                        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </>
              )}

              {/* Forgot Password */}
              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-primary-500 hover:text-gray-900 text-sm font-medium transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
              )}

              {loginChannel === 'phone' && (
            <form onSubmit={handlePhoneLoginSubmit} className="space-y-5">
              <div className="relative">
                <label
                  htmlFor="login-phone"
                  className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                >
                  Phone (E.164)
                </label>
                <input
                  type="tel"
                  id="login-phone"
                  value={phoneLogin}
                  onChange={(e) => {
                    setPhoneLogin(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pt-5 pb-3 px-4 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 focus:border-gray-900 text-gray-900 placeholder-gray-400"
                  placeholder="+14155552671"
                  autoComplete="tel"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Country code required (e.g. +14089219541 or 14089219541). We will text you a 6-digit code.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePhoneSendCode}
                disabled={!canSendPhoneCode || isLoading}
                className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                  canSendPhoneCode && !isLoading
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {phoneCodeSent ? 'Resend code' : 'Send verification code'}
              </button>

              {phoneCodeSent && (
                <div className="relative">
                  <label
                    htmlFor="login-otp"
                    className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                  >
                    6-digit code
                  </label>
                  <input
                    type="text"
                    id="login-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={phoneOtp}
                    onChange={(e) => {
                      setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (error) setError(null);
                    }}
                    className="w-full pt-5 pb-3 px-4 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 tracking-widest text-center text-lg"
                    placeholder="000000"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!isLoginFormValid || isLoading || !phoneCodeSent}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  isLoginFormValid && !isLoading && phoneCodeSent
                    ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Verify & sign in'
                )}
              </button>

              <p className="text-gray-500 text-xs text-center">
                New account? After the code verifies, open <strong>Sign Up</strong> → <strong>Phone</strong> and finish with your email and password.
              </p>
            </form>
              )}
            </>
          )}

          {/* Signup: email or phone (SMS) then email + password */}
          {mode === 'signup' && (
            <>
              {/* Phone sign-up temporarily disabled — email only
              <div className="flex mb-4 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setSignupChannel('email');
                    setError(null);
                    setSignupPhoneOtp('');
                    setSignupPhoneCodeSent(false);
                    setSignupPhoneVerified(false);
                    setSignupData((prev) => ({ ...prev, phoneNumber: '' }));
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    signupChannel === 'email' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail size={16} aria-hidden />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignupChannel('phone');
                    setError(null);
                    setSignupPhoneOtp('');
                    setSignupPhoneCodeSent(false);
                    setSignupPhoneVerified(false);
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    signupChannel === 'phone' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Phone size={16} aria-hidden />
                  Phone
                </button>
              </div>
              */}

              {signupChannel === 'email' && (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
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
                        value={signupData.firstName}
                        onChange={handleSignupChange}
                        className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                          validationErrors.firstName ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
                        }`}
                        placeholder="John"
                      />
                    </div>
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
                        value={signupData.lastName}
                        onChange={handleSignupChange}
                        className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                          validationErrors.lastName ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
                        }`}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

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
                        className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                          validationErrors.email
                            ? 'border-red-400'
                            : signupData.email && isValidEmail(signupData.email)
                              ? 'border-green-400 focus:border-green-500'
                              : 'border-gray-400 focus:border-gray-900'
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

                  <div className="relative">
                    <label
                      htmlFor="signup-password"
                      className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                    >
                      Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="signup-password"
                      name="password"
                      value={signupData.password}
                      onChange={handleSignupChange}
                      className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                        validationErrors.password ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
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

                  <div className="relative">
                    <label
                      htmlFor="confirmPassword"
                      className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                    >
                      Confirm Password
                    </label>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                        validationErrors.confirmPassword ||
                        (signupData.confirmPassword && signupData.password !== signupData.confirmPassword)
                          ? 'border-red-400'
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

                  {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <p className="text-red-700 text-sm">{error}</p>
                          {isPendingVerificationError && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                type="button"
                                onClick={() => void handleResendVerificationFromSignup()}
                                disabled={isResendingCode || isLoading || !signupData.email.trim()}
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isResendingCode ? 'Sending…' : 'Resend Code'}
                              </button>
                              <button
                                type="button"
                                onClick={goToVerificationPage}
                                disabled={isResendingCode || isLoading}
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg border-2 border-gray-900 text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Go to verification
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!isSignupFormValid || isLoading}
                    className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                      isSignupFormValid && !isLoading
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
              )}

              {signupChannel === 'phone' && (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  {!signupPhoneVerified && (
                    <>
                      <div className="relative">
                        <label
                          htmlFor="signup-phone-e164"
                          className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                        >
                          Phone (E.164)
                        </label>
                        <input
                          type="tel"
                          id="signup-phone-e164"
                          name="phoneNumber"
                          value={signupData.phoneNumber}
                          onChange={handleSignupChange}
                          className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                            validationErrors.phoneNumber ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
                          }`}
                          placeholder="+14155552671"
                          autoComplete="tel"
                        />
                        {validationErrors.phoneNumber && (
                          <p className="text-red-500 text-xs mt-1">{validationErrors.phoneNumber}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          Country code required (e.g. +14089219541 or 14089219541). We will text you a 6-digit code.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSignupPhoneSendCode}
                        disabled={!canSendSignupPhoneCode || isLoading}
                        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                          canSendSignupPhoneCode && !isLoading
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {signupPhoneCodeSent ? 'Resend code' : 'Send verification code'}
                      </button>

                      {signupPhoneCodeSent && (
                        <div className="relative">
                          <label
                            htmlFor="signup-phone-otp"
                            className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                          >
                            6-digit code
                          </label>
                          <input
                            type="text"
                            id="signup-phone-otp"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={signupPhoneOtp}
                            onChange={(e) => {
                              setSignupPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                              if (error) setError(null);
                            }}
                            className="w-full pt-5 pb-3 px-4 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 tracking-widest text-center text-lg"
                            placeholder="000000"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleSignupPhoneVerifyOtp}
                        disabled={
                          isLoading ||
                          !canSendSignupPhoneCode ||
                          !signupPhoneCodeSent ||
                          !/^\d{6}$/.test(signupPhoneOtp.trim())
                        }
                        className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                          !isLoading &&
                          canSendSignupPhoneCode &&
                          signupPhoneCodeSent &&
                          /^\d{6}$/.test(signupPhoneOtp.trim())
                            ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Verifying...</span>
                          </div>
                        ) : (
                          'Verify phone'
                        )}
                      </button>
                    </>
                  )}

                  {signupPhoneVerified && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <label
                            htmlFor="signup-phone-firstName"
                            className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                          >
                            First name (optional)
                          </label>
                          <input
                            type="text"
                            id="signup-phone-firstName"
                            name="firstName"
                            value={signupData.firstName}
                            onChange={handleSignupChange}
                            className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                              validationErrors.firstName ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
                            }`}
                            placeholder="John"
                          />
                        </div>
                        <div className="relative">
                          <label
                            htmlFor="signup-phone-lastName"
                            className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                          >
                            Last name (optional)
                          </label>
                          <input
                            type="text"
                            id="signup-phone-lastName"
                            name="lastName"
                            value={signupData.lastName}
                            onChange={handleSignupChange}
                            className={`w-full pt-5 pb-3 px-4 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                              validationErrors.lastName ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
                            }`}
                            placeholder="Doe"
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <label
                          htmlFor="signup-phone-email"
                          className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                        >
                          Email Address
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            id="signup-phone-email"
                            name="email"
                            value={signupData.email}
                            onChange={handleSignupChange}
                            className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                              validationErrors.email
                                ? 'border-red-400'
                                : signupData.email && isValidEmail(signupData.email)
                                  ? 'border-green-400 focus:border-green-500'
                                  : 'border-gray-400 focus:border-gray-900'
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

                      <div className="relative">
                        <label
                          htmlFor="signup-phone-password"
                          className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                        >
                          Password
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="signup-phone-password"
                          name="password"
                          value={signupData.password}
                          onChange={handleSignupChange}
                          className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                            validationErrors.password ? 'border-red-400' : 'border-gray-400 focus:border-gray-900'
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

                      <div className="relative">
                        <label
                          htmlFor="signup-phone-confirmPassword"
                          className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                        >
                          Confirm Password
                        </label>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="signup-phone-confirmPassword"
                          name="confirmPassword"
                          value={signupData.confirmPassword}
                          onChange={handleSignupChange}
                          className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                            validationErrors.confirmPassword ||
                            (signupData.confirmPassword && signupData.password !== signupData.confirmPassword)
                              ? 'border-red-400'
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
                    </>
                  )}

                  {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <p className="text-red-700 text-sm">{error}</p>
                          {isPendingVerificationError && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                type="button"
                                onClick={() => void handleResendVerificationFromSignup()}
                                disabled={isResendingCode || isLoading || !signupData.email.trim()}
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isResendingCode ? 'Sending…' : 'Resend Code'}
                              </button>
                              <button
                                type="button"
                                onClick={goToVerificationPage}
                                disabled={isResendingCode || isLoading}
                                className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg border-2 border-gray-900 text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Go to verification
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {signupPhoneVerified && (
                    <button
                      type="submit"
                      disabled={!isSignupFormValid || isLoading}
                      className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                        isSignupFormValid && !isLoading
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
                  )}
                </form>
              )}
            </>
          )}

          {/* Footer */}
          <div className="mt-6 text-center space-y-3">
            <p className="text-gray-500 text-sm">
              Need help?{' '}
              <a 
                href="mailto:support@oncuts.com"
                className="text-primary-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
              >
                <Mail size={14} />
                Contact Support
              </a>
            </p>

            <p className="text-gray-400 text-xs">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-emerald-600 hover:text-emerald-700 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-emerald-600 hover:text-emerald-700 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Back to Landing Page */}
        <div className="text-center mt-6">
          <Link 
            to="/"
            className="text-gray-400 hover:text-white text-sm transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to OnCuts
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeForgotPassword}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
              <button 
                onClick={closeForgotPassword}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {!resetEmailSent ? (
              <form onSubmit={handleForgotPassword}>
                <p className="text-gray-600 mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <div className="relative mb-4">
                  <label 
                    htmlFor="forgot-email" 
                    className="absolute -top-2.5 left-3 text-sm font-medium text-gray-700 bg-white px-1 z-10"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full pt-5 pb-3 px-4 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-4 focus:ring-gray-400/20 focus:border-gray-900 transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSendingReset ? 'Sending...' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="w-full mt-3 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
                <p className="text-gray-600 mb-6">
                  If an account exists for <strong>{forgotPasswordEmail}</strong>, you will receive a password reset link shortly.
                </p>
                <button
                  onClick={closeForgotPassword}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
    </>
  );
}

