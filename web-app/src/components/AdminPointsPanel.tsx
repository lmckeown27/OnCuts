import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search } from 'lucide-react';
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

interface SearchUserItem {
  userId: string;
  email: string | null;
  role: string | null;
  displayName: string | null;
  balancePts: number;
  lifetimeEarnedPts: number;
  lifetimeSpentPts: number;
  hasAccount: boolean;
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
  const [listQuery, setListQuery] = useState('');
  const [listQueryApplied, setListQueryApplied] = useState('');
  const [page, setPage] = useState<PointsBalancesPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PointsBalanceItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<SearchUserItem | null>(null);
  const [grantPts, setGrantPts] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);

  const load = useCallback(
    async (nextKind: PointsKind, nextOffset: number, q: string) => {
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const data = await api.get<PointsBalancesPage>('/admin/points/balances', {
          kind: nextKind,
          limit: PAGE_SIZE,
          offset: nextOffset,
          q: q || undefined,
        });
        setPage(data);
      } catch (err) {
        console.error('Failed to load points balances', err);
        setPage(null);
        setError('Could not load points balances.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(kind, offset, listQueryApplied);
  }, [kind, offset, listQueryApplied, load]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await api.get<{ items: SearchUserItem[] }>('/admin/points/users', {
            kind,
            q,
          });
          if (!cancelled) setSearchResults(data?.items || []);
        } catch (err) {
          console.error('Points user search failed', err);
          if (!cancelled) setSearchResults([]);
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQ, kind]);

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

  const submitAdjust = async (signedPts: number) => {
    if (!selected) {
      toast.error('Select a user first');
      return;
    }
    if (!Number.isFinite(signedPts) || signedPts === 0) {
      toast.error('Enter a non-zero points amount');
      return;
    }
    setGrantBusy(true);
    try {
      const data = await api.post<{
        balanceAfter: number;
        deltaPts: number;
      }>('/admin/points/adjust', {
        userId: selected.userId,
        kind,
        deltaPts: signedPts,
        note: grantNote.trim() || undefined,
      });
      const nextBalance = Number(data?.balanceAfter) || 0;
      setSelected({
        ...selected,
        balancePts: nextBalance,
        hasAccount: true,
        lifetimeEarnedPts:
          signedPts > 0
            ? selected.lifetimeEarnedPts + signedPts
            : selected.lifetimeEarnedPts,
        lifetimeSpentPts:
          signedPts < 0
            ? selected.lifetimeSpentPts + Math.abs(signedPts)
            : selected.lifetimeSpentPts,
      });
      setGrantPts('');
      toast.success(
        signedPts > 0
          ? `Granted ${formatPts(signedPts)} pts (balance ${formatPts(nextBalance)})`
          : `Removed ${formatPts(Math.abs(signedPts))} pts (balance ${formatPts(nextBalance)})`
      );
      void load(kind, offset, listQueryApplied);
    } catch (err: any) {
      toast.error(err?.message || 'Could not adjust points');
    } finally {
      setGrantBusy(false);
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
              setSelected(null);
              setSearchQ('');
              setSearchResults([]);
              setGrantPts('');
              setGrantNote('');
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
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Distribute points
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Search {kindLabel.toLowerCase()} by name or email, then grant or remove points.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setSelected(null);
            }}
            placeholder={`Search ${kindLabel.toLowerCase()}…`}
            className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>

        {!selected && searchQ.trim().length >= 2 && (
          <div className="rounded-lg border border-stone-200 max-h-48 overflow-y-auto divide-y divide-stone-100">
            {searchResults.length === 0 && !searchLoading ? (
              <p className="px-3 py-3 text-sm text-gray-500">No matches</p>
            ) : (
              searchResults.map((u) => (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-stone-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {u.displayName || '—'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {u.email || u.userId} · {formatPts(u.balancePts)} pts
                    {!u.hasAccount ? ' · no account yet' : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {selected.displayName || '—'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {selected.email || selected.userId}
                  {selected.role ? ` · ${selected.role}` : ''}
                </p>
                <p className="text-xs text-gray-700 mt-1 font-mono">
                  Balance {formatPts(selected.balancePts)} pts
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-800 shrink-0"
                onClick={() => {
                  setSelected(null);
                  setGrantPts('');
                  setGrantNote('');
                }}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Points
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={grantPts}
                  onChange={(e) => setGrantPts(e.target.value)}
                  placeholder="e.g. 100"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
              </label>
              <label className="block min-w-0 flex-[1.4]">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Note (optional)
                </span>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="Reason for ledger"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={grantBusy}
                onClick={() => {
                  const n = parseInt(grantPts.trim(), 10);
                  void submitAdjust(n);
                }}
              >
                {grantBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Give points'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={grantBusy}
                onClick={() => {
                  const n = parseInt(grantPts.trim(), 10);
                  void submitAdjust(-Math.abs(n));
                }}
              >
                Remove points
              </Button>
            </div>
          </div>
        )}
      </div>

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
              onClick={() => void load(kind, offset, listQueryApplied)}
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

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setListQueryApplied(listQuery.trim());
          }}
        >
          <input
            type="search"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Filter balances by name or email…"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
          <Button type="submit" size="sm" variant="outline" disabled={loading}>
            Filter
          </Button>
        </form>

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
            {listQueryApplied
              ? 'No matching points accounts.'
              : 'No points accounts yet. Distribute points above to create one.'}
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected({
                  userId: detail.userId,
                  email: detail.email,
                  role: null,
                  displayName: detail.displayName,
                  balancePts: detail.balancePts,
                  lifetimeEarnedPts: detail.lifetimeEarnedPts,
                  lifetimeSpentPts: detail.lifetimeSpentPts,
                  hasAccount: true,
                });
                setSearchQ(detail.email || detail.displayName || detail.userId);
                setDetail(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Distribute to this user
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
