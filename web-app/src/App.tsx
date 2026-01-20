import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AppStatus from './components/AppStatus';
import PlatformGuard from './components/PlatformGuard';
import Loading from './components/Loading';
import { useAuthStore } from './store/useAuthStore';

// Landing & Authentication - Load immediately (critical path)
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';

// Lazy load everything else for code splitting
// Authentication
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const AppInstallPage = lazy(() => import('./pages/AppInstallPage'));
const MobileAppDownloadPage = lazy(() => import('./pages/MobileAppDownloadPage'));

// Consumer Pages - Lazy loaded
const DiscoverBarbers = lazy(() => import('./pages/DiscoverBarbers'));
const BarberProfilePage = lazy(() => import('./pages/BarberProfilePage'));
const ConsumerPage = lazy(() => import('./pages/ConsumerPage'));
const ConsumerBookingStatusPage = lazy(() => import('./pages/ConsumerBookingStatusPage'));
const ScheduleServicePage = lazy(() => import('./pages/ScheduleServicePage'));
const BookingPaymentPage = lazy(() => import('./pages/student/BookingPaymentPage'));
const PostServicePaymentPage = lazy(() => import('./pages/PostServicePaymentPage'));

// Barber Pages - Lazy loaded
const BarberPage = lazy(() => import('./pages/BarberPage'));
const BarberEarningsPage = lazy(() => import('./pages/barber/BarberEarningsPage'));
const BarberServiceHistoryPage = lazy(() => import('./pages/barber/BarberServiceHistoryPage'));
const AppointmentDetailsPage = lazy(() => import('./pages/AppointmentDetailsPage'));
const BarberConnectOnboarding = lazy(() => import('./pages/BarberConnectOnboarding'));

// Shared Pages - Lazy loaded
const WalletPage = lazy(() => import('./pages/WalletPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));

// Mobile/App Pages (Touch-Optimized) - Lazy loaded
const MobileBarberPage = lazy(() => import('./pages/mobile/MobileBarberPage'));
const MobileConsumerPage = lazy(() => import('./pages/mobile/MobileConsumerPage'));

// Legal Pages - Lazy loaded
const TermsOfServicePage = lazy(() => import('./pages/legal/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/legal/PrivacyPolicyPage'));
const GDPRPage = lazy(() => import('./pages/legal/GDPRPage'));

// Suspense wrapper for lazy components
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    }>
      {children}
    </Suspense>
  );
}

function AppContent() {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');
  const isWebRoute = location.pathname.startsWith('/web');
  const { loadUser, isAuthenticated } = useAuthStore();

  // Load user data from API on mount to ensure fresh role data (e.g., is_campus_manager)
  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
  }, []); // Only run on initial mount

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toaster removed - no popup notifications */}
      
      {/* PWA Install Prompt - Only on /app routes */}
      {isAppRoute && <PWAInstallPrompt />}
      
      {/* App Status Indicators - Only on /app routes */}
      {isAppRoute && <AppStatus />}
      
      <Routes>
        {/* Landing Page - Not lazy (critical path) */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Legal Pages */}
        <Route path="/terms" element={<LazyRoute><TermsOfServicePage /></LazyRoute>} />
        <Route path="/privacy" element={<LazyRoute><PrivacyPolicyPage /></LazyRoute>} />
        <Route path="/gdpr" element={<LazyRoute><GDPRPage /></LazyRoute>} />
        
        {/* Installation Instructions */}
        <Route path="/install" element={<LazyRoute><AppInstallPage /></LazyRoute>} />
        
        {/* ═══════════════════════════════════════════════════════════
            WEB PLATFORM ROUTES (Browser Version)
            All routes under /web/* are isolated to web experience
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/web" element={<PlatformGuard requiredPlatform="web"><AuthPage /></PlatformGuard>} />
        <Route path="/web/verify-email" element={<PlatformGuard requiredPlatform="web"><LazyRoute><VerifyEmailPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/reset-password" element={<PlatformGuard requiredPlatform="web"><LazyRoute><ResetPasswordPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/install" element={<LazyRoute><AppInstallPage /></LazyRoute>} />
        
        {/* Web - Consumer/Student Routes */}
        {/* Redirect /web/find-barber to landing page (university selector now on landing page) */}
        <Route path="/web/find-barber" element={<Navigate to="/" replace />} />
        <Route path="/web/consumer" element={<PlatformGuard requiredPlatform="web"><LazyRoute><ConsumerPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/consumer/booking-status" element={<PlatformGuard requiredPlatform="web"><LazyRoute><ConsumerBookingStatusPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/consumer/book/:barberId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><ScheduleServicePage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/discover" element={<PlatformGuard requiredPlatform="web"><LazyRoute><DiscoverBarbers customerId="user-temp" customerName="User" /></LazyRoute></PlatformGuard>} />
        <Route path="/web/student/barbers/:barberId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberProfilePage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barbers/:barberId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberProfilePage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/student/booking/payment" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BookingPaymentPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/payment/:bookingId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><PostServicePaymentPage /></LazyRoute></PlatformGuard>} />
        
        {/* Web - Barber Routes (includes Campus Manager features when user is campus manager) */}
        <Route path="/web/barber" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/earnings" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberEarningsPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/service-history" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberServiceHistoryPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/connect" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberConnectOnboarding /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/connect/return" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberConnectOnboarding /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/connect/refresh" element={<PlatformGuard requiredPlatform="web"><LazyRoute><BarberConnectOnboarding /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/appointment/:appointmentId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><AppointmentDetailsPage /></LazyRoute></PlatformGuard>} />
        
        {/* Web - Wallet */}
        <Route path="/web/wallet" element={<PlatformGuard requiredPlatform="web"><LazyRoute><WalletPage /></LazyRoute></PlatformGuard>} />
        
        {/* Web - Messages (Generic - redirects to consumer messages) */}
        <Route path="/web/messages" element={<PlatformGuard requiredPlatform="web"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        
        {/* Web - Messages (Barber) */}
        <Route path="/web/barber/messages" element={<PlatformGuard requiredPlatform="web"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/barber/messages/:conversationId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        
        {/* Web - Messages (Consumer) */}
        <Route path="/web/consumer/messages" element={<PlatformGuard requiredPlatform="web"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        <Route path="/web/consumer/messages/:conversationId" element={<PlatformGuard requiredPlatform="web"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        
        {/* ═══════════════════════════════════════════════════════════
            APP PLATFORM ROUTES (PWA/dApp Version - Mobile Optimized)
            All routes under /app/* use touch-optimized mobile interfaces
            Perfect for iOS/Android handheld devices
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/app" element={<PlatformGuard requiredPlatform="app"><AuthPage /></PlatformGuard>} />
        <Route path="/app/verify-email" element={<PlatformGuard requiredPlatform="app"><LazyRoute><VerifyEmailPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/install" element={<LazyRoute><MobileAppDownloadPage /></LazyRoute>} />
        <Route path="/app/download" element={<LazyRoute><MobileAppDownloadPage /></LazyRoute>} />
        
        {/* App - Consumer/Student Routes (Mobile-Optimized) */}
        <Route path="/app/consumer" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MobileConsumerPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/consumer/booking-status" element={<PlatformGuard requiredPlatform="app"><LazyRoute><ConsumerBookingStatusPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/discover" element={<PlatformGuard requiredPlatform="app"><LazyRoute><DiscoverBarbers customerId="user-temp" customerName="User" /></LazyRoute></PlatformGuard>} />
        <Route path="/app/student/barbers/:barberId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><BarberProfilePage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/barbers/:barberId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><BarberProfilePage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/student/booking/payment" element={<PlatformGuard requiredPlatform="app"><LazyRoute><BookingPaymentPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/payment/:bookingId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><PostServicePaymentPage /></LazyRoute></PlatformGuard>} />
        
        {/* App - Barber Routes (Mobile-Optimized) */}
        <Route path="/app/barber" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MobileBarberPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/barber/earnings" element={<PlatformGuard requiredPlatform="app"><LazyRoute><BarberEarningsPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/barber/service-history" element={<PlatformGuard requiredPlatform="app"><LazyRoute><BarberServiceHistoryPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/barber/appointment/:appointmentId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><AppointmentDetailsPage /></LazyRoute></PlatformGuard>} />
        
        {/* App - Wallet */}
        <Route path="/app/wallet" element={<PlatformGuard requiredPlatform="app"><LazyRoute><WalletPage /></LazyRoute></PlatformGuard>} />
        
        {/* App - Messages (Barber) */}
        <Route path="/app/barber/messages" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/barber/messages/:conversationId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        
        {/* App - Messages (Consumer) */}
        <Route path="/app/consumer/messages" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        <Route path="/app/consumer/messages/:conversationId" element={<PlatformGuard requiredPlatform="app"><LazyRoute><MessagesPage /></LazyRoute></PlatformGuard>} />
        
        {/* ═══════════════════════════════════════════════════════════
            LEGACY REDIRECTS (For backwards compatibility)
            Redirect old routes to web platform by default
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/consumer" element={<Navigate to="/web/consumer" replace />} />
        <Route path="/barber" element={<Navigate to="/web/barber" replace />} />
        <Route path="/discover" element={<Navigate to="/web/discover" replace />} />
        <Route path="/wallet" element={<Navigate to="/web/wallet" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
