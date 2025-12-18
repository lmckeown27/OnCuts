import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Landing & Role Selection
import LandingPage from './pages/LandingPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import AdminCampusesPage from './pages/admin/AdminCampusesPage';
import AdminSystemHealthPage from './pages/admin/AdminSystemHealthPage';
import AdminGasWalletPage from './pages/admin/AdminGasWalletPage';
import AdminMarketplacePage from './pages/admin/AdminMarketplacePage';
import AdminFraudDetectionPage from './pages/admin/AdminFraudDetectionPage';
import AdminPricingManagement from './pages/AdminPricingManagement';
import AdminUserView from './pages/admin/AdminUserView';
import DiscoverBarbers from './pages/DiscoverBarbers';
import BarberProfilePage from './pages/BarberProfilePage';
import ConsumerPage from './pages/ConsumerPage';
import BarberPage from './pages/BarberPage';
import BarberEarningsPage from './pages/barber/BarberEarningsPage';
import BarberServiceHistoryPage from './pages/barber/BarberServiceHistoryPage';
import AppointmentDetailsPage from './pages/AppointmentDetailsPage';
import BookingPaymentPage from './pages/student/BookingPaymentPage';
import WalletPage from './pages/WalletPage';

function AppContent() {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* PWA Install Prompt - Only on /app routes */}
      {isAppRoute && <PWAInstallPrompt />}
      
      <Routes>
            {/* Landing Page */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Platform-Specific Entry Points */}
            <Route path="/web" element={<RoleSelectionPage platform="web" />} />
            <Route path="/app" element={<RoleSelectionPage platform="app" />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminCampusesPage />} />
          <Route path="/admin/system-health" element={<AdminSystemHealthPage />} />
          <Route path="/admin/gas-wallet" element={<AdminGasWalletPage />} />
          <Route path="/admin/marketplace" element={<AdminMarketplacePage />} />
          <Route path="/admin/fraud" element={<AdminFraudDetectionPage />} />
          <Route path="/admin/pricing" element={<AdminPricingManagement />} />
          <Route path="/admin/user/:userId" element={<AdminUserView />} />
          
          {/* Consumer/Student Routes */}
          <Route path="/consumer" element={<ConsumerPage />} />
          <Route path="/discover" element={<DiscoverBarbers customerId="user-temp" customerName="User" />} />
          <Route path="/student/barbers/:barberId" element={<BarberProfilePage />} />
          <Route path="/barbers/:barberId" element={<BarberProfilePage />} />
          <Route path="/student/booking/payment" element={<BookingPaymentPage />} />
          
          {/* Barber Routes */}
          <Route path="/barber" element={<BarberPage />} />
          <Route path="/barber/earnings" element={<BarberEarningsPage />} />
          <Route path="/barber/service-history" element={<BarberServiceHistoryPage />} />
          <Route path="/barber/appointment/:appointmentId" element={<AppointmentDetailsPage />} />
          
          {/* Wallet */}
          <Route path="/wallet" element={<WalletPage />} />
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
