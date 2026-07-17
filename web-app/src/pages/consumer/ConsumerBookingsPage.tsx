/**
 * Legacy /consumer/bookings route — opens the bookings modal on the consumer home.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Loading from '../../components/Loading';

export default function ConsumerBookingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';

  useEffect(() => {
    navigate(`${platformPrefix}/consumer`, {
      replace: true,
      state: { ...(location.state || {}), openBookings: true },
    });
  }, [navigate, platformPrefix, location.state]);

  return <Loading />;
}
