/**
 * Barber Stripe Connect Return/Refresh Handler
 * 
 * Simple redirect component that sends barbers back to their dashboard
 * with a query parameter to trigger the PayoutSettingsModal
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../components/Loading';

export default function BarberConnectReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to barber page with showPayoutSettings param
    navigate('/web/barber?showPayoutSettings=true', { replace: true });
  }, [navigate]);

  return <Loading />;
}

