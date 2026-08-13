import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import Button from './Button';

type Audience = 'consumer' | 'operator' | 'both';
type Kind = 'system' | 'custom';
type Filter = 'all' | 'consumer' | 'operator';

export interface NotificationTemplate {
  id: string;
  key: string;
  kind: Kind;
  label: string;
  title: string;
  body: string;
  audience: Audience;
  enabled: boolean;
  last_sent_at: string | null;
  placeholders?: string[];
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  consumer: 'Consumer',
  operator: 'Operator',
  both: 'Both',
};

function matchesFilter(row: NotificationTemplate, filter: Filter): boolean {
  if (filter === 'all') return true;
  return row.audience === filter || row.audience === 'both';
}

export default function AdminNotificationControls() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftAudience, setDraftAudience] = useState<Audience>('both');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addBody, setAddBody] = useState('');
  const [addAudience, setAddAudience] = useState<Audience>('both');
  const [isCreating, setIsCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<NotificationTemplate[]>('/admin/notification-templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load notification templates', error);
      toast.error('Could not load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => templates.filter((row) => matchesFilter(row, filter)),
    [templates, filter]
  );

  const startEdit = (row: NotificationTemplate) => {
    setIsAdding(false);
    setEditingId(row.id);
    setDraftLabel(row.label);
    setDraftTitle(row.title);
    setDraftBody(row.body);
    setDraftAudience(row.audience);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (row: NotificationTemplate) => {
    setSavingId(row.id);
    try {
      const updated = await api.patch<NotificationTemplate>(
        `/admin/notification-templates/${row.id}`,
        {
          label: draftLabel.trim(),
          title: draftTitle.trim(),
          body: draftBody.trim(),
          audience: draftAudience,
        }
      );
      setTemplates((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      setEditingId(null);
      toast.success('Notification saved');
    } catch (error) {
      console.error(error);
      toast.error('Could not save notification');
    } finally {
      setSavingId(null);
    }
  };

  const toggleEnabled = async (row: NotificationTemplate) => {
    setSavingId(row.id);
    try {
      const updated = await api.patch<NotificationTemplate>(
        `/admin/notification-templates/${row.id}`,
        { enabled: !row.enabled }
      );
      setTemplates((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
    } catch (error) {
      console.error(error);
      toast.error('Could not update notification');
    } finally {
      setSavingId(null);
    }
  };

  const removeCustom = async (row: NotificationTemplate) => {
    if (row.kind !== 'custom') return;
    setSavingId(row.id);
    try {
      await api.delete(`/admin/notification-templates/${row.id}`);
      setTemplates((prev) => prev.filter((item) => item.id !== row.id));
      if (editingId === row.id) setEditingId(null);
      toast.success('Notification removed');
    } catch (error) {
      console.error(error);
      toast.error('Could not remove notification');
    } finally {
      setSavingId(null);
    }
  };

  const createCustom = async () => {
    const title = addTitle.trim();
    const body = addBody.trim();
    if (!title || !body) {
      toast.error('Title and body are required');
      return;
    }
    setIsCreating(true);
    try {
      const created = await api.post<NotificationTemplate>('/admin/notification-templates', {
        title,
        body,
        audience: addAudience,
      });
      setTemplates((prev) => [...prev, created]);
      setIsAdding(false);
      setAddTitle('');
      setAddBody('');
      setAddAudience('both');
      toast.success('Notification added');
    } catch (error) {
      console.error(error);
      toast.error('Could not add notification');
    } finally {
      setIsCreating(false);
    }
  };

  const sendCustom = async (row: NotificationTemplate) => {
    setSendingId(row.id);
    try {
      const result = await api.post<{ queued: number; audience: Audience }>(
        `/admin/notification-templates/${row.id}/send`
      );
      toast.success(`Sending to ${result?.queued ?? 0} ${result?.audience === 'both' ? 'users' : `${result?.audience}s`}`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Could not send notification');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notifications
        </p>
        <Button
          type="button"
          size="sm"
          variant={isAdding ? 'outline' : 'primary'}
          onClick={() => {
            setEditingId(null);
            setIsAdding((open) => !open);
          }}
        >
          {isAdding ? 'Cancel' : 'Add'}
        </Button>
      </div>

      <nav className="flex justify-center gap-1 rounded-xl bg-stone-100 p-1">
        {(
          [
            { id: 'all' as const, label: 'All' },
            { id: 'consumer' as const, label: 'Consumer' },
            { id: 'operator' as const, label: 'Operator' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
              filter === opt.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </nav>

      {isAdding && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">Custom announcement</p>
          <input
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <textarea
            value={addBody}
            onChange={(e) => setAddBody(e.target.value)}
            placeholder="Message"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Send to
            </legend>
            {(['consumer', 'operator', 'both'] as const).map((id) => (
              <label key={id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="add-notification-audience"
                  checked={addAudience === id}
                  onChange={() => setAddAudience(id)}
                  className="h-4 w-4 shrink-0 border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-900">{AUDIENCE_LABEL[id]}</span>
              </label>
            ))}
          </fieldset>
          <Button type="button" size="sm" disabled={isCreating} onClick={() => void createCustom()}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500">No notifications for this filter.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => {
            const isEditing = editingId === row.id;
            const busy = savingId === row.id || sendingId === row.id;
            return (
              <div key={row.id} className="rounded-lg border border-gray-200 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.kind === 'system' ? 'Automatic' : 'Custom'} · {AUDIENCE_LABEL[row.audience]}
                      {row.last_sent_at
                        ? ` · Sent ${new Date(row.last_sent_at).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    disabled={busy}
                    onClick={() => void toggleEnabled(row)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      row.enabled ? 'bg-brand-500' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        row.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      aria-label="Label"
                    />
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      aria-label="Title"
                    />
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      aria-label="Body"
                    />
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Audience
                      </legend>
                      {(['consumer', 'operator', 'both'] as const).map((id) => (
                        <label key={id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`edit-audience-${row.id}`}
                            checked={draftAudience === id}
                            onChange={() => setDraftAudience(id)}
                            className="h-4 w-4 shrink-0 border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          <span className="text-sm text-gray-900">{AUDIENCE_LABEL[id]}</span>
                        </label>
                      ))}
                    </fieldset>
                    {row.kind === 'system' && row.placeholders && row.placeholders.length > 0 && (
                      <p className="text-xs text-gray-500">
                        Placeholders: {row.placeholders.map((name) => `{{${name}}}`).join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void saveEdit(row)}
                      >
                        {savingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-900">{row.title}</p>
                    <p className="text-xs text-gray-500">{row.body}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                      {row.kind === 'custom' && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || !row.enabled}
                            onClick={() => void sendCustom(row)}
                          >
                            {sendingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Send'
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void removeCustom(row)}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
