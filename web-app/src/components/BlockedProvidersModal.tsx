/**
 * Popup listing barbers the consumer has peer-blocked; supports unblock.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import messageService, { type BlockedServiceProviderItem } from '../services/message.service';
import { useAuthStore } from '../store/useAuthStore';
import Avatar from './Avatar';
import Button from './Button';

function isUgSchemaMissing(err: unknown): boolean {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return code === 'UGC_SCHEMA_MISSING';
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function BlockedProvidersModal({ open, onClose }: Props) {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<BlockedServiceProviderItem[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (!open || !user) return;
    load();
  }, [open, user, load]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] bg-black/50 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-providers-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85dvh] sm:max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 id="blocked-providers-title" className="text-lg font-bold text-white">
              Blocked providers
            </h2>
            <p className="text-white/80 text-sm mt-0.5">Manage who you have blocked</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 px-5 py-3 border-b border-gray-100 shrink-0">
          Barbers you have blocked cannot message you or book with you until you unblock them.
        </p>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 px-2">
              <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No blocked barbers</p>
              <p className="text-gray-500 text-sm mt-2">
                When you block someone from their profile or messages, they will appear here so you can unblock
                them later.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.blockedUserId}
                  className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                >
                  <Avatar src={row.avatarUrl || undefined} alt={row.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{row.name}</p>
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
    </div>
  );
}
