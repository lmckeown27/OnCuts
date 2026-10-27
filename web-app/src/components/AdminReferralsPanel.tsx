import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.service';

type AttributionRow = {
  id: string;
  referrerKind: string;
  check2Status: string;
  check2Flags: Record<string, unknown>;
  qualifyingBookingCount: number;
  m1AwardedAt: string | null;
  m2AwardedAt: string | null;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  referredEmail: string;
  codeSnapshot: string;
  createdAt: string;
};

type ReferralSettings = {
  programEnabled: boolean;
  pointsPerDollar: number;
  operatorM1: number;
  operatorM2: number;
  clientM1: number;
  clientM2: number;
  holdDays: number;
  qualifyWindowDays: number;
  minBookingCents: number;
  newOpKickbackPercent: number;
  maxSpendPercent: number;
  rotationsPerDay: number;
  maxUsesPerMonth: number;
  validateMaxAttempts: number;
  validateLockoutHours: number;
  promptCooldownDays: number;
  promptMaxDismissals: number;
  adminIndefinitePrompts: boolean;
  pointsVisible: boolean;
  estimatedCostPerNewOperatorPts?: number;
  estimatedCostPerNewOperatorDollars?: number;
};

export default function AdminReferralsPanel() {
  const [tab, setTab] = useState<'ledger' | 'settings'>('ledger');
  const [items, setItems] = useState<AttributionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('admin_review');
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadLedger = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<{ items: AttributionRow[] }>('/admin/referrals/attributions', {
        status: statusFilter || undefined,
        limit: 100,
      });
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load ledger');
    }
  }, [statusFilter]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get<ReferralSettings>('/admin/referrals/settings');
      setSettings(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    if (tab === 'ledger') void loadLedger();
    else void loadSettings();
  }, [tab, loadLedger, loadSettings]);

  const resolve = async (id: string, decision: 'approve' | 'reject') => {
    try {
      setBusy(true);
      await api.post(`/admin/referrals/attributions/${id}/resolve`, { decision });
      await loadLedger();
    } catch (e: any) {
      setError(e?.message || 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setBusy(true);
      const res = await api.put<ReferralSettings>('/admin/referrals/settings', settings);
      setSettings(res);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('ledger')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === 'ledger' ? 'bg-brand-600 text-white' : 'bg-stone-100 text-gray-700'
          }`}
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === 'settings' ? 'bg-brand-600 text-white' : 'bg-stone-100 text-gray-700'
          }`}
        >
          Settings
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status</label>
            <select
              className="rounded-lg border border-stone-300 text-sm px-2 py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="admin_review">Admin review</option>
              <option value="pending">Pending</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="">All</option>
            </select>
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="text-sm text-brand-700 font-medium"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Referred</th>
                  <th className="px-3 py-2">Referrer</th>
                  <th className="px-3 py-2">Check 2</th>
                  <th className="px-3 py-2">Bookings</th>
                  <th className="px-3 py-2">Flags</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.referredName}</div>
                      <div className="text-xs text-gray-500">{row.referredEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {row.referrerName}{' '}
                        <span className="text-xs text-gray-500">({row.referrerKind})</span>
                      </div>
                      <div className="text-xs text-gray-500">{row.codeSnapshot}</div>
                    </td>
                    <td className="px-3 py-2">{row.check2Status}</td>
                    <td className="px-3 py-2">{row.qualifyingBookingCount}/3</td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[180px]">
                      {Object.keys(row.check2Flags || {})
                        .filter((k) => row.check2Flags[k])
                        .join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                      {row.check2Status === 'admin_review' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void resolve(row.id, 'approve')}
                            className="text-emerald-700 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void resolve(row.id, 'reject')}
                            className="text-red-700 font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      No attributions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && settings && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4 max-w-2xl">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.programEnabled}
              onChange={(e) => setSettings({ ...settings, programEnabled: e.target.checked })}
            />
            Program enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.adminIndefinitePrompts}
              onChange={(e) =>
                setSettings({ ...settings, adminIndefinitePrompts: e.target.checked })
              }
            />
            Admin indefinite referral prompts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.pointsVisible}
              onChange={(e) =>
                setSettings({ ...settings, pointsVisible: e.target.checked })
              }
            />
            Points visible in app
          </label>
          {(
            [
              ['pointsPerDollar', 'Points per $', false],
              ['operatorM1', 'Operator M1 pts', false],
              ['operatorM2', 'Operator M2 pts', false],
              ['clientM1', 'Client M1 pts', false],
              ['clientM2', 'Client M2 pts', false],
              ['holdDays', 'Hold days', true],
              ['qualifyWindowDays', 'Qualify window days', true],
              ['minBookingCents', 'Min booking cents', false],
              ['newOpKickbackPercent', 'New op kickback %', false],
              ['maxSpendPercent', 'Max spend %', false],
              ['rotationsPerDay', 'Rotations / day', true],
              ['maxUsesPerMonth', 'Max uses / month', true],
              ['validateMaxAttempts', 'Validate max attempts', true],
              ['validateLockoutHours', 'Lockout hours', true],
              ['promptCooldownDays', 'Prompt cooldown days', true],
              ['promptMaxDismissals', 'Prompt max dismissals', true],
            ] as const
          ).map(([key, label, unlimitedable]) => {
            const unlimited = unlimitedable && Number(settings[key]) === 0;
            return (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <label className="text-gray-700">{label}</label>
                <div className="flex items-center gap-3">
                  {unlimitedable && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                      <input
                        type="checkbox"
                        checked={unlimited}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSettings({ ...settings, [key]: 0 });
                          } else {
                            const defaults: Partial<ReferralSettings> = {
                              holdDays: 7,
                              qualifyWindowDays: 60,
                              rotationsPerDay: 3,
                              maxUsesPerMonth: 10,
                              validateMaxAttempts: 5,
                              validateLockoutHours: 24,
                              promptCooldownDays: 30,
                              promptMaxDismissals: 3,
                            };
                            setSettings({
                              ...settings,
                              [key]: defaults[key] ?? 1,
                            });
                          }
                        }}
                      />
                      Unlimited
                    </label>
                  )}
                  <input
                    type="number"
                    min={unlimitedable ? 0 : undefined}
                    disabled={unlimited}
                    className="w-32 rounded-lg border border-stone-300 px-2 py-1.5 disabled:bg-stone-100 disabled:text-gray-500"
                    value={Number(settings[key])}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            );
          })}
          {settings.estimatedCostPerNewOperatorDollars != null && (
            <p className="text-xs text-gray-500">
              Est. cost per new operator (points side): $
              {settings.estimatedCostPerNewOperatorDollars.toFixed(2)} (
              {settings.estimatedCostPerNewOperatorPts} pts) plus kickback.
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSettings()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold"
          >
            Save settings
          </button>
        </div>
      )}
    </div>
  );
}
