import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Role Selection & Pages
import RoleSelectionPage from './pages/RoleSelectionPage';
import AdminPage from './pages/AdminPage';
import AdminPricingManagement from './pages/AdminPricingManagement';
import ConsumerPage from './pages/ConsumerPage';
import BarberPage from './pages/BarberPage';
import WalletPage from './pages/WalletPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        <Routes>
          <Route path="/" element={<RoleSelectionPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/pricing" element={<AdminPricingManagement />} />
          <Route path="/consumer" element={<ConsumerPage />} />
          <Route path="/barber" element={<BarberPage />} />
          <Route path="/wallet" element={<WalletPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
