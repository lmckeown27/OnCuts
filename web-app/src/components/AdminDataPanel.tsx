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

function MediaSplit({
  photos,
  videos,
  photoEmpty,
  videoEmpty,
}: {
  photos: UploadedMediaItem[];
  videos: UploadedMediaItem[];
  photoEmpty: string;
  videoEmpty: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Photos
          <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">{photos.length}</span>
        </p>
        <MediaGrid items={photos} empty={photoEmpty} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Videos
          <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">{videos.length}</span>
        </p>
        <MediaGrid items={videos} empty={videoEmpty} />
      </div>
    </div>
  );
}

export default function AdminDataPanel() {
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

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</p>
            <p className="text-xs text-gray-500 mt-1">
              Profile pictures, portfolio photos and videos, and chat photos and videos.
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

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Profile pictures</h3>
                <span className="text-xs text-gray-500">{fileCount(profile.total)}{shownNote(profile)}</span>
              </div>
              <MediaGrid items={profile.items} empty="No profile pictures." />
            </section>

            <section className="space-y-3 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Portfolio uploads</h3>
                <span className="text-xs text-gray-500">{fileCount(portfolio.total)}{shownNote(portfolio)}</span>
              </div>
              <MediaSplit
                photos={portfolioPhotos}
                videos={portfolioVideos}
                photoEmpty="No portfolio photos."
                videoEmpty="No portfolio videos."
              />
            </section>

            <section className="space-y-3 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Chat uploads</h3>
                <span className="text-xs text-gray-500">{fileCount(chat.total)}{shownNote(chat)}</span>
              </div>
              <MediaSplit
                photos={chatPhotos}
                videos={chatVideos}
                photoEmpty="No chat photos."
                videoEmpty="No chat videos."
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
