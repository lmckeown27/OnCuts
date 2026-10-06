import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Video, X } from 'lucide-react';
import api from '../services/api.service';

export interface OperatorPortfolioItem {
  id: string;
  provider_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  sort_order: number;
  created_at: string;
}

interface OperatorPortfolioModalProps {
  providerId: string;
  visible: boolean;
  onClose: () => void;
}

function uploadErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { error?: { message?: string } | string } } })?.response;
  const body = response?.data?.error;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object' && body.message) return body.message;
  return 'Could not update your portfolio. Try again.';
}

export default function OperatorPortfolioModal({
  providerId,
  visible,
  onClose,
}: OperatorPortfolioModalProps) {
  const [items, setItems] = useState<OperatorPortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<OperatorPortfolioItem[]>(`/barbers/${providerId}/operator-portfolio`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (visible && providerId) {
      void loadItems();
    }
  }, [visible, providerId, loadItems]);

  const uploadFile = async (file: File, kind: 'image' | 'video') => {
    if (!providerId) return;
    setUploading(kind);
    setError(null);
    try {
      const form = new FormData();
      form.append('media', file);
      const created = await api.upload<OperatorPortfolioItem>(
        `/barbers/${providerId}/operator-portfolio`,
        form
      );
      if (created?.id) {
        setItems((current) => [...current, created]);
      } else {
        await loadItems();
      }
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setUploading(null);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!providerId) return;
    setError(null);
    try {
      await api.delete(`/barbers/${providerId}/operator-portfolio/${itemId}`);
      setItems((current) => current.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(uploadErrorMessage(err));
    }
  };

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${
        visible ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto transition-all duration-150 ease-out ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Portfolio"
      >
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-4 sm:px-6 py-4 flex items-center justify-between z-10 shrink-0 gap-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Portfolio</h2>
            <p className="text-white/80 text-sm">Photos and videos of your work</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors shrink-0"
            aria-label="Close portfolio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Add photos or videos of services you have done. Clients will be able to view this when they book you.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={!providerId || uploading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4" />
              {uploading === 'image' ? 'Uploading photo…' : 'Add photo'}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={!providerId || uploading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <Video className="w-4 h-4" />
              {uploading === 'video' ? 'Uploading video…' : 'Add video'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadFile(file, 'image');
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadFile(file, 'video');
              }}
            />
          </div>

          {!providerId && (
            <p className="text-sm text-amber-700">Your operator profile is still loading.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-gray-500">Loading portfolio…</p>}

          {!loading && providerId && items.length === 0 && (
            <p className="text-sm text-gray-500">No portfolio pieces yet.</p>
          )}

          {items.length > 0 && (
            <ul className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <li key={item.id} className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {item.media_type === 'video' ? (
                    <video src={item.media_url} controls className="w-full aspect-square object-cover bg-black" />
                  ) : (
                    <img src={item.media_url} alt={item.caption || 'Portfolio photo'} className="w-full aspect-square object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"
                    aria-label="Remove portfolio item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
