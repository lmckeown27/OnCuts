import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Role Selection & Pages
import RoleSelectionPage from './pages/RoleSelectionPage';
import AdminPage from './pages/AdminPage';
import ConsumerPage from './pages/ConsumerPage';
import BarberPage from './pages/BarberPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        <Routes>
          <Route path="/" element={<RoleSelectionPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/consumer" element={<ConsumerPage />} />
          <Route path="/barber" element={<BarberPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
