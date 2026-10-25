import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';
import { downloadCsv, slugifyForFilename } from '../utils/csv';

type PointsKind = 'operator' | 'client';

const KIND_TABS: { id: PointsKind; label: string }[] = [
  { id: 'operator', label: 'Operators' },
  { id: 'client', label: 'Clients' },
];

const PAGE_SIZE = 50;

interface PointsBalanceItem {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  balancePts: number;
  lifetimeEarnedPts: number;
  lifetimeSpentPts: number;
  meta: Record<string, unknown> | unknown;
  createdAt: string;
  updatedAt: string;
}

interface PointsBalancesPage {
  kind: PointsKind;
  items: PointsBalanceItem[];
  total: number;
  limit: number;
  offset: number;
  totals: { balancePts: number };
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPts(n: number): string {
  return n.toLocaleString();
}

export default function AdminPointsPanel() {
  const [kind, setKind] = useState<PointsKind>('operator');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PointsBalancesPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PointsBalanceItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (nextKind: PointsKind, nextOffset: number) => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const data = await api.get<PointsBalancesPage>('/admin/points/balances', {
        kind: nextKind,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setPage(data);
    } catch (err) {
      console.error('Failed to load points balances', err);
      setPage(null);
      setError('Could not load points balances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(kind, offset);
  }, [kind, offset, load]);

  const total = page?.total ?? 0;
  const balanceSum = page?.totals?.balancePts ?? 0;
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const kindLabel = KIND_TABS.find((t) => t.id === kind)?.label ?? 'Points';

  const exportPage = () => {
    if (!page || page.items.length === 0) {
      toast.error('No rows to export');
      return;
    }
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(
        `oncuts-points-${slugifyForFilename(kind)}-${stamp}.csv`,
        [
          'User ID',
          'Name',
          'Email',
          'Balance pts',
          'Lifetime earned',
          'Lifetime spent',
          'Updated',
          'Created',
        ],
        page.items.map((row) => [
          row.userId,
          row.displayName,
          row.email,
          row.balancePts,
          row.lifetimeEarnedPts,
          row.lifetimeSpentPts,
          row.updatedAt,
          row.createdAt,
        ])
      );
      toast.success(`Exported ${page.items.length} ${kind} balances`);
    } catch (err) {
      console.error(err);
      toast.error('Could not export points');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav
        className="grid gap-0.5 rounded-xl bg-stone-100 p-1"
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        aria-label="Points kinds"
      >
        {KIND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setKind(tab.id);
              setOffset(0);
              setDetail(null);
            }}
            className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold leading-tight text-center transition-colors ${
              kind === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {kindLabel} points
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {loading
                ? 'Loading…'
                : page
                  ? `${total.toLocaleString()} account${total === 1 ? '' : 's'} · ${formatPts(balanceSum)} pts total · showing ${rangeStart}–${rangeEnd}`
                  : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void load(kind, offset)}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={exporting || loading || !page?.items.length}
              onClick={exportPage}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export
            </Button>
          </div>
        </div>

        {loading && !page ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : !page || page.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            No points accounts yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="min-w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Name
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Email
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Balance
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Earned
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Spent
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-stone-50 cursor-pointer"
                      onClick={() => setDetail(row)}
                    >
                      <td className="px-2 py-1.5 text-gray-800 max-w-[160px] truncate">
                        {row.displayName || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 max-w-[180px] truncate font-mono">
                        {row.email || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 font-mono">
                        {formatPts(row.balancePts)}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 font-mono">
                        {formatPts(row.lifetimeEarnedPts)}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 font-mono">
                        {formatPts(row.lifetimeSpentPts)}
                      </td>
                      <td className="px-2 py-1.5 text-gray-800 whitespace-nowrap">
                        {formatWhen(row.updatedAt)}
                      </td>
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
                disabled={!canPrev || loading}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              <span className="text-xs text-gray-500">
                Page {Math.floor(offset / PAGE_SIZE) + 1} of{' '}
                {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canNext || loading}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </>
        )}

        {detail && (
          <div className="rounded-lg border border-gray-200 bg-stone-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">Account detail</p>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-800"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['userId', detail.userId],
                  ['displayName', detail.displayName],
                  ['email', detail.email],
                  ['balancePts', detail.balancePts],
                  ['lifetimeEarnedPts', detail.lifetimeEarnedPts],
                  ['lifetimeSpentPts', detail.lifetimeSpentPts],
                  ['createdAt', formatWhen(detail.createdAt)],
                  ['updatedAt', formatWhen(detail.updatedAt)],
                  [
                    'meta',
                    typeof detail.meta === 'string'
                      ? detail.meta
                      : JSON.stringify(detail.meta ?? {}, null, 2),
                  ],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {key}
                  </dt>
                  <dd className="text-xs text-gray-900 font-mono break-all whitespace-pre-wrap">
                    {value === null || value === undefined || value === '' ? '—' : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
