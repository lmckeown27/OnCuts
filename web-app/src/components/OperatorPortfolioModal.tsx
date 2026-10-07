import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import api from '../services/api.service';
import barberService from '../services/barber.service';
import { SERVICE_TYPES, type ServiceType } from '../config/services';
import { useBodyScrollLock } from '../hooks';
import WebcamCapture from './WebcamCapture';

export interface OperatorPortfolioItem {
  id: string;
  provider_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  sort_order: number;
  created_at: string;
  specialties?: string[];
  booking_id?: string | null;
}

interface OperatorPortfolioModalProps {
  providerId: string;
  visible: boolean;
  onClose: () => void;
}

type SlotKind = 'image' | 'video';

interface DraftCapture {
  kind: SlotKind;
  file: File;
  previewUrl: string;
  replaceId: string | null;
}

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 80 * 1024 * 1024;

function uploadErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { error?: { message?: string } | string } } })?.response;
  const body = response?.data?.error;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object' && body.message) return body.message;
  return 'Could not update your portfolio. Try again.';
}

function specialtyIds(item: OperatorPortfolioItem | null | undefined): string[] {
  return Array.isArray(item?.specialties) ? item.specialties.filter((id) => typeof id === 'string' && id) : [];
}

function specialtyLabel(id: string, options: ServiceType[]): string {
  return options.find((option) => option.id === id)?.name || id;
}

export default function OperatorPortfolioModal({
  providerId,
  visible,
  onClose,
}: OperatorPortfolioModalProps) {
  const [items, setItems] = useState<OperatorPortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ServiceType[]>([]);
  const [sourceMenu, setSourceMenu] = useState<{ kind: SlotKind; key: string } | null>(null);
  const [cameraKind, setCameraKind] = useState<SlotKind | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCapture | null>(null);
  const [editing, setEditing] = useState<OperatorPortfolioItem | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [tagSelection, setTagSelection] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useBodyScrollLock(visible);

  const revoke = (url: string) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

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
    if (visible && providerId) void loadItems();
  }, [visible, providerId, loadItems]);

  useEffect(() => {
    if (!visible || !providerId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const barber = await barberService.getBarberById(providerId);
        const kind = (barber.provider_type || 'barber').toLowerCase() === 'beauty' ? 'beauty' : 'barber';
        const offered = new Set(
          (barber.pricing || [])
            .map((entry) => entry.name?.trim().toLowerCase())
            .filter(Boolean) as string[]
        );
        (barber.specialties || []).forEach((name) => offered.add(name.trim().toLowerCase()));
        const matched = SERVICE_TYPES.filter((service) => {
          if ((service.providerType || 'barber') !== kind) return false;
          return offered.has(service.name.toLowerCase()) || offered.has(service.id.toLowerCase());
        });
        if (!cancelled) {
          setOptions(matched.length > 0 ? matched : SERVICE_TYPES.filter((service) => (service.providerType || 'barber') === kind));
        }
      } catch {
        if (!cancelled) setOptions(SERVICE_TYPES.filter((service) => (service.providerType || 'barber') === 'barber'));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [visible, providerId]);

  useEffect(() => {
    return () => {
      if (draftRef.current) revoke(draftRef.current.previewUrl);
    };
  }, []);

  const photos = items.filter((item) => item.media_type === 'image');
  const videos = items.filter((item) => item.media_type === 'video');
  const photoSlotCount = Math.max(4, photos.length + 1);
  const videoSlotCount = Math.max(1, videos.length + 1);

  const closeTag = (dropDraft: boolean) => {
    if (dropDraft && draft) {
      revoke(draft.previewUrl);
      setDraft(null);
    }
    setTagOpen(false);
    setEditing(null);
    setReplaceId(null);
    setTagSelection([]);
  };

  const openTagForItem = (item: OperatorPortfolioItem) => {
    setEditing(item);
    setReplaceId(item.id);
    setTagSelection(specialtyIds(item));
    setSourceMenu(null);
    setTagOpen(true);
    setError(null);
  };

  const stageFile = (kind: SlotKind, file: File) => {
    const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      setCameraKind(null);
      setSourceMenu(null);
      setError(kind === 'image' ? 'Photos must be 8 MB or smaller' : 'Videos must be 80 MB or smaller');
      return;
    }
    if (draft) revoke(draft.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const nextReplaceId = replaceId;
    setDraft({ kind, file, previewUrl, replaceId: nextReplaceId });
    setCameraKind(null);
    setSourceMenu(null);
    setEditing(items.find((item) => item.id === nextReplaceId) || null);
    setTagSelection(specialtyIds(items.find((item) => item.id === nextReplaceId)));
    setTagOpen(true);
    setError(null);
  };

  const saveTags = async () => {
    if (tagSelection.length < 1 || saving || !providerId) return;
    setSaving(true);
    setError(null);
    try {
      if (draft) {
        const form = new FormData();
        form.append('media', draft.file);
        form.append('specialties', JSON.stringify(tagSelection));
        const created = await api.upload<OperatorPortfolioItem>(`/barbers/${providerId}/operator-portfolio`, form);
        if (draft.replaceId) {
          await api.delete(`/barbers/${providerId}/operator-portfolio/${draft.replaceId}`);
          setItems((current) => current.filter((item) => item.id !== draft.replaceId));
        }
        if (created?.id) {
          setItems((current) => [...current.filter((item) => item.id !== created.id && item.id !== draft.replaceId), created]);
        } else {
          await loadItems();
        }
        revoke(draft.previewUrl);
        setDraft(null);
        setReplaceId(null);
      } else if (editing) {
        const updated = await api.patch<OperatorPortfolioItem>(
          `/barbers/${providerId}/operator-portfolio/${editing.id}`,
          { specialties: tagSelection }
        );
        setItems((current) => current.map((item) => (item.id === editing.id ? { ...item, ...updated, specialties: tagSelection } : item)));
      }
      closeTag(false);
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!providerId || saving) return;
    setError(null);
    try {
      await api.delete(`/barbers/${providerId}/operator-portfolio/${itemId}`);
      setItems((current) => current.filter((item) => item.id !== itemId));
      if (editing?.id === itemId) closeTag(true);
    } catch (err) {
      setError(uploadErrorMessage(err));
    }
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      if (cameraKind) {
        setCameraKind(null);
        return;
      }
      if (sourceMenu) {
        setSourceMenu(null);
        return;
      }
      if (tagOpen) {
        closeTag(true);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!sourceMenu) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-source-menu]') || target.closest('[data-slot-button]')) return;
      setSourceMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [sourceMenu]);

  const trapTab = (event: ReactKeyboardEvent, root: HTMLElement | null) => {
    if (event.key !== 'Tab' || !root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, textarea')).filter(
      (node) => !node.hasAttribute('disabled')
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderEmptySlot = (kind: SlotKind, key: string, isNext: boolean, label: string) => (
    <div key={key} className={`relative ${kind === 'video' ? 'w-[150px]' : ''}`}>
      <button
        type="button"
        data-slot-button
        disabled={!providerId || saving}
        onClick={() => {
          setReplaceId(null);
          setSourceMenu({ kind, key });
        }}
        className={`relative block w-full overflow-hidden rounded-xl aspect-[9/16] ${
          sourceMenu?.key === key
            ? 'border border-dashed border-[#737373] bg-[#f5f5f5]'
            : isNext
              ? 'border border-dashed border-[#737373] bg-white'
              : 'border border-dashed border-[#d4d4d4] bg-white'
        }`}
        aria-label={label}
      >
        <span className="flex h-full flex-col items-center justify-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isNext ? 'bg-[#171717] text-white' : 'bg-[#e5e5e5] text-[#737373]'}`}>
            <Plus className="h-5 w-5" />
          </span>
          {isNext && <span className="text-xs font-medium text-[#525252]">{kind === 'video' ? 'Add video' : 'Add'}</span>}
        </span>
      </button>
      {sourceMenu?.key === key && (
        <div data-source-menu className="absolute left-1/2 top-[58%] z-10 w-[210px] -translate-x-1/2 rounded-xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <p className="px-2 py-1.5 text-xs font-semibold text-[#737373]">{kind === 'video' ? 'Add video' : label}</p>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
            onClick={() => {
              setCameraNote(null);
              setCameraKind(kind);
              setSourceMenu(null);
            }}
          >
            Use camera
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload from computer
          </button>
        </div>
      )}
    </div>
  );

  const renderFilled = (item: OperatorPortfolioItem, index: number) => {
    const names = specialtyIds(item).map((id) => specialtyLabel(id, options)).join(' · ');
    const kind = item.media_type;
    return (
      <div key={item.id} className={`relative ${kind === 'video' ? 'w-[150px]' : ''}`}>
        <button
          type="button"
          data-slot-button
          onClick={() => openTagForItem(item)}
          className="relative block w-full overflow-hidden rounded-xl border border-[#e5e5e5] aspect-[9/16]"
          aria-label={`${kind === 'video' ? 'Video' : `Photo ${index + 1}`}, ${names || 'untagged'} — edit`}
        >
          {kind === 'video' ? (
            <video src={item.media_url} className="h-full w-full object-cover" muted />
          ) : (
            <img src={item.media_url} alt="" className="h-full w-full object-cover" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void removeItem(item.id)}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#171717] shadow"
          aria-label={kind === 'video' ? 'Remove video' : `Remove photo ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
        {names && <p className="mt-2 truncate text-xs text-[#525252]">{names}</p>}
        {sourceMenu?.key === `item-${item.id}` && (
          <div data-source-menu className="absolute left-1/2 top-[58%] z-10 w-[210px] -translate-x-1/2 rounded-xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <p className="px-2 py-1.5 text-xs font-semibold text-[#737373]">{kind === 'video' ? 'Add video' : `Add photo ${index + 1}`}</p>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
              onClick={() => {
                setCameraNote(null);
                setCameraKind(kind);
                setSourceMenu(null);
              }}
            >
              Use camera
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload from computer
            </button>
          </div>
        )}
      </div>
    );
  };

  const previewUrl = draft?.previewUrl || editing?.media_url || '';
  const previewKind: SlotKind = draft?.kind || editing?.media_type || 'image';
  const taggedId = draft?.replaceId || editing?.id;
  const taggedIndex = taggedId ? photos.findIndex((item) => item.id === taggedId) : -1;
  const tagLabel = previewKind === 'video' ? 'Video' : `Photo ${(taggedIndex >= 0 ? taggedIndex : photos.length) + 1}`;

  const dialog = (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 transition-colors duration-150 ${
        visible ? 'bg-[rgba(23,23,23,0.45)]' : 'bg-transparent'
      }`}
      onClick={() => {
        if (!saving && !tagOpen && !cameraKind) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portfolio"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapTab(event, dialogRef.current)}
        className={`flex max-h-[95dvh] w-full max-w-[880px] flex-col overflow-y-auto rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)] transition-all duration-150 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8">
          <div>
            <h2 className="text-2xl font-bold text-[#171717]">Portfolio</h2>
            <p className="mt-1 text-sm text-[#525252]">Click a slot to take or upload one. You'll tag the specialty after each upload.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#171717] hover:bg-black/5"
            aria-label="Close portfolio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {!providerId && <p className="text-sm text-amber-700">Your operator profile is still loading.</p>}
          {cameraNote && <p className="mb-3 text-sm text-[#525252]">{cameraNote}</p>}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loading && <p className="mb-3 text-sm text-[#737373]">Loading portfolio…</p>}

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <section className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#171717]">Photos</h3>
                <span className="text-xs text-[#737373]">{photos.length}{photos.length < 4 ? ' of 4' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
                {Array.from({ length: photoSlotCount }, (_, index) => {
                  const item = photos[index];
                  if (item) return renderFilled(item, index);
                  return renderEmptySlot('image', `photo-empty-${index}`, index === photos.length, `Add photo ${index + 1}`);
                })}
              </div>
            </section>
            <section>
              <div className="mb-3 flex w-[150px] items-center justify-between">
                <h3 className="text-sm font-semibold text-[#171717]">Video</h3>
                <span className="text-xs text-[#737373]">{videos.length}{videos.length < 1 ? ' of 1' : ''}</span>
              </div>
              <div className="flex flex-col gap-[14px]">
                {Array.from({ length: videoSlotCount }, (_, index) => {
                  const item = videos[index];
                  if (item) return renderFilled(item, index);
                  return renderEmptySlot('video', `video-empty-${index}`, index === videos.length, 'Add video');
                })}
              </div>
            </section>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={sourceMenu?.kind === 'video' || cameraKind === 'video' ? VIDEO_ACCEPT : PHOTO_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            const kind = sourceMenu?.kind || (replaceId ? editing?.media_type : null);
            if (file && kind) stageFile(kind, file);
          }}
        />
      </div>
    </div>
  );

  const tagModal = tagOpen && previewUrl && (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(23,23,23,0.45)] p-4"
      onClick={() => {
        if (!saving) closeTag(true);
      }}
    >
      <div
        ref={tagRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-tag-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapTab(event, tagRef.current)}
        className="flex w-full max-w-[680px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
      >
        <div className="hidden w-[280px] shrink-0 bg-[#f5f5f5] p-6 sm:block">
          {previewKind === 'video' ? (
            <video src={previewUrl} controls className="aspect-[9/16] w-full rounded-xl bg-black object-cover" />
          ) : (
            <img src={previewUrl} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">{tagLabel}</p>
          <h2 id="library-tag-title" className="mt-2 text-xl font-bold text-[#171717]">
            What does this show?
          </h2>
          <p className="mt-1 text-sm text-[#525252]">Pick all that apply. Required.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = tagSelection.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setTagSelection((current) =>
                      current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]
                    )
                  }
                  className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm ${
                    selected ? 'bg-[#171717] text-white' : 'border border-[#e5e5e5] text-[#171717]'
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {option.name}
                </button>
              );
            })}
          </div>
          {options.length === 0 && <p className="mt-3 text-sm text-[#737373]">Add services to your profile before tagging work.</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              className="text-sm font-semibold text-[#171717]"
              disabled={saving}
              onClick={() => {
                const kind = draft?.kind || editing?.media_type || 'image';
                if (draft) {
                  revoke(draft.previewUrl);
                  setDraft(null);
                }
                setTagOpen(false);
                const anchorId = editing?.id || draft?.replaceId;
                setSourceMenu({
                  kind,
                  key: anchorId ? `item-${anchorId}` : kind === 'video' ? `video-empty-${videos.length}` : `photo-empty-${photos.length}`,
                });
              }}
            >
              Replace
            </button>
            <button
              type="button"
              disabled={tagSelection.length < 1 || saving}
              onClick={() => void saveTags()}
              className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {dialog}
      {tagModal}
      {cameraKind && (
        <WebcamCapture
          kind={cameraKind}
          onCapture={(file) => stageFile(cameraKind, file)}
          onClose={() => setCameraKind(null)}
          onUnavailable={() => {
            setCameraKind(null);
            setCameraNote('Camera unavailable. Upload from computer instead.');
          }}
        />
      )}
    </>,
    document.body
  );
}
