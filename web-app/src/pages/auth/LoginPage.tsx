import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle, Mail, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { ROUTES } from '../../config/constants';
import TabChairLogo from '../../assets/logos/Tab_Chair.png';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
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

  const isFormValid = formData.email.trim() !== '' && 
    formData.password.trim() !== '' &&
    isValidEmail(formData.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(formData.email, formData.password);
      toast.success('Login successful!');
      
      // Redirect admin to role selection page
      if (result.isAdmin) {
        navigate('/web/admin-role-select');
      } else {
        navigate('/web/consumer');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ backgroundColor: '#022b19' }}
    >
      <div className="max-w-md w-full">
        {/* Header - Logo & Title */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Link to="/" className="hover:opacity-80 active:scale-95 transition-all duration-150">
            <img 
              src={TabChairLogo} 
              alt="CampusCut Logo" 
              className="h-16 w-auto mb-4"
            />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Sign In
          </h1>
          <p className="text-gray-300">Access your CampusCut account</p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl p-8"
          style={{ maxWidth: '400px', margin: '0 auto' }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className={`w-full pt-5 pb-3 px-4 pr-12 border-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary-400/20 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                    formData.email && isValidEmail(formData.email) 
                      ? 'border-green-400 focus:border-green-500' 
                      : 'border-primary-400 focus:border-primary-500'
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
                  <div>
                    <p className="text-red-800 font-medium text-sm">Login Failed</p>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                isFormValid && !isLoading
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

            {/* Forgot Password Link */}
            <div className="text-center">
              <Link 
                to="#" 
                className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
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
              Don't have an account?{' '}
              <Link 
                to={ROUTES.SIGNUP} 
                className="text-primary-500 hover:text-primary-600 font-semibold transition-colors"
              >
                Sign up
              </Link>
            </p>

            {/* Support Link */}
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

            {/* Terms */}
            <p className="text-gray-400 text-xs">
              By signing in, you agree to our{' '}
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
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Back to CampusCut
          </Link>
        </div>
      </div>
    </div>
  );
}
