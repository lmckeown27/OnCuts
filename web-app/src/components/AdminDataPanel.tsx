import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';
import { downloadCsv } from '../utils/csv';

type UploadKind = 'portfolio' | 'profile' | 'chat';

const DATA_TABS: { id: UploadKind; label: string }[] = [
  { id: 'profile', label: 'Profile pictures' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'chat', label: 'Chat' },
];

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

interface UploadBucket {
  items: UploadedMediaItem[];
  total: number;
}

const EMPTY_BUCKET: UploadBucket = { items: [], total: 0 };

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function sectionLabel(item: UploadedMediaItem): string {
  if (item.kind === 'profile') return 'Profile picture';
  if (item.kind === 'portfolio') return item.mediaType === 'video' ? 'Portfolio video' : 'Portfolio photo';
  return item.mediaType === 'video' ? 'Chat video' : 'Chat photo';
}

function fileCount(total: number): string {
  return `${total} file${total === 1 ? '' : 's'}`;
}

function MediaGrid({ items, empty }: { items: UploadedMediaItem[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
        {empty}
      </div>
    );
  }

  return (
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
                {item.mediaType === 'video' ? 'Video' : 'Photo'}
                {item.specialty ? ` · ${item.specialty}` : ''}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{formatWhen(item.createdAt)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

const MEDIA_TABS: { id: 'image' | 'video'; label: string }[] = [
  { id: 'image', label: 'Photo' },
  { id: 'video', label: 'Video' },
];

export default function AdminDataPanel() {
  const [section, setSection] = useState<UploadKind>('profile');
  const [media, setMedia] = useState<'image' | 'video'>('image');
  const [profile, setProfile] = useState<UploadBucket>(EMPTY_BUCKET);
  const [portfolio, setPortfolio] = useState<UploadBucket>(EMPTY_BUCKET);
  const [chat, setChat] = useState<UploadBucket>(EMPTY_BUCKET);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKind = useCallback(async (kind: UploadKind, limit: number): Promise<UploadBucket> => {
    const data = await api.get<{ items: UploadedMediaItem[]; total: number }>('/admin/uploads', {
      kind,
      limit,
    });
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: typeof data?.total === 'number' ? data.total : 0,
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileBucket, portfolioBucket, chatBucket] = await Promise.all([
        loadKind('profile', 120),
        loadKind('portfolio', 200),
        loadKind('chat', 200),
      ]);
      setProfile(profileBucket);
      setPortfolio(portfolioBucket);
      setChat(chatBucket);
    } catch (err) {
      console.error('Failed to load uploaded user data', err);
      setProfile(EMPTY_BUCKET);
      setPortfolio(EMPTY_BUCKET);
      setChat(EMPTY_BUCKET);
      setError('Could not load uploaded files.');
    } finally {
      setIsLoading(false);
    }
  }, [loadKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportRows = async () => {
    setIsExporting(true);
    try {
      const [profileBucket, portfolioBucket, chatBucket] = await Promise.all([
        loadKind('profile', 2000),
        loadKind('portfolio', 2000),
        loadKind('chat', 2000),
      ]);
      const rows = [...profileBucket.items, ...portfolioBucket.items, ...chatBucket.items];
      if (rows.length === 0) {
        toast.error('Nothing to export');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`oncuts-uploads-${stamp}.csv`, [
        'Section',
        'Media type',
        'Owner',
        'Email',
        'Specialty',
        'Caption',
        'Uploaded',
        'File URL',
      ], rows.map((row) => [
        sectionLabel(row),
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

  const portfolioPhotos = portfolio.items.filter((item) => item.mediaType !== 'video');
  const portfolioVideos = portfolio.items.filter((item) => item.mediaType === 'video');
  const chatPhotos = chat.items.filter((item) => item.mediaType !== 'video');
  const chatVideos = chat.items.filter((item) => item.mediaType === 'video');

  const shownNote = (bucket: UploadBucket) =>
    bucket.total > bucket.items.length ? ` · showing ${bucket.items.length}` : '';

  const activeBucket = section === 'profile' ? profile : section === 'portfolio' ? portfolio : chat;
  const activeLabel = DATA_TABS.find((tab) => tab.id === section)?.label ?? 'Data';
  const visibleItems =
    section === 'profile'
      ? profile.items
      : section === 'portfolio'
        ? media === 'video'
          ? portfolioVideos
          : portfolioPhotos
        : media === 'video'
          ? chatVideos
          : chatPhotos;
  const visibleEmpty =
    section === 'profile'
      ? 'No profile pictures.'
      : section === 'portfolio'
        ? media === 'video'
          ? 'No portfolio videos.'
          : 'No portfolio photos.'
        : media === 'video'
          ? 'No chat videos.'
          : 'No chat photos.';
  const countBucket: UploadBucket =
    section === 'profile' ? activeBucket : { items: visibleItems, total: visibleItems.length };

  return (
    <div className="space-y-4">
      <nav className="grid grid-cols-3 gap-0.5 rounded-xl bg-stone-100 p-1" aria-label="Data">
        {DATA_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold leading-tight text-center transition-colors ${
              section === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{activeLabel}</p>
            <p className="text-xs text-gray-500 mt-1">
              {isLoading ? 'Loading files…' : `${fileCount(countBucket.total)}${shownNote(countBucket)}`}
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

        {section !== 'profile' && (
          <nav className="grid grid-cols-2 gap-0.5 rounded-xl bg-stone-100 p-1" aria-label={`${activeLabel} media`}>
            {MEDIA_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMedia(tab.id)}
                className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold leading-tight text-center transition-colors ${
                  media === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : (
          <MediaGrid items={visibleItems} empty={visibleEmpty} />
        )}
      </div>
    </div>
  );
}
