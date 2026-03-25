import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthCallback, useZkLogin } from '@mysten/enoki/react';
import { useAuthStore } from '../store/useAuthStore';
import { persistUserSuiAddress } from '../services/zkLogin.service';
import Loading from '../components/Loading';
import { isEnokiWalletlessEnabled } from '../config/constants';

/**
 * OAuth redirect target: Google returns `id_token` in the URL hash.
 * `useAuthCallback` completes Enoki zkLogin; we persist the derived Sui address to CampusCuts.
 */
export default function ZkLoginEnokiCallbackPage() {
  if (!isEnokiWalletlessEnabled()) {
    return <Navigate to="/web" replace />;
  }
  return <ZkLoginEnokiCallbackInner />;
}

function ZkLoginEnokiCallbackInner() {
  const { handled } = useAuthCallback();
  const zk = useZkLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loadUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const persisted = useRef(false);

  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';

  useEffect(() => {
    if (!handled || persisted.current) return;

    if (!isAuthenticated) {
      toast.error('Log in to CampusCuts first, then link your invisible wallet.');
      navigate(`${platformPrefix}/auth`, { replace: true });
      return;
    }

    if (!zk?.address) {
      return;
    }

    persisted.current = true;
    void (async () => {
      try {
        await persistUserSuiAddress(zk.address!, zk.salt);
        await loadUser();
        toast.success('Invisible wallet linked — your zkLogin address is saved.');
        navigate(`${platformPrefix}/barber`, { replace: true });
      } catch (e: unknown) {
        persisted.current = false;
        const msg = e instanceof Error ? e.message : 'Could not save Sui address';
        setError(msg);
        toast.error(msg);
      }
    })();
  }, [handled, zk?.address, zk?.salt, isAuthenticated, navigate, platformPrefix, loadUser]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <Loading />
      <p className="mt-4 text-sm text-gray-600 text-center max-w-md">
        Finishing Google sign-in with Enoki…
      </p>
      {error && <p className="mt-2 text-sm text-red-600 text-center max-w-md">{error}</p>}
    </div>
  );
}

