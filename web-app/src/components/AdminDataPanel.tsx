import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';
import { downloadCsv } from '../utils/csv';

type UploadKind = 'portfolio' | 'profile' | 'chat';

interface UploadedMediaItem {
  id: string;
  kind: UploadKind;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  specialty: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
}

const FILTERS: { id: UploadKind | 'all'; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'profile', label: 'Profiles' },
  { id: 'chat', label: 'Chat' },
  { id: 'all', label: 'All' },
];

const KIND_LABEL: Record<UploadKind, string> = {
  portfolio: 'Portfolio',
  profile: 'Profile photo',
  chat: 'Chat',
};

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function AdminDataPanel() {
  const [kind, setKind] = useState<UploadKind | 'all'>('portfolio');
  const [items, setItems] = useState<UploadedMediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextKind: UploadKind | 'all') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: UploadedMediaItem[]; total: number }>('/admin/uploads', {
        kind: nextKind,
        limit: 120,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
    } catch (err) {
      console.error('Failed to load uploaded user data', err);
      setItems([]);
      setTotal(0);
      setError('Could not load uploaded files.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(kind);
  }, [kind, load]);

  const exportRows = async () => {
    setIsExporting(true);
    try {
      const data = await api.get<{ items: UploadedMediaItem[]; total: number }>('/admin/uploads', {
        kind,
        limit: 2000,
      });
      const rows = Array.isArray(data?.items) ? data.items : [];
      if (rows.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`oncuts-uploads-${kind}-${stamp}.csv`, [
        'Kind',
        'Media type',
        'Owner',
        'Email',
        'Specialty',
        'Caption',
        'Uploaded',
        'File URL',
      ], rows.map((row) => [
        KIND_LABEL[row.kind] || row.kind,
        row.mediaType,
        row.ownerName,
        row.ownerEmail,
        row.specialty,
        row.caption,
        row.createdAt,
        row.mediaUrl,
      ]));
      toast.success(`Exported ${rows.length} file${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not export uploaded files');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</p>
            <p className="text-xs text-gray-500 mt-1">
              Files users have uploaded. Portfolio photos and videos are listed first.
            </p>
          </div>
          <Button type="button" size="sm" disabled={isExporting || isLoading} onClick={() => void exportRows()}>
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            Export
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setKind(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                kind === filter.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
          {!isLoading && (
            <span className="text-xs text-gray-500">
              {total} file{total === 1 ? '' : 's'}
              {total > items.length ? ` · showing ${items.length}` : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
            No uploaded files in this view.
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {items.map((item) => {
              const preview = item.thumbnailUrl || item.mediaUrl;
              return (
                <a
                  key={`${item.kind}-${item.id}`}
                  href={item.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-gray-400"
                >
                  <div className="aspect-[3/4] bg-stone-100">
                    {item.mediaType === 'video' ? (
                      <video src={item.mediaUrl} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={preview} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-2 space-y-0.5">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.ownerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {KIND_LABEL[item.kind]}
                      {item.specialty ? ` · ${item.specialty}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{formatWhen(item.createdAt)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
