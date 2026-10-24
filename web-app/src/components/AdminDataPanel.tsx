import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';
import { downloadCsv, slugifyForFilename } from '../utils/csv';

type DataRoot = 'uploads' | 'database';
type UploadKind = 'portfolio' | 'profile' | 'chat';

const ROOT_TABS: { id: DataRoot; label: string }[] = [
  { id: 'uploads', label: 'Uploads' },
  { id: 'database', label: 'Database' },
];

const DATA_TABS: { id: UploadKind; label: string }[] = [
  { id: 'profile', label: 'Profile pictures' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'chat', label: 'Chat' },
];

const MEDIA_TABS: { id: 'image' | 'video'; label: string }[] = [
  { id: 'image', label: 'Photo' },
  { id: 'video', label: 'Video' },
];

const PAGE_SIZE = 50;

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

interface DbCatalogTable {
  name: string;
  label: string;
}

interface DbCatalogDomain {
  id: string;
  label: string;
  tables: DbCatalogTable[];
}

interface DbColumn {
  name: string;
  dataType: string;
}

interface DbTablePage {
  table: string;
  columns: DbColumn[];
  rows: Record<string, string | number | boolean | null>[];
  total: number;
  limit: number;
  offset: number;
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

function cellDisplay(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
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

function SegmentedNav<T extends string>({
  label,
  tabs,
  value,
  onChange,
  cols,
}: {
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  cols: number;
}) {
  return (
    <nav
      className="grid gap-0.5 rounded-xl bg-stone-100 p-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={label}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold leading-tight text-center transition-colors ${
            value === tab.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default function AdminDataPanel() {
  const [root, setRoot] = useState<DataRoot>('uploads');

  // Uploads
  const [section, setSection] = useState<UploadKind>('profile');
  const [media, setMedia] = useState<'image' | 'video'>('image');
  const [profile, setProfile] = useState<UploadBucket>(EMPTY_BUCKET);
  const [portfolio, setPortfolio] = useState<UploadBucket>(EMPTY_BUCKET);
  const [chat, setChat] = useState<UploadBucket>(EMPTY_BUCKET);
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [uploadsExporting, setUploadsExporting] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);

  // Database
  const [catalog, setCatalog] = useState<DbCatalogDomain[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState<DbTablePage | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableOffset, setTableOffset] = useState(0);
  const [detailRow, setDetailRow] = useState<Record<string, string | number | boolean | null> | null>(null);
  const [dbExporting, setDbExporting] = useState(false);

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

  const loadUploads = useCallback(async () => {
    setUploadsLoading(true);
    setUploadsError(null);
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
      setUploadsError('Could not load uploaded files.');
    } finally {
      setUploadsLoading(false);
    }
  }, [loadKind]);

  useEffect(() => {
    void loadUploads();
  }, [loadUploads]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await api.get<{ domains: DbCatalogDomain[] }>('/admin/db/catalog');
      const domains = Array.isArray(data?.domains) ? data.domains : [];
      setCatalog(domains);
      setCatalogLoaded(true);
      if (domains.length > 0) {
        setDomainId((prev) => prev ?? domains[0].id);
        const firstDomain = domains[0];
        const firstTable = firstDomain.tables[0]?.name ?? null;
        setTableName((prev) => prev ?? firstTable);
        setTableOffset(0);
      }
    } catch (err) {
      console.error('Failed to load DB catalog', err);
      setCatalog([]);
      setCatalogError('Could not load database catalog.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (root === 'database' && !catalogLoaded && !catalogLoading) {
      void loadCatalog();
    }
  }, [root, catalogLoaded, catalogLoading, loadCatalog]);

  const activeDomain = catalog.find((d) => d.id === domainId) ?? catalog[0] ?? null;
  const activeTables = activeDomain?.tables ?? [];

  useEffect(() => {
    if (!activeDomain) return;
    if (!activeTables.some((t) => t.name === tableName)) {
      setTableName(activeTables[0]?.name ?? null);
      setTableOffset(0);
    }
  }, [activeDomain, activeTables, tableName]);

  const loadTable = useCallback(async (name: string, offset: number) => {
    setTableLoading(true);
    setTableError(null);
    setDetailRow(null);
    try {
      const data = await api.get<DbTablePage>(`/admin/db/tables/${encodeURIComponent(name)}`, {
        limit: PAGE_SIZE,
        offset,
      });
      setTablePage(data);
    } catch (err) {
      console.error('Failed to load table', err);
      setTablePage(null);
      setTableError('Could not load table rows.');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (root !== 'database' || !tableName) return;
    void loadTable(tableName, tableOffset);
  }, [root, tableName, tableOffset, loadTable]);

  const exportUploads = async () => {
    const pageKind = section;
    const pageMedia = media;
    const pageName =
      pageKind === 'profile'
        ? 'Profile pictures'
        : pageKind === 'portfolio'
          ? pageMedia === 'video'
            ? 'Portfolio videos'
            : 'Portfolio photos'
          : pageMedia === 'video'
            ? 'Chat videos'
            : 'Chat photos';
    setUploadsExporting(true);
    try {
      const bucket = await loadKind(pageKind, 2000);
      const rows =
        pageKind === 'profile'
          ? bucket.items
          : bucket.items.filter((item) =>
              pageMedia === 'video' ? item.mediaType === 'video' : item.mediaType !== 'video'
            );
      if (rows.length === 0) {
        toast.error(`No ${pageName.toLowerCase()} to export`);
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`oncuts-uploads-${slugifyForFilename(pageName)}-${stamp}.csv`, [
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
      toast.success(`Exported ${rows.length} from ${pageName.toLowerCase()}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not export uploaded files');
    } finally {
      setUploadsExporting(false);
    }
  };

  const exportTablePage = () => {
    if (!tablePage || tablePage.rows.length === 0) {
      toast.error('No rows to export');
      return;
    }
    setDbExporting(true);
    try {
      const headers = tablePage.columns.map((c) => c.name);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(
        `oncuts-db-${slugifyForFilename(tablePage.table)}-${stamp}.csv`,
        headers,
        tablePage.rows.map((row) => headers.map((h) => cellDisplay(row[h] ?? null)))
      );
      toast.success(`Exported ${tablePage.rows.length} rows from ${tablePage.table}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not export table');
    } finally {
      setDbExporting(false);
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

  const totalRows = tablePage?.total ?? 0;
  const canPrev = tableOffset > 0;
  const canNext = tableOffset + PAGE_SIZE < totalRows;
  const rangeStart = totalRows === 0 ? 0 : tableOffset + 1;
  const rangeEnd = Math.min(tableOffset + PAGE_SIZE, totalRows);

  return (
    <div className="space-y-4">
      <SegmentedNav<DataRoot>
        label="Data"
        tabs={ROOT_TABS}
        value={root}
        onChange={setRoot}
        cols={2}
      />

      {root === 'uploads' ? (
        <div className="space-y-4">
          <SegmentedNav<UploadKind>
            label="Uploads"
            tabs={DATA_TABS}
            value={section}
            onChange={setSection}
            cols={3}
          />

          <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{activeLabel}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {uploadsLoading
                    ? 'Loading files…'
                    : `${fileCount(countBucket.total)}${shownNote(countBucket)}`}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={uploadsExporting || uploadsLoading}
                onClick={() => void exportUploads()}
              >
                {uploadsExporting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Export
              </Button>
            </div>

            {section !== 'profile' && (
              <SegmentedNav<'image' | 'video'>
                label={`${activeLabel} media`}
                tabs={MEDIA_TABS}
                value={media}
                onChange={setMedia}
                cols={2}
              />
            )}

            {uploadsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : uploadsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {uploadsError}
              </div>
            ) : (
              <MediaGrid items={visibleItems} empty={visibleEmpty} />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {catalogLoading && catalog.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          ) : catalogError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {catalogError}
            </div>
          ) : catalog.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
              No database tables available.
            </div>
          ) : (
            <>
              <SegmentedNav
                label="Database domains"
                tabs={catalog.map((d) => ({ id: d.id, label: d.label }))}
                value={(domainId ?? catalog[0].id) as string}
                onChange={(id) => {
                  setDomainId(id);
                  setTableOffset(0);
                  setDetailRow(null);
                }}
                cols={Math.min(catalog.length, 7)}
              />

              {activeTables.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeTables.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setTableName(t.name);
                        setTableOffset(0);
                        setDetailRow(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono transition-colors ${
                        tableName === t.name
                          ? 'bg-gray-900 text-white'
                          : 'bg-stone-100 text-gray-700 hover:bg-stone-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {tableName ?? 'Table'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tableLoading
                        ? 'Loading rows…'
                        : tablePage
                          ? `${totalRows.toLocaleString()} row${totalRows === 1 ? '' : 's'} · showing ${rangeStart}–${rangeEnd}`
                          : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={tableLoading || !tableName}
                      onClick={() => tableName && void loadTable(tableName, tableOffset)}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${tableLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={dbExporting || tableLoading || !tablePage?.rows.length}
                      onClick={exportTablePage}
                    >
                      {dbExporting ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Export
                    </Button>
                  </div>
                </div>

                {tableLoading && !tablePage ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  </div>
                ) : tableError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {tableError}
                  </div>
                ) : !tablePage || tablePage.rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                    No rows in this table.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-1">
                      <table className="min-w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {tablePage.columns.map((col) => (
                              <th
                                key={col.name}
                                className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white"
                                title={col.dataType}
                              >
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tablePage.rows.map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-100 hover:bg-stone-50 cursor-pointer"
                              onClick={() => setDetailRow(row)}
                            >
                              {tablePage.columns.map((col) => (
                                <td
                                  key={col.name}
                                  className="px-2 py-1.5 text-gray-800 max-w-[180px] truncate font-mono"
                                  title={cellDisplay(row[col.name] ?? null)}
                                >
                                  {cellDisplay(row[col.name] ?? null)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canPrev || tableLoading}
                        onClick={() => setTableOffset((o) => Math.max(0, o - PAGE_SIZE))}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                        Prev
                      </Button>
                      <span className="text-xs text-gray-500">
                        Page {Math.floor(tableOffset / PAGE_SIZE) + 1} of{' '}
                        {Math.max(1, Math.ceil(totalRows / PAGE_SIZE))}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canNext || tableLoading}
                        onClick={() => setTableOffset((o) => o + PAGE_SIZE)}
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </>
                )}

                {detailRow && (
                  <div className="rounded-lg border border-gray-200 bg-stone-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700">Row detail</p>
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-800"
                        onClick={() => setDetailRow(null)}
                      >
                        Close
                      </button>
                    </div>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(detailRow).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            {key}
                          </dt>
                          <dd className="text-xs text-gray-900 font-mono break-all whitespace-pre-wrap">
                            {cellDisplay(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
