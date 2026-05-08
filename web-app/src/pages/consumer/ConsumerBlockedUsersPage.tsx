/**
 * Lists service providers (barbers) the signed-in consumer has peer-blocked; supports unblock.
 * Data: GET /api/v1/messages/blocks/service-providers, DELETE /api/v1/messages/blocks/:blockedUserId
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import messageService, { type BlockedServiceProviderItem } from '../../services/message.service';
import { useAuthStore } from '../../store/useAuthStore';
import { CampusCutLogo } from '@assets';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';

function isUgSchemaMissing(err: unknown): boolean {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return code === 'UGC_SCHEMA_MISSING';
}

export default function ConsumerBlockedUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
  const { user, isLoading: authLoading } = useAuthStore();

  const [rows, setRows] = useState<BlockedServiceProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await messageService.getBlockedServiceProviders();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      if (isUgSchemaMissing(e)) {
        toast.error('Blocking lists are not available yet. Please try again later.');
        setRows([]);
      } else {
        console.error(e);
        toast.error('Could not load blocked providers');
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(platformPrefix === '/app' ? '/app' : '/web', { replace: true });
      return;
    }
    if (user) load();
  }, [user, authLoading, load, navigate, platformPrefix]);

  const onUnblock = async (blockedUserId: string) => {
    setUnblockingId(blockedUserId);
    try {
      await messageService.unblockUser(blockedUserId);
      setRows((prev) => prev.filter((r) => r.blockedUserId !== blockedUserId));
      toast.success('Unblocked');
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.error('Block was already removed');
        setRows((prev) => prev.filter((r) => r.blockedUserId !== blockedUserId));
      } else {
        toast.error('Could not unblock');
      }
    } finally {
      setUnblockingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`${platformPrefix}/consumer`)}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <img src={CampusCutLogo} alt="" className="h-9 w-auto" />
        <h1 className="text-lg font-bold text-gray-900">Blocked providers</h1>
      </header>

      <p className="text-sm text-gray-500 px-4 py-3 bg-white border-b border-gray-100">
        Barbers you have blocked cannot message you or book with you until you unblock them.
      </p>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 px-4">
            <UserX className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No blocked barbers</p>
            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
              When you block someone from their profile or messages, they will appear here so you can unblock
              them later.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.blockedUserId}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
              >
                <Avatar src={row.avatarUrl || undefined} alt={row.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{row.name}</p>
                  {!row.barberIsActive && (
                    <p className="text-xs text-amber-700 mt-0.5">Inactive provider account</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={unblockingId === row.blockedUserId}
                  onClick={() => onUnblock(row.blockedUserId)}
                >
                  {unblockingId === row.blockedUserId ? '…' : 'Unblock'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
