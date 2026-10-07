import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import barberService from '../services/barber.service';
import { SERVICE_TYPES, type ServiceType } from '../config/services';
import { useBodyScrollLock } from '../hooks';
import WebcamCapture from './WebcamCapture';
import type { OperatorPortfolioItem } from './OperatorPortfolioModal';

const PHOTO_SLOTS = [0, 1, 2, 3] as const;
const VIDEO_SLOT = 4;
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 80 * 1024 * 1024;

type SlotKind = 'image' | 'video';

interface StagedItem {
  slot: number;
  kind: SlotKind;
  file: File;
  previewUrl: string;
  specialties: string[];
}

interface DraftCapture {
  slot: number;
  kind: SlotKind;
  file: File;
  previewUrl: string;
}

interface PostServicePortfolioFlowProps {
  bookingId: string;
  providerId: string;
  onClose: () => void;
}

function uploadErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { error?: { message?: string } | string } } })?.response;
  const body = response?.data?.error;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object' && body.message) return body.message;
  return 'Could not add this to your portfolio. Try again.';
}

function specialtyLabel(id: string, options: ServiceType[]): string {
  return options.find((option) => option.id === id)?.name || id;
}

export default function PostServicePortfolioFlow({
  bookingId,
  providerId,
  onClose,
}: PostServicePortfolioFlowProps) {
  const [step, setStep] = useState<'prompt' | 'upload' | 'tag'>('prompt');
  const [items, setItems] = useState<StagedItem[]>([]);
  const [draft, setDraft] = useState<DraftCapture | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [sourceMenuSlot, setSourceMenuSlot] = useState<number | null>(null);
  const [tagSelection, setTagSelection] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraSlot, setCameraSlot] = useState<number | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [options, setOptions] = useState<ServiceType[]>([]);
  const [headerOffset, setHeaderOffset] = useState(72);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const itemsRef = useRef(items);
  const draftRef = useRef(draft);
  itemsRef.current = items;
  draftRef.current = draft;

  useBodyScrollLock(true);

  const revoke = (url: string) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const closeFlow = useCallback(() => {
    itemsRef.current.forEach((item) => revoke(item.previewUrl));
    if (draftRef.current) revoke(draftRef.current.previewUrl);
    onClose();
  }, [onClose]);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('[data-operator-header]');
      setHeaderOffset(header instanceof HTMLElement ? header.offsetHeight : 72);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
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
        if (!cancelled) setOptions(matched.length > 0 ? matched : SERVICE_TYPES.filter((service) => (service.providerType || 'barber') === kind));
      } catch {
        if (!cancelled) setOptions(SERVICE_TYPES.filter((service) => (service.providerType || 'barber') === 'barber'));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const itemFor = (slot: number) => items.find((item) => item.slot === slot);
  const nextPhotoSlot = PHOTO_SLOTS.find((slot) => !itemFor(slot) && draft?.slot !== slot);

  const discardDraft = () => {
    if (draft) revoke(draft.previewUrl);
    setDraft(null);
    setActiveSlot(null);
    setTagSelection([]);
  };

  const openTag = (slot: number, existing?: string[]) => {
    setActiveSlot(slot);
    setTagSelection(existing || []);
    setSourceMenuSlot(null);
    setStep('tag');
    setError(null);
  };

  const stageFile = (slot: number, file: File) => {
    const kind: SlotKind = slot === VIDEO_SLOT ? 'video' : 'image';
    const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      setCameraSlot(null);
      setSourceMenuSlot(null);
      setError(kind === 'image' ? 'Photos must be 8 MB or smaller' : 'Videos must be 80 MB or smaller');
      return;
    }
    if (draft) revoke(draft.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setDraft({ slot, kind, file, previewUrl });
    setCameraSlot(null);
    setSourceMenuSlot(null);
    openTag(slot, itemFor(slot)?.specialties || []);
  };

  const confirmTags = () => {
    if (tagSelection.length < 1 || activeSlot == null) return;
    if (draft && draft.slot === activeSlot) {
      setItems((current) => {
        const without = current.filter((item) => item.slot !== activeSlot);
        const previous = current.find((item) => item.slot === activeSlot);
        if (previous && previous.previewUrl !== draft.previewUrl) revoke(previous.previewUrl);
        return [...without, { ...draft, specialties: tagSelection }];
      });
      setDraft(null);
    } else {
      setItems((current) =>
        current.map((item) => (item.slot === activeSlot ? { ...item, specialties: tagSelection } : item))
      );
    }
    setActiveSlot(null);
    setTagSelection([]);
    setStep('upload');
  };

  const dismissTag = () => {
    if (draft && draft.slot === activeSlot) {
      discardDraft();
    } else {
      setActiveSlot(null);
      setTagSelection([]);
    }
    setStep('upload');
  };

  const clearSlot = (slot: number) => {
    setItems((current) => {
      const found = current.find((item) => item.slot === slot);
      if (found) revoke(found.previewUrl);
      return current.filter((item) => item.slot !== slot);
    });
    if (draft?.slot === slot) discardDraft();
  };

  const postAll = async () => {
    if (items.length === 0 || posting) return;
    setPosting(true);
    setError(null);
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const form = new FormData();
        form.append('media', item.file);
        form.append('specialties', JSON.stringify(item.specialties));
        form.append('booking_id', bookingId);
        await api.upload<OperatorPortfolioItem>(`/barbers/${providerId}/operator-portfolio`, form);
        return item.slot;
      })
    );
    const failedSlots = new Set<number>();
    let message = 'Could not add this to your portfolio. Try again.';
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        revoke(items[index].previewUrl);
        return;
      }
      failedSlots.add(items[index].slot);
      message = uploadErrorMessage(result.reason);
    });
    setItems((current) => current.filter((item) => failedSlots.has(item.slot)));
    setPosting(false);
    if (failedSlots.size === 0) {
      toast.success('Added to your portfolio');
      onClose();
      return;
    }
    setError(message);
    setStep('upload');
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (cameraSlot != null) {
        setCameraSlot(null);
        return;
      }
      if (sourceMenuSlot != null) {
        setSourceMenuSlot(null);
        return;
      }
      if (step === 'prompt') closeFlow();
      if (step === 'tag') dismissTag();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (sourceMenuSlot == null) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-source-menu]') || target.closest('[data-slot-button]')) return;
      setSourceMenuSlot(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [sourceMenuSlot]);

  useEffect(() => {
    const root = step === 'prompt' ? promptRef.current : step === 'tag' ? tagRef.current : null;
    const first = root?.querySelector<HTMLElement>('button, [href], input, textarea');
    first?.focus();
  }, [step]);

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

  const previewForTag = useMemo(() => {
    if (draft && draft.slot === activeSlot) return draft;
    return items.find((item) => item.slot === activeSlot) || null;
  }, [draft, items, activeSlot]);

  const renderSlot = (slot: number, kind: SlotKind) => {
    const committed = itemFor(slot);
    const pending = draft?.slot === slot ? draft : null;
    const item = pending
      ? { ...pending, specialties: committed?.specialties ?? [] }
      : committed;
    const isNext = kind === 'video' ? !item : slot === nextPhotoSlot;
    const label = kind === 'video' ? 'Add video' : 'Add';
    const names = item ? item.specialties.map((id) => specialtyLabel(id, options)).join(' · ') : '';
    return (
      <div key={slot} className={`relative ${kind === 'video' ? 'w-[150px]' : ''}`}>
        <button
          type="button"
          data-slot-button
          onClick={() => {
            if (item) openTag(slot, item.specialties);
            else setSourceMenuSlot(slot);
          }}
          className={`relative block w-full overflow-hidden rounded-xl aspect-[9/16] ${
            sourceMenuSlot === slot
              ? 'border border-dashed border-[#737373] bg-[#f5f5f5]'
              : item
              ? 'border border-[#e5e5e5]'
              : isNext
                ? 'border border-dashed border-[#737373] bg-white'
                : 'border border-dashed border-[#d4d4d4] bg-white'
          }`}
          aria-label={item ? `${kind === 'video' ? 'Video' : `Photo ${slot + 1}`}, ${names || 'tagged'} — edit` : kind === 'video' ? 'Add video' : `Add photo ${slot + 1}`}
        >
          {item ? (
            item.kind === 'video' ? (
              <video src={item.previewUrl} className="h-full w-full object-cover" muted />
            ) : (
              <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isNext ? 'bg-[#171717] text-white' : 'bg-[#e5e5e5] text-[#737373]'}`}>
                <Plus className="h-5 w-5" />
              </span>
              {isNext && <span className="text-xs font-medium text-[#525252]">{label}</span>}
            </span>
          )}
        </button>
        {item && (
          <>
            <button
              type="button"
              onClick={() => clearSlot(slot)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#171717] shadow"
              aria-label={kind === 'video' ? 'Remove video' : `Remove photo ${slot + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mt-2 truncate text-xs text-[#525252]">{names}</p>
          </>
        )}
        {sourceMenuSlot === slot && (
          <div data-source-menu className="absolute left-1/2 top-[58%] z-10 w-[210px] -translate-x-1/2 rounded-xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <p className="px-2 py-1.5 text-xs font-semibold text-[#737373]">
              {kind === 'video' ? 'Add video' : `Add photo ${slot + 1}`}
            </p>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
              onClick={() => {
                setCameraNote(null);
                setCameraSlot(slot);
                setSourceMenuSlot(null);
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

  const photoCount = items.filter((item) => item.kind === 'image').length;
  const videoCount = items.some((item) => item.kind === 'video') ? 1 : 0;
  const activeKind: SlotKind = activeSlot === VIDEO_SLOT ? 'video' : 'image';

  const prompt = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(23,23,23,0.45)] p-4" onClick={closeFlow}>
      <div
        ref={promptRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-prompt-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapTab(event, promptRef.current)}
        className="w-full max-w-[440px] rounded-2xl bg-white px-8 pt-8 pb-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
      >
        <div className="mb-5 flex justify-center gap-2" aria-hidden>
          {[0, 1].map((tile) => (
            <div
              key={tile}
              className="aspect-[9/16] w-12 rounded-md border border-[#e5e5e5]"
              style={{
                backgroundImage: 'repeating-linear-gradient(135deg, #f5f5f5, #f5f5f5 4px, #e5e5e5 4px, #e5e5e5 5px)',
              }}
            />
          ))}
          <div className="flex aspect-[9/16] w-12 items-center justify-center rounded-md border border-dashed border-[#d4d4d4] text-[#737373]">
            <Plus className="h-4 w-4" />
          </div>
        </div>
        <h2 id="portfolio-prompt-title" className="text-xl font-bold text-[#171717]">
          Add this cut to your portfolio?
        </h2>
        <p className="mt-2 text-sm text-[#525252]">Up to 4 photos and 1 video. Clients browsing by specialty see it.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={closeFlow} className="h-11 rounded-lg px-4 text-sm font-semibold text-[#171717] hover:bg-black/5">
            Not now
          </button>
          <button
            type="button"
            onClick={() => setStep('upload')}
            className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white hover:bg-[#4e655c]"
          >
            Yes, add work
          </button>
        </div>
      </div>
    </div>
  );

  const uploadPage = (
    <div className="fixed inset-x-0 bottom-0 z-[60] overflow-y-auto bg-[#fafafa]" style={{ top: headerOffset }}>
      <div className="mx-auto flex min-h-full max-w-[880px] flex-col px-4 py-6">
        <button type="button" onClick={closeFlow} className="mb-4 self-start text-sm font-medium text-[#525252] hover:text-[#171717]">
          ‹ Back to Schedule
        </button>
        <h1 className="text-2xl font-bold text-[#171717]">Add work</h1>
        <p className="mt-1 text-sm text-[#525252]">Click a slot to take or upload one. You'll tag the specialty after each upload.</p>
        {cameraNote && <p className="mt-3 text-sm text-[#525252]">{cameraNote}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
          <section className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#171717]">Photos</h2>
              <span className="text-xs text-[#737373]">{photoCount} of 4</span>
            </div>
            <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">{PHOTO_SLOTS.map((slot) => renderSlot(slot, 'image'))}</div>
          </section>
          <section>
            <div className="mb-3 flex w-[150px] items-center justify-between">
              <h2 className="text-sm font-semibold text-[#171717]">Video</h2>
              <span className="text-xs text-[#737373]">{videoCount} of 1</span>
            </div>
            {renderSlot(VIDEO_SLOT, 'video')}
          </section>
        </div>
        <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-2 border-t border-[#e5e5e5] bg-[#fafafa] py-4">
          <button type="button" onClick={closeFlow} className="h-11 rounded-lg px-4 text-sm font-semibold text-[#171717] hover:bg-black/5">
            Cancel
          </button>
          <button
            type="button"
            disabled={items.length === 0 || posting}
            onClick={() => void postAll()}
            className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white hover:bg-[#4e655c] disabled:opacity-50"
          >
            {posting ? 'Posting…' : `Post ${items.length} to portfolio`}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={sourceMenuSlot === VIDEO_SLOT ? VIDEO_ACCEPT : PHOTO_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file && sourceMenuSlot != null) stageFile(sourceMenuSlot, file);
          }}
        />
      </div>
    </div>
  );

  const tagModal = step === 'tag' && previewForTag && (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(23,23,23,0.45)] p-4" onClick={dismissTag}>
      <div
        ref={tagRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-tag-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapTab(event, tagRef.current)}
        className="flex w-full max-w-[680px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
      >
        <div className="hidden w-[280px] shrink-0 bg-[#f5f5f5] p-6 sm:block">
          {previewForTag.kind === 'video' ? (
            <video src={previewForTag.previewUrl} controls className="aspect-[9/16] w-full rounded-xl bg-black object-cover" />
          ) : (
            <img src={previewForTag.previewUrl} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">
            {activeKind === 'video' ? 'Video' : `Photo ${(activeSlot ?? 0) + 1} of 4`}
          </p>
          <h2 id="portfolio-tag-title" className="mt-2 text-xl font-bold text-[#171717]">
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
          {options.length === 0 && (
            <p className="mt-3 text-sm text-[#737373]">Add services to your profile before tagging work.</p>
          )}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              className="text-sm font-semibold text-[#171717]"
              onClick={() => {
                if (draft) {
                  revoke(draft.previewUrl);
                  setDraft(null);
                }
                setStep('upload');
                setSourceMenuSlot(activeSlot);
              }}
            >
              Replace
            </button>
            <button
              type="button"
              disabled={tagSelection.length < 1}
              onClick={confirmTags}
              className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {step === 'prompt' && prompt}
      {(step === 'upload' || step === 'tag') && uploadPage}
      {tagModal}
      {cameraSlot != null && (
        <WebcamCapture
          kind={cameraSlot === VIDEO_SLOT ? 'video' : 'image'}
          onCapture={(file) => stageFile(cameraSlot, file)}
          onClose={() => setCameraSlot(null)}
          onUnavailable={() => {
            setCameraSlot(null);
            setCameraNote('Camera unavailable. Upload from computer instead.');
          }}
        />
      )}
    </>,
    document.body
  );
}
