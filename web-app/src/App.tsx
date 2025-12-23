import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AppStatus from './components/AppStatus';
import PlatformGuard from './components/PlatformGuard';

// Landing & Authentication
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import AdminRoleSelectPage from './pages/auth/AdminRoleSelectPage';
import AppInstallPage from './pages/AppInstallPage';
import MobileAppDownloadPage from './pages/MobileAppDownloadPage';

// Desktop/Web Pages
import AdminCampusesPage from './pages/admin/AdminCampusesPage';
import AdminSystemHealthPage from './pages/admin/AdminSystemHealthPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminMarketplacePage from './pages/admin/AdminMarketplacePage';
import AdminFraudDetectionPage from './pages/admin/AdminFraudDetectionPage';
import AdminPricingManagement from './pages/AdminPricingManagement';
import AdminUserView from './pages/admin/AdminUserView';
import DiscoverBarbers from './pages/DiscoverBarbers';
import BarberProfilePage from './pages/BarberProfilePage';
import ConsumerPage from './pages/ConsumerPage';
import ScheduleServicePage from './pages/ScheduleServicePage';
import BarberPage from './pages/BarberPage';
import BarberEarningsPage from './pages/barber/BarberEarningsPage';
import BarberServiceHistoryPage from './pages/barber/BarberServiceHistoryPage';
import AppointmentDetailsPage from './pages/AppointmentDetailsPage';
import BookingPaymentPage from './pages/student/BookingPaymentPage';
import WalletPage from './pages/WalletPage';

// Mobile/App Pages (Touch-Optimized)
import MobileAdminPage from './pages/mobile/MobileAdminPage';
import MobileBarberPage from './pages/mobile/MobileBarberPage';
import MobileConsumerPage from './pages/mobile/MobileConsumerPage';

// Legal Pages
import { TermsOfServicePage, PrivacyPolicyPage, GDPRPage, HelpCenterPage } from './pages/legal';

function AppContent() {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');
  const isWebRoute = location.pathname.startsWith('/web');

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* PWA Install Prompt - Only on /app routes */}
      {isAppRoute && <PWAInstallPrompt />}
      
      {/* App Status Indicators - Only on /app routes */}
      {isAppRoute && <AppStatus />}
      
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Legal Pages */}
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/gdpr" element={<GDPRPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        
        {/* Installation Instructions */}
        <Route path="/install" element={<AppInstallPage />} />
        
        {/* ═══════════════════════════════════════════════════════════
            WEB PLATFORM ROUTES (Browser Version)
            All routes under /web/* are isolated to web experience
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/web" element={<PlatformGuard requiredPlatform="web"><AuthPage /></PlatformGuard>} />
        <Route path="/web/verify-email" element={<PlatformGuard requiredPlatform="web"><VerifyEmailPage /></PlatformGuard>} />
        <Route path="/web/admin-role-select" element={<PlatformGuard requiredPlatform="web"><AdminRoleSelectPage /></PlatformGuard>} />
        <Route path="/web/install" element={<AppInstallPage />} />
        
        {/* Web - Admin Routes */}
        <Route path="/web/admin" element={<PlatformGuard requiredPlatform="web"><AdminCampusesPage /></PlatformGuard>} />
        <Route path="/web/admin/system-health" element={<PlatformGuard requiredPlatform="web"><AdminSystemHealthPage /></PlatformGuard>} />
        <Route path="/web/admin/payments" element={<PlatformGuard requiredPlatform="web"><AdminPaymentsPage /></PlatformGuard>} />
        <Route path="/web/admin/marketplace" element={<PlatformGuard requiredPlatform="web"><AdminMarketplacePage /></PlatformGuard>} />
        <Route path="/web/admin/fraud" element={<PlatformGuard requiredPlatform="web"><AdminFraudDetectionPage /></PlatformGuard>} />
        <Route path="/web/admin/pricing" element={<PlatformGuard requiredPlatform="web"><AdminPricingManagement /></PlatformGuard>} />
        <Route path="/web/admin/user/:userId" element={<PlatformGuard requiredPlatform="web"><AdminUserView /></PlatformGuard>} />
        
        {/* Web - Consumer/Student Routes */}
        <Route path="/web/consumer" element={<PlatformGuard requiredPlatform="web"><ConsumerPage /></PlatformGuard>} />
        <Route path="/web/consumer/book/:barberId" element={<PlatformGuard requiredPlatform="web"><ScheduleServicePage /></PlatformGuard>} />
        <Route path="/web/discover" element={<PlatformGuard requiredPlatform="web"><DiscoverBarbers customerId="user-temp" customerName="User" /></PlatformGuard>} />
        <Route path="/web/student/barbers/:barberId" element={<PlatformGuard requiredPlatform="web"><BarberProfilePage /></PlatformGuard>} />
        <Route path="/web/barbers/:barberId" element={<PlatformGuard requiredPlatform="web"><BarberProfilePage /></PlatformGuard>} />
        <Route path="/web/student/booking/payment" element={<PlatformGuard requiredPlatform="web"><BookingPaymentPage /></PlatformGuard>} />
        
        {/* Web - Barber Routes */}
        <Route path="/web/barber" element={<PlatformGuard requiredPlatform="web"><BarberPage /></PlatformGuard>} />
        <Route path="/web/barber/earnings" element={<PlatformGuard requiredPlatform="web"><BarberEarningsPage /></PlatformGuard>} />
        <Route path="/web/barber/service-history" element={<PlatformGuard requiredPlatform="web"><BarberServiceHistoryPage /></PlatformGuard>} />
        <Route path="/web/barber/appointment/:appointmentId" element={<PlatformGuard requiredPlatform="web"><AppointmentDetailsPage /></PlatformGuard>} />
        
        {/* Web - Wallet */}
        <Route path="/web/wallet" element={<PlatformGuard requiredPlatform="web"><WalletPage /></PlatformGuard>} />
        
        {/* ═══════════════════════════════════════════════════════════
            APP PLATFORM ROUTES (PWA/dApp Version - Mobile Optimized)
            All routes under /app/* use touch-optimized mobile interfaces
            Perfect for iOS/Android handheld devices
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/app" element={<PlatformGuard requiredPlatform="app"><AuthPage /></PlatformGuard>} />
        <Route path="/app/verify-email" element={<PlatformGuard requiredPlatform="app"><VerifyEmailPage /></PlatformGuard>} />
        <Route path="/app/admin-role-select" element={<PlatformGuard requiredPlatform="app"><AdminRoleSelectPage /></PlatformGuard>} />
        <Route path="/app/install" element={<MobileAppDownloadPage />} />
        <Route path="/app/download" element={<MobileAppDownloadPage />} />
        
        {/* App - Admin Routes (Mobile-Optimized) */}
        <Route path="/app/admin" element={<PlatformGuard requiredPlatform="app"><MobileAdminPage /></PlatformGuard>} />
        <Route path="/app/admin/system-health" element={<PlatformGuard requiredPlatform="app"><AdminSystemHealthPage /></PlatformGuard>} />
        <Route path="/app/admin/payments" element={<PlatformGuard requiredPlatform="app"><AdminPaymentsPage /></PlatformGuard>} />
        <Route path="/app/admin/marketplace" element={<PlatformGuard requiredPlatform="app"><AdminMarketplacePage /></PlatformGuard>} />
        <Route path="/app/admin/fraud" element={<PlatformGuard requiredPlatform="app"><AdminFraudDetectionPage /></PlatformGuard>} />
        <Route path="/app/admin/pricing" element={<PlatformGuard requiredPlatform="app"><AdminPricingManagement /></PlatformGuard>} />
        <Route path="/app/admin/user/:userId" element={<PlatformGuard requiredPlatform="app"><AdminUserView /></PlatformGuard>} />
        
        {/* App - Consumer/Student Routes (Mobile-Optimized) */}
        <Route path="/app/consumer" element={<PlatformGuard requiredPlatform="app"><MobileConsumerPage /></PlatformGuard>} />
        <Route path="/app/discover" element={<PlatformGuard requiredPlatform="app"><DiscoverBarbers customerId="user-temp" customerName="User" /></PlatformGuard>} />
        <Route path="/app/student/barbers/:barberId" element={<PlatformGuard requiredPlatform="app"><BarberProfilePage /></PlatformGuard>} />
        <Route path="/app/barbers/:barberId" element={<PlatformGuard requiredPlatform="app"><BarberProfilePage /></PlatformGuard>} />
        <Route path="/app/student/booking/payment" element={<PlatformGuard requiredPlatform="app"><BookingPaymentPage /></PlatformGuard>} />
        
        {/* App - Barber Routes (Mobile-Optimized) */}
        <Route path="/app/barber" element={<PlatformGuard requiredPlatform="app"><MobileBarberPage /></PlatformGuard>} />
        <Route path="/app/barber/earnings" element={<PlatformGuard requiredPlatform="app"><BarberEarningsPage /></PlatformGuard>} />
        <Route path="/app/barber/service-history" element={<PlatformGuard requiredPlatform="app"><BarberServiceHistoryPage /></PlatformGuard>} />
        <Route path="/app/barber/appointment/:appointmentId" element={<PlatformGuard requiredPlatform="app"><AppointmentDetailsPage /></PlatformGuard>} />
        
        {/* App - Wallet */}
        <Route path="/app/wallet" element={<PlatformGuard requiredPlatform="app"><WalletPage /></PlatformGuard>} />
        
        {/* ═══════════════════════════════════════════════════════════
            LEGACY REDIRECTS (For backwards compatibility)
            Redirect old routes to web platform by default
        ═══════════════════════════════════════════════════════════ */}
        <Route path="/admin/*" element={<Navigate to={`/web${location.pathname}`} replace />} />
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
