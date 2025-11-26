// Backup of original App.tsx - restore if needed
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useMessageStore } from './store/useMessageStore';
import socketService from './services/socket.service';
import { ROUTES } from './config/constants';
import Loading from './components/Loading';

// Layout
import Navbar from './components/Navbar';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import CampusSelectPage from './pages/auth/CampusSelectPage';

// Student Pages
import DiscoveryPage from './pages/student/DiscoveryPage';
import BarberDetailPage from './pages/student/BarberDetailPage';
import BookingPage from './pages/student/BookingPage';
import StudentBookingsPage from './pages/student/StudentBookingsPage';
import StudentProfilePage from './pages/student/StudentProfilePage';
import StudentMessagesPage from './pages/student/StudentMessagesPage';

// Barber Pages
import BarberDashboardPage from './pages/barber/BarberDashboardPage';
import BarberCalendarPage from './pages/barber/BarberCalendarPage';
import BarberEarningsPage from './pages/barber/BarberEarningsPage';
import BarberProfilePage from './pages/barber/BarberProfilePage';
import BarberMessagesPage from './pages/barber/BarberMessagesPage';

function App() {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { loadUnreadCount, addNewMessage } = useMessageStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect();
      loadUnreadCount();

      // Listen for new messages
      socketService.onNewMessage((message) => {
        addNewMessage(message);
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [isAuthenticated, user, loadUnreadCount, addNewMessage]);

  if (isLoading) {
    return <Loading fullScreen text="Loading CampusCuts..." />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        {isAuthenticated && <Navbar />}
        
        <Routes>
          {/* Public Routes */}
          <Route 
            path={ROUTES.LOGIN} 
            element={!isAuthenticated ? <LoginPage /> : <Navigate to={user?.user_type === 'barber' ? ROUTES.BARBER_DASHBOARD : ROUTES.STUDENT_DISCOVERY} />} 
          />
          <Route 
            path={ROUTES.SIGNUP} 
            element={!isAuthenticated ? <SignupPage /> : <Navigate to={ROUTES.CAMPUS_SELECT} />} 
          />
          <Route 
            path={ROUTES.CAMPUS_SELECT} 
            element={isAuthenticated && !user?.campus_id ? <CampusSelectPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />

          {/* Student Routes */}
          <Route 
            path={ROUTES.STUDENT_DISCOVERY} 
            element={isAuthenticated && user?.user_type === 'student' ? <DiscoveryPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.STUDENT_BARBER_DETAIL} 
            element={isAuthenticated && user?.user_type === 'student' ? <BarberDetailPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.STUDENT_BOOKING} 
            element={isAuthenticated && user?.user_type === 'student' ? <BookingPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.STUDENT_BOOKINGS} 
            element={isAuthenticated && user?.user_type === 'student' ? <StudentBookingsPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.STUDENT_PROFILE} 
            element={isAuthenticated && user?.user_type === 'student' ? <StudentProfilePage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.STUDENT_MESSAGES} 
            element={isAuthenticated && user?.user_type === 'student' ? <StudentMessagesPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />

          {/* Barber Routes */}
          <Route 
            path={ROUTES.BARBER_DASHBOARD} 
            element={isAuthenticated && user?.user_type === 'barber' ? <BarberDashboardPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.BARBER_CALENDAR} 
            element={isAuthenticated && user?.user_type === 'barber' ? <BarberCalendarPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.BARBER_EARNINGS} 
            element={isAuthenticated && user?.user_type === 'barber' ? <BarberEarningsPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.BARBER_PROFILE} 
            element={isAuthenticated && user?.user_type === 'barber' ? <BarberProfilePage /> : <Navigate to={ROUTES.LOGIN} />} 
          />
          <Route 
            path={ROUTES.BARBER_MESSAGES} 
            element={isAuthenticated && user?.user_type === 'barber' ? <BarberMessagesPage /> : <Navigate to={ROUTES.LOGIN} />} 
          />

          {/* Default Route */}
          <Route 
            path="/" 
            element={
              <Navigate 
                to={
                  isAuthenticated 
                    ? (user?.user_type === 'barber' ? ROUTES.BARBER_DASHBOARD : ROUTES.STUDENT_DISCOVERY)
                    : ROUTES.LOGIN
                } 
              />
            } 
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

