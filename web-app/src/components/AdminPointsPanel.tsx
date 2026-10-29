import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';
import { downloadCsv, slugifyForFilename } from '../utils/csv';
import { notifyPointsBalanceChanged } from '../utils/pointsBalanceEvents';

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
  role?: string | null;
  balancePts: number;
  lifetimeEarnedPts: number;
  lifetimeSpentPts: number;
  lifetimeRevokedPts: number;
  welcomeClaimed: boolean;
  meta: Record<string, unknown> | unknown;
  createdAt: string;
  updatedAt: string;
}

interface PointsLedgerEntry {
  id: string;
  deltaPts: number;
  balanceAfterPts: number;
  reason: string;
  referralAttributionId?: string | null;
  bookingId?: string | null;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

interface AcquisitionBucket {
  key: string;
  label: string;
  pts: number;
  count: number;
}

interface UserPointsBalances {
  userId: string;
  role: string | null;
  displayName: string | null;
  email: string | null;
  welcomeClaimed: boolean;
  availableKinds: PointsKind[];
  operator: PointsBalanceItem | null;
  client: PointsBalanceItem | null;
  history?: {
    operator: PointsLedgerEntry[];
    client: PointsLedgerEntry[];
  };
  acquisition?: {
    operator: AcquisitionBucket[];
    client: AcquisitionBucket[];
  };
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
  lifetimeRevokedPts: number;
  welcomeClaimed: boolean;
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

function formatLedgerReason(reason: string): string {
  if (reason === 'admin_welcome_claim') return 'Welcome claim';
  if (reason === 'referral_m1') return 'Referral M1 (onboarding)';
  if (reason === 'referral_m2') return 'Referral M2 (3 paid bookings)';
  if (reason === 'referral_m2_clawback') return 'Referral M2 revokal';
  if (reason === 'admin_grant') return 'Admin gift';
  if (reason === 'admin_clawback') return 'Admin revokal';
  return reason.replace(/_/g, ' ').replace(/\bclawback\b/gi, 'revokal').replace(/\bgrant\b/gi, 'gift');
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
  const [detailAccounts, setDetailAccounts] = useState<UserPointsBalances | null>(null);
  const [detailAdjustKind, setDetailAdjustKind] = useState<PointsKind>('operator');
  const [exporting, setExporting] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<SearchUserItem | null>(null);
  const [grantPts, setGrantPts] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);
  const [detailPts, setDetailPts] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);

  const clearDetail = useCallback(() => {
    setDetail(null);
    setDetailAccounts(null);
    setDetailPts('');
  }, []);

  const openDetail = useCallback(
    async (row: PointsBalanceItem, preferKind: PointsKind) => {
      setDetail(row);
      setDetailPts('');
      setDetailAdjustKind(preferKind);
      setDetailAccounts(null);
      try {
        const data = await api.get<UserPointsBalances>('/admin/points/user-balances', {
          userId: row.userId,
        });
        setDetailAccounts(data);
        const kinds = data?.availableKinds?.length
          ? data.availableKinds
          : ([preferKind] as PointsKind[]);
        setDetailAdjustKind(kinds.includes(preferKind) ? preferKind : kinds[0]);
        const active = preferKind === 'operator' ? data?.operator : data?.client;
        if (active) {
          setDetail({ ...active, role: data?.role ?? active.role });
        } else {
          setDetail({ ...row, role: data?.role ?? row.role });
        }
      } catch (err) {
        console.error('Failed to load user point balances', err);
      }
    },
    []
  );

  const load = useCallback(
    async (
      nextKind: PointsKind,
      nextOffset: number,
      q: string,
      opts?: { keepDetail?: boolean }
    ) => {
      setLoading(true);
      setError(null);
      if (!opts?.keepDetail) {
        setDetail(null);
        setDetailAccounts(null);
        setDetailPts('');
      }
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
          'Lifetime revoked',
          'Welcome claimed',
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
          row.lifetimeRevokedPts ?? 0,
          row.welcomeClaimed ? 'yes' : 'no',
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

  const refreshDetailAccounts = useCallback(async (userId: string, preferKind: PointsKind) => {
    try {
      const data = await api.get<UserPointsBalances>('/admin/points/user-balances', {
        userId,
      });
      setDetailAccounts(data);
      const active = preferKind === 'operator' ? data?.operator : data?.client;
      if (active) {
        setDetail({
          ...active,
          role: data?.role ?? active.role,
          welcomeClaimed: data?.welcomeClaimed ?? active.welcomeClaimed,
        });
      } else if (data) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                role: data.role ?? prev.role,
                welcomeClaimed: data.welcomeClaimed,
                balancePts: 0,
                lifetimeEarnedPts: 0,
                lifetimeSpentPts: 0,
                lifetimeRevokedPts: 0,
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Failed to refresh user point balances', err);
    }
  }, []);

  const submitAdjust = async (
    target: { userId: string },
    adjustKind: PointsKind,
    signedPts: number,
    opts?: { source: 'distribute' | 'detail' }
  ) => {
    if (!Number.isFinite(signedPts) || !Number.isInteger(signedPts) || signedPts === 0) {
      toast.error('Enter a non-zero whole number of points');
      return;
    }
    const busy = opts?.source === 'detail' ? setDetailBusy : setGrantBusy;
    busy(true);
    try {
      const data = await api.post<{
        balanceAfter: number;
        deltaPts: number;
      }>('/admin/points/adjust', {
        userId: target.userId,
        kind: adjustKind,
        deltaPts: signedPts,
      });
      const nextBalance = Number(data?.balanceAfter) || 0;
      if (opts?.source !== 'detail' && selected?.userId === target.userId) {
        setSelected({
          ...selected,
          balancePts: nextBalance,
          hasAccount: true,
          lifetimeEarnedPts:
            signedPts > 0
              ? selected.lifetimeEarnedPts + signedPts
              : selected.lifetimeEarnedPts,
          lifetimeRevokedPts:
            signedPts < 0
              ? (selected.lifetimeRevokedPts || 0) + Math.abs(signedPts)
              : selected.lifetimeRevokedPts || 0,
        });
        setGrantPts('');
      }
      if (opts?.source === 'detail' && detail?.userId === target.userId) {
        setDetailPts('');
        await refreshDetailAccounts(target.userId, adjustKind);
      }
      notifyPointsBalanceChanged({
        userId: target.userId,
        kind: adjustKind,
        balancePts: nextBalance,
      });
      toast.success(
        signedPts > 0
          ? `Granted ${formatPts(signedPts)} ${adjustKind} pts (balance ${formatPts(nextBalance)})`
          : `Revoked ${formatPts(Math.abs(signedPts))} ${adjustKind} pts (balance ${formatPts(nextBalance)})`
      );
      void load(kind, offset, listQueryApplied, {
        keepDetail: opts?.source === 'detail',
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not adjust points');
    } finally {
      busy(false);
    }
  };

  const detailAvailableKinds: PointsKind[] =
    detailAccounts?.availableKinds?.length
      ? detailAccounts.availableKinds
      : detail
        ? [kind]
        : [];
  const detailIsDual = detailAvailableKinds.length > 1;
  const detailActiveAccount =
    detailAdjustKind === 'operator'
      ? detailAccounts?.operator ?? (kind === 'operator' ? detail : null)
      : detailAccounts?.client ?? (kind === 'client' ? detail : null);
  const detailActiveBalance = detailActiveAccount?.balancePts ?? 0;

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
              clearDetail();
              setSelected(null);
              setSearchResults([]);
              setGrantPts('');
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
            Distribute {kind === 'operator' ? 'OPERATOR' : 'CLIENT'} points
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
            placeholder={`Search ${kind === 'operator' ? 'operators' : 'clients'}…`}
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
                  {` · ${kind} points`}
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
                }}
              >
                Clear
              </button>
            </div>
            <label className="block w-24 mx-auto">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Points
              </span>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                step={1}
                value={grantPts}
                onChange={(e) => setGrantPts(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                }}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                type="button"
                size="sm"
                disabled={grantBusy}
                onClick={() => {
                  const n = parseInt(grantPts.trim(), 10);
                  void submitAdjust(selected, kind, n, { source: 'distribute' });
                }}
              >
                {grantBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Select Points'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={grantBusy || selected.balancePts <= 0}
                onClick={() => {
                  const n = parseInt(grantPts.trim(), 10);
                  void submitAdjust(selected, kind, -Math.abs(n), {
                    source: 'distribute',
                  });
                }}
              >
                Remove Select Points
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={grantBusy || selected.balancePts <= 0}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove all ${formatPts(selected.balancePts)} pts from ${
                        selected.displayName || selected.email || 'this user'
                      }?`
                    )
                  ) {
                    return;
                  }
                  void submitAdjust(selected, kind, -selected.balancePts, {
                    source: 'distribute',
                  });
                }}
              >
                Remove all
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
                      Revoked
                    </th>
                    <th className="px-2 py-2 font-semibold text-gray-500 whitespace-nowrap sticky top-0 bg-white">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((row) => {
                    const isOpen = detail?.userId === row.userId;
                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        className={`border-b border-gray-100 hover:bg-stone-50 cursor-pointer ${
                          isOpen ? 'bg-stone-50' : ''
                        }`}
                        onClick={() => {
                          if (isOpen) {
                            clearDetail();
                          } else {
                            void openDetail(row, kind);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isOpen) {
                              clearDetail();
                            } else {
                              void openDetail(row, kind);
                            }
                          }
                        }}
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
                        <td className="px-2 py-1.5 text-gray-800 font-mono">
                          {formatPts(row.lifetimeRevokedPts ?? 0)}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800 whitespace-nowrap">
                          {formatWhen(row.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
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
          <div className="rounded-lg border border-gray-200 bg-stone-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">Account detail</p>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-800"
                onClick={clearDetail}
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
                  ['role', detail.role || detailAccounts?.role || '—'],
                  ...(detailIsDual
                    ? ([
                        [
                          'operatorBalancePts',
                          detailAccounts?.operator
                            ? formatPts(detailAccounts.operator.balancePts)
                            : '0 (no account)',
                        ],
                        [
                          'clientBalancePts',
                          detailAccounts?.client
                            ? formatPts(detailAccounts.client.balancePts)
                            : '0 (no account)',
                        ],
                        [
                          'operatorLifetimeEarnedPts',
                          detailAccounts?.operator
                            ? formatPts(detailAccounts.operator.lifetimeEarnedPts)
                            : '0',
                        ],
                        [
                          'clientLifetimeEarnedPts',
                          detailAccounts?.client
                            ? formatPts(detailAccounts.client.lifetimeEarnedPts)
                            : '0',
                        ],
                        [
                          'operatorLifetimeSpentPts',
                          detailAccounts?.operator
                            ? formatPts(detailAccounts.operator.lifetimeSpentPts)
                            : '0',
                        ],
                        [
                          'clientLifetimeSpentPts',
                          detailAccounts?.client
                            ? formatPts(detailAccounts.client.lifetimeSpentPts)
                            : '0',
                        ],
                        [
                          'operatorLifetimeRevokedPts',
                          detailAccounts?.operator
                            ? formatPts(detailAccounts.operator.lifetimeRevokedPts ?? 0)
                            : '0',
                        ],
                        [
                          'clientLifetimeRevokedPts',
                          detailAccounts?.client
                            ? formatPts(detailAccounts.client.lifetimeRevokedPts ?? 0)
                            : '0',
                        ],
                      ] as const)
                    : ([
                        ['balancePts', detail.balancePts],
                        ['lifetimeEarnedPts', detail.lifetimeEarnedPts],
                        ['lifetimeSpentPts', detail.lifetimeSpentPts],
                        ['lifetimeRevokedPts', detail.lifetimeRevokedPts ?? 0],
                      ] as const)),
                  [
                    'welcomeClaim',
                    (detailAccounts?.welcomeClaimed ?? detail.welcomeClaimed)
                      ? 'Claimed'
                      : 'Not claimed',
                  ],
                  ['createdAt', formatWhen(detail.createdAt)],
                  ['updatedAt', formatWhen(detail.updatedAt)],
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

            {(() => {
              const acquisition =
                (detailAdjustKind === 'operator'
                  ? detailAccounts?.acquisition?.operator
                  : detailAccounts?.acquisition?.client) || [];
              const history =
                (detailAdjustKind === 'operator'
                  ? detailAccounts?.history?.operator
                  : detailAccounts?.history?.client) || [];
              return (
                <div className="border-t border-stone-200 pt-3 space-y-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    How points were acquired ({detailAdjustKind})
                  </p>
                  {acquisition.length === 0 ? (
                    <p className="text-xs text-gray-500">No earned points recorded yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {acquisition.map((bucket) => (
                        <li
                          key={bucket.key}
                          className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
                        >
                          <span className="min-w-0 text-gray-800">
                            <span className="font-semibold text-gray-900">{bucket.label}</span>
                            <span className="text-gray-500">
                              {' '}
                              · {bucket.count} time{bucket.count === 1 ? '' : 's'}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-emerald-700">
                            +{formatPts(bucket.pts)} pts
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide pt-1">
                    Ledger history
                  </p>
                  {history.length === 0 ? (
                    <p className="text-xs text-gray-500">No ledger entries.</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                      {history.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {formatLedgerReason(entry.reason)}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {formatWhen(entry.createdAt)}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 font-semibold tabular-nums ${
                              entry.deltaPts > 0 ? 'text-emerald-700' : 'text-gray-800'
                            }`}
                          >
                            {entry.deltaPts > 0 ? '+' : ''}
                            {formatPts(entry.deltaPts)} pts
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-stone-200 pt-3 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Give or remove points
              </p>
              {detailIsDual && (
                <nav
                  className="grid gap-0.5 rounded-lg bg-stone-100 p-1 max-w-xs mx-auto"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                  aria-label="Detail points kind"
                >
                  {detailAvailableKinds.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setDetailAdjustKind(k);
                        setDetailPts('');
                        const account =
                          k === 'operator' ? detailAccounts?.operator : detailAccounts?.client;
                        if (account) {
                          setDetail({
                            ...account,
                            role: detailAccounts?.role ?? account.role,
                            welcomeClaimed:
                              detailAccounts?.welcomeClaimed ?? account.welcomeClaimed,
                          });
                        }
                      }}
                      className={`px-2 py-1.5 rounded-md text-xs font-semibold text-center transition-colors ${
                        detailAdjustKind === k
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {k === 'operator' ? 'Operator' : 'Client'}
                    </button>
                  ))}
                </nav>
              )}
              {!detailIsDual && (
                <p className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {detailAdjustKind} points
                </p>
              )}
              <label className="block w-24 mx-auto">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Points
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  step={1}
                  value={detailPts}
                  onChange={(e) => setDetailPts(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                  }}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  type="button"
                  size="sm"
                  disabled={detailBusy}
                  onClick={() => {
                    const n = parseInt(detailPts.trim(), 10);
                    void submitAdjust(detail, detailAdjustKind, n, { source: 'detail' });
                  }}
                >
                  {detailBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Select Points'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={detailBusy || detailActiveBalance <= 0}
                  onClick={() => {
                    const n = parseInt(detailPts.trim(), 10);
                    void submitAdjust(detail, detailAdjustKind, -Math.abs(n), {
                      source: 'detail',
                    });
                  }}
                >
                  Remove Select Points
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={detailBusy || detailActiveBalance <= 0}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Remove all ${formatPts(detailActiveBalance)} ${detailAdjustKind} pts from ${
                          detail.displayName || detail.email || 'this user'
                        }?`
                      )
                    ) {
                      return;
                    }
                    void submitAdjust(detail, detailAdjustKind, -detailActiveBalance, {
                      source: 'detail',
                    });
                  }}
                >
                  Remove all
                </Button>
              </div>
              {(detailAccounts?.welcomeClaimed ?? detail.welcomeClaimed) && (
                <div className="pt-1 flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={detailBusy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Reset welcome claim for ${
                            detail.displayName || detail.email || 'this user'
                          }? They will be able to Claim again. Balance is unchanged.`
                        )
                      ) {
                        return;
                      }
                      void (async () => {
                        setDetailBusy(true);
                        try {
                          await api.post('/admin/points/reset-welcome-claim', {
                            userId: detail.userId,
                          });
                          setDetail({ ...detail, welcomeClaimed: false });
                          setDetailAccounts((prev) =>
                            prev ? { ...prev, welcomeClaimed: false } : prev
                          );
                          toast.success('Welcome claim reset');
                          void load(kind, offset, listQueryApplied, { keepDetail: true });
                        } catch (err: any) {
                          toast.error(err?.message || 'Could not reset welcome claim');
                        } finally {
                          setDetailBusy(false);
                        }
                      })();
                    }}
                  >
                    Reset Welcome Claim
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
