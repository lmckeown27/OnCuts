import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Role Selection & Pages
import RoleSelectionPage from './pages/RoleSelectionPage';
import AdminDashboardMain from './pages/admin/AdminDashboardMain';
import AdminCampusesPage from './pages/admin/AdminCampusesPage';
import AdminSystemHealthPage from './pages/admin/AdminSystemHealthPage';
import AdminGasWalletPage from './pages/admin/AdminGasWalletPage';
import AdminMarketplacePage from './pages/admin/AdminMarketplacePage';
import AdminPricingManagement from './pages/AdminPricingManagement';
import AdminUserView from './pages/admin/AdminUserView';
import ConsumerPage from './pages/ConsumerPage';
import BarberPage from './pages/BarberPage';
import BarberEarningsPage from './pages/barber/BarberEarningsPage';
import BookingPaymentPage from './pages/student/BookingPaymentPage';
import WalletPage from './pages/WalletPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        <Routes>
          <Route path="/" element={<RoleSelectionPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboardMain />} />
          <Route path="/admin/campuses" element={<AdminCampusesPage />} />
          <Route path="/admin/system-health" element={<AdminSystemHealthPage />} />
          <Route path="/admin/gas-wallet" element={<AdminGasWalletPage />} />
          <Route path="/admin/marketplace" element={<AdminMarketplacePage />} />
          <Route path="/admin/pricing" element={<AdminPricingManagement />} />
          <Route path="/admin/user/:userId" element={<AdminUserView />} />
          
          {/* Consumer/Student Routes */}
          <Route path="/consumer" element={<ConsumerPage />} />
          <Route path="/student/booking/payment" element={<BookingPaymentPage />} />
          
          {/* Barber Routes */}
          <Route path="/barber" element={<BarberPage />} />
          <Route path="/barber/earnings" element={<BarberEarningsPage />} />
          
          {/* Wallet */}
          <Route path="/wallet" element={<WalletPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
