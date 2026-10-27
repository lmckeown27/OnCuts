import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { notifyOpenReferrals } from '../utils/referralsRewardsEvents';

/**
 * Deep-link entry: return home and open the Referrals popup.
 */
export default function ReferralsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    const home =
      user?.user_type === 'barber' || user?.user_type === 'admin' || user?.is_admin
        ? '/web/barber'
        : '/web/consumer';
    navigate(home, { replace: true });
    const t = window.setTimeout(() => notifyOpenReferrals(), 50);
    return () => window.clearTimeout(t);
  }, [navigate, user]);

  return null;
}
