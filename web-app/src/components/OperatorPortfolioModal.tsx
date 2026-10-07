import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
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
  is_cover?: boolean;
}

interface OperatorPortfolioModalProps {
  providerId: string;
  visible: boolean;
  onClose: () => void;
  onOpenServices?: () => void;
  servicesRevision?: number;
}

type SlotKind = 'image' | 'video';

interface UploadTarget {
  specialtyId: string;
  asCover: boolean;
  replaceId: string | null;
  kind: SlotKind;
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

function latestSectionPhoto(items: OperatorPortfolioItem[], specialtyId: string): OperatorPortfolioItem | undefined {
  return items
    .filter((item) => specialtyIds(item)[0] === specialtyId && item.media_type === 'image')
    .sort((a, b) => {
      const time = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (time !== 0 && !Number.isNaN(time)) return time;
      return b.sort_order - a.sort_order;
    })[0];
}

function sectionCover(items: OperatorPortfolioItem[], specialtyId: string): OperatorPortfolioItem | undefined {
  const marked = items.find(
    (item) => specialtyIds(item)[0] === specialtyId && item.is_cover && item.media_type === 'image'
  );
  return marked ?? latestSectionPhoto(items, specialtyId);
}

function specialtyLabel(id: string, options: ServiceType[]): string {
  return options.find((option) => option.id === id)?.name || id;
}

function formatSpecialtyPrice(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

function priceForSpecialty(id: string, options: ServiceType[], prices: Record<string, number>): string | null {
  const option = options.find((entry) => entry.id === id);
  const keys = [id, option?.name].filter((key): key is string => Boolean(key)).map((key) => key.toLowerCase());
  for (const key of keys) {
    if (prices[key] != null) return formatSpecialtyPrice(prices[key]);
  }
  return null;
}

export default function OperatorPortfolioModal({
  providerId,
  visible,
  onClose,
  onOpenServices,
  servicesRevision = 0,
}: OperatorPortfolioModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<OperatorPortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ServiceType[]>([]);
  const [sourceMenu, setSourceMenu] = useState<{ key: string; specialtyId: string; asCover: boolean } | null>(null);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [cameraKind, setCameraKind] = useState<SlotKind | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: SlotKind; file: File; previewUrl: string; replaceId: string | null } | null>(null);
  const [editing, setEditing] = useState<OperatorPortfolioItem | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [tagSelection, setTagSelection] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [clientView, setClientView] = useState(false);
  const [workFilter, setWorkFilter] = useState('all');
  const [showAllWork, setShowAllWork] = useState(false);
  const [previewItem, setPreviewItem] = useState<OperatorPortfolioItem | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [operatorPhoto, setOperatorPhoto] = useState<string | null>(null);
  const [specialtyPrices, setSpecialtyPrices] = useState<Record<string, number>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const sectionRowRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<string[]>([]);
  const dragRef = useRef<{ id: string; startX: number; moved: boolean; lastTarget: number } | null>(null);
  const suppressClick = useRef(false);
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
    const missing = Array.from(new Set(items.map((item) => specialtyIds(item)[0]).filter((id): id is string => Boolean(id)))).filter(
      (specialtyId) => {
        const photos = items.filter((item) => specialtyIds(item)[0] === specialtyId && item.media_type === 'image');
        return photos.length > 0 && !photos.some((item) => item.is_cover);
      }
    );
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const specialtyId of missing) {
        const latest = latestSectionPhoto(items, specialtyId);
        if (!latest || cancelled) return;
        try {
          const updated = await api.patch<OperatorPortfolioItem>(`/barbers/${providerId}/operator-portfolio/${latest.id}`, {
            specialties: [specialtyId],
            is_cover: true,
          });
          if (cancelled) return;
          setItems((current) =>
            current.map((entry) => {
              if (entry.id === latest.id) return { ...entry, ...updated, is_cover: true, specialties: [specialtyId] };
              if (specialtyIds(entry)[0] === specialtyId && entry.is_cover) return { ...entry, is_cover: false };
              return entry;
            })
          );
        } catch (err) {
          if (!cancelled) setError(uploadErrorMessage(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, visible, providerId]);

  useEffect(() => {
    if (!visible || !providerId) return;
    let cancelled = false;
    const loadOrder = async () => {
      try {
        const data = await api.get<{ specialtyIds?: string[] }>(`/barbers/${providerId}/operator-portfolio/section-order`);
        if (!cancelled && Array.isArray(data?.specialtyIds)) setSectionOrder(data.specialtyIds);
      } catch {
        if (!cancelled) setSectionOrder([]);
      }
    };
    void loadOrder();
    return () => {
      cancelled = true;
    };
  }, [visible, providerId, servicesRevision]);

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
        const name = barber.name || barber.display_name || [barber.first_name, barber.last_name].filter(Boolean).join(' ') || 'Operator';
        const photo = barber.profile_picture_url || barber.profile_photo_url || null;
        const priceByKey: Record<string, number> = {};
        for (const entry of barber.pricing || []) {
          const amount = Number(entry.price);
          if (!Number.isFinite(amount)) continue;
          if (entry.name?.trim()) priceByKey[entry.name.trim().toLowerCase()] = amount;
          if (entry.id?.trim()) priceByKey[entry.id.trim().toLowerCase()] = amount;
        }
        for (const service of matched) {
          const price = priceByKey[service.name.toLowerCase()] ?? priceByKey[service.id.toLowerCase()];
          if (price != null) priceByKey[service.id.toLowerCase()] = price;
        }
        if (!cancelled) {
          setOptions(matched);
          setOperatorName(name);
          setOperatorPhoto(photo);
          setSpecialtyPrices(priceByKey);
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
          setOperatorName('');
          setOperatorPhoto(null);
          setSpecialtyPrices({});
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [visible, providerId, servicesRevision]);

  useEffect(() => {
    return () => {
      if (draftRef.current) revoke(draftRef.current.previewUrl);
    };
  }, []);

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
    setTagSelection(specialtyIds(item).slice(0, 1));
    setSourceMenu(null);
    setTagOpen(true);
    setError(null);
  };

  const publishFile = async (kind: SlotKind, file: File, target: UploadTarget) => {
    const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      setCameraKind(null);
      setError(kind === 'image' ? 'Photos must be 8 MB or smaller' : 'Videos must be 80 MB or smaller');
      return;
    }
    if (target.asCover && kind !== 'image') {
      setCameraKind(null);
      setError('A cover must be a photo');
      return;
    }
    setSaving(true);
    setError(null);
    setCameraKind(null);
    setSourceMenu(null);
    try {
      const form = new FormData();
      form.append('media', file);
      form.append('specialties', JSON.stringify([target.specialtyId]));
      if (target.asCover) form.append('is_cover', 'true');
      const created = await api.upload<OperatorPortfolioItem>(`/barbers/${providerId}/operator-portfolio`, form);
      if (target.replaceId) {
        await api.delete(`/barbers/${providerId}/operator-portfolio/${target.replaceId}`);
      }
      setItems((current) => {
        let next = current.filter((item) => item.id !== target.replaceId);
        if (target.asCover) {
          next = next.map((item) =>
            specialtyIds(item)[0] === target.specialtyId && item.is_cover ? { ...item, is_cover: false } : item
          );
        }
        if (created?.id) {
          return [
            ...next.filter((item) => item.id !== created.id),
            { ...created, specialties: created.specialties?.length ? created.specialties : [target.specialtyId], is_cover: Boolean(created.is_cover) },
          ];
        }
        return next;
      });
      if (!created?.id) await loadItems();
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setSaving(false);
      setUploadTarget(null);
    }
  };

  const stageFile = (kind: SlotKind, file: File) => {
    if (!uploadTarget || !providerId) return;
    void publishFile(kind, file, uploadTarget);
  };

  const beginCapture = (
    specialtyId: string,
    kind: SlotKind,
    asCover: boolean,
    replaceIdValue: string | null,
    via: 'camera' | 'file'
  ) => {
    setUploadTarget({ specialtyId, asCover, replaceId: replaceIdValue, kind });
    setReplaceId(replaceIdValue);
    setSourceMenu(null);
    setCameraNote(null);
    if (via === 'camera') {
      setCameraKind(kind);
      return;
    }
    setCameraKind(null);
    if (fileInputRef.current) {
      fileInputRef.current.accept = kind === 'video' ? VIDEO_ACCEPT : PHOTO_ACCEPT;
      fileInputRef.current.click();
    }
  };

  const setAsCover = async (item: OperatorPortfolioItem) => {
    const specialtyId = specialtyIds(item)[0];
    if (!specialtyId || item.media_type !== 'image' || !providerId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<OperatorPortfolioItem>(`/barbers/${providerId}/operator-portfolio/${item.id}`, {
        specialties: [specialtyId],
        is_cover: true,
      });
      setItems((current) =>
        current.map((entry) => {
          if (entry.id === item.id) return { ...entry, ...updated, is_cover: true, specialties: [specialtyId] };
          if (specialtyIds(entry)[0] === specialtyId && entry.is_cover) return { ...entry, is_cover: false };
          return entry;
        })
      );
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setSaving(false);
    }
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
      if (previewItem) {
        setPreviewItem(null);
        return;
      }
      if (clientView) {
        setClientView(false);
        return;
      }
      if (openSectionId) {
        setOpenSectionId(null);
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

  const renderSourceMenu = (key: string, specialtyId: string, asCover: boolean, replaceIdValue: string | null) => {
    if (sourceMenu?.key !== key) return null;
    const choose = (kind: SlotKind, via: 'camera' | 'file') => beginCapture(specialtyId, kind, asCover, replaceIdValue, via);
    return (
      <div data-source-menu className="absolute left-0 top-[58%] z-10 w-[230px] rounded-xl bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
        {asCover && (
          <p className="px-2 py-1.5 text-xs font-semibold text-[#737373]">{specialtyLabel(specialtyId, options)}</p>
        )}
        {asCover && !openSectionId && (
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
            onClick={() => {
              setSourceMenu(null);
              setOpenSectionId(specialtyId);
            }}
          >
            Open section
          </button>
        )}
        <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]" onClick={() => choose('image', 'camera')}>
          {asCover ? 'Use camera' : 'Photo from camera'}
        </button>
        {asCover ? (
          <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]" onClick={() => choose('image', 'file')}>
            Upload from computer
          </button>
        ) : (
          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              className="h-11 rounded-lg bg-[#5a7268] px-3 text-sm font-semibold text-white hover:bg-[#445750]"
              onClick={() => choose('image', 'file')}
            >
              Upload photo
            </button>
            <button
              type="button"
              className="h-11 rounded-lg bg-[#5a7268] px-3 text-sm font-semibold text-white hover:bg-[#445750]"
              onClick={() => choose('video', 'file')}
            >
              Upload video
            </button>
          </div>
        )}
        {!asCover && (
          <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]" onClick={() => choose('video', 'camera')}>
            Video from camera
          </button>
        )}
      </div>
    );
  };

  const renderMedia = (item: OperatorPortfolioItem, specialtyId: string) => {
    const kind = item.media_type;
    return (
      <div key={item.id} className="relative">
        <button
          type="button"
          data-slot-button
          onClick={() => openTagForItem(item)}
          className="relative block w-full overflow-hidden rounded-xl border border-[#e5e5e5] aspect-[9/16]"
          aria-label={`${kind === 'video' ? 'Video' : 'Photo'}, ${specialtyLabel(specialtyId, options)} — edit`}
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
          aria-label={kind === 'video' ? 'Remove video' : 'Remove photo'}
        >
          <X className="h-4 w-4" />
        </button>
        {kind === 'image' && !item.is_cover && (
          <button
            type="button"
            onClick={() => void setAsCover(item)}
            className="mt-2 block text-left text-xs font-medium text-[#525252] hover:text-[#171717]"
          >
            Set as cover
          </button>
        )}
        {renderSourceMenu(`item-${item.id}`, specialtyId, false, item.id)}
      </div>
    );
  };

  const previewUrl = draft?.previewUrl || editing?.media_url || '';
  const previewKind: SlotKind = draft?.kind || editing?.media_type || 'image';
  const tagLabel = previewKind === 'video' ? 'Video' : 'Photo';
  const sectionIds = Array.from(
    new Set([...options.map((option) => option.id), ...items.flatMap((item) => specialtyIds(item))])
  );
  const orderedSectionIds = useMemo(() => {
    const known = new Set(sectionIds);
    const kept = sectionOrder.filter((id) => known.has(id));
    return [...kept, ...sectionIds.filter((id) => !kept.includes(id))];
  }, [sectionIds, sectionOrder]);
  orderRef.current = orderedSectionIds;

  const reorderSections = (id: string, target: number) => {
    setSectionOrder(() => {
      const current = orderRef.current;
      const from = current.indexOf(id);
      if (from < 0) return current;
      const next = current.slice();
      next.splice(from, 1);
      const insertAt = Math.max(0, Math.min(next.length, target > from ? target - 1 : target));
      next.splice(insertAt, 0, id);
      orderRef.current = next;
      return next;
    });
  };

  const onSectionPointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return;
    dragRef.current = { id, startX: event.clientX, moved: false, lastTarget: orderedSectionIds.indexOf(id) };
  };

  const onSectionPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const row = sectionRowRef.current;
    if (!drag || !row) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      row.setPointerCapture(event.pointerId);
      setDraggingId(drag.id);
      setSourceMenu(null);
    }
    const bounds = row.getBoundingClientRect();
    if (event.clientX > bounds.right - 36) row.scrollLeft += 14;
    if (event.clientX < bounds.left + 36) row.scrollLeft -= 14;
    const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-section-id]'));
    let target = cards.length;
    for (let index = 0; index < cards.length; index += 1) {
      const rect = cards[index].getBoundingClientRect();
      if (event.clientX < rect.left + rect.width / 2) {
        target = index;
        break;
      }
    }
    if (target === drag.lastTarget) return;
    drag.lastTarget = target;
    reorderSections(drag.id, target);
  };

  const onSectionPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!drag?.moved || !providerId) return;
    suppressClick.current = true;
    void api
      .put(`/barbers/${providerId}/operator-portfolio/section-order`, { specialtyIds: orderRef.current })
      .catch((err) => setError(uploadErrorMessage(err)));
  };

  const clientWork = orderedSectionIds.flatMap((specialtyId) => {
    const sectionItems = items.filter((item) => specialtyIds(item)[0] === specialtyId);
    const cover = sectionCover(sectionItems, specialtyId);
    const rest = sectionItems.filter((item) => item.id !== cover?.id);
    return cover ? [cover, ...rest] : rest;
  });
  const workChips = orderedSectionIds.filter((specialtyId) => clientWork.some((item) => specialtyIds(item)[0] === specialtyId));
  const filteredWork = workFilter === 'all' ? clientWork : clientWork.filter((item) => specialtyIds(item)[0] === workFilter);
  const shownWork = showAllWork ? filteredWork : filteredWork.slice(0, 8);

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
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-6 pt-6 sm:px-8">
          <div className="justify-self-start">
            <button
              type="button"
              onClick={() => {
                setClientView((open) => !open);
                setOpenSectionId(null);
                setSourceMenu(null);
                setWorkFilter('all');
                setShowAllWork(false);
                setPreviewItem(null);
              }}
              className="min-w-[8rem] px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {clientView ? 'Edit' : 'Client View'}
            </button>
          </div>
          <h2 className="text-center text-2xl font-bold text-[#171717]">
            {openSectionId && !clientView ? (
              <>
                {specialtyLabel(openSectionId, options)}
                {priceForSpecialty(openSectionId, options, specialtyPrices) && (
                  <span className="ml-2">{priceForSpecialty(openSectionId, options, specialtyPrices)}</span>
                )}
              </>
            ) : (
              'Portfolio'
            )}
          </h2>
          <div className="flex shrink-0 items-center justify-self-end gap-2">
            <button
              type="button"
              onClick={onOpenServices}
              className="min-w-[8rem] px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              Services/Prices Offered
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#171717] hover:bg-black/5"
              aria-label="Close portfolio"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {!providerId && <p className="text-sm text-amber-700">Your operator profile is still loading.</p>}
          {cameraNote && <p className="mb-3 text-sm text-[#525252]">{cameraNote}</p>}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loading && <p className="mb-3 text-sm text-[#737373]">Loading portfolio…</p>}

          {clientView ? (
            <div>
              <div className="mb-4 flex min-w-0 items-center gap-3">
                {operatorPhoto ? (
                  <img src={operatorPhoto} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#5a7268] text-xl font-semibold text-white">
                    {(operatorName.trim().charAt(0) || 'O').toUpperCase()}
                  </span>
                )}
                <p className="truncate text-[22px] font-bold text-[#171717]">{operatorName || 'Operator'}</p>
              </div>
              {workFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setWorkFilter('all');
                    setShowAllWork(false);
                    setPreviewItem(null);
                  }}
                  className="mb-4 text-sm font-medium text-[#525252] hover:text-[#171717]"
                >
                  ‹ All specialties
                </button>
              )}
              {workFilter === 'all' ? (
                workChips.length === 0 ? (
                  <p className="text-sm text-[#737373]">No work in this view yet.</p>
                ) : (
                  <>
                    {(() => {
                      const visibleSections = showAllWork ? workChips : workChips.slice(0, 8);
                      const sectionRows = Math.max(1, Math.ceil(visibleSections.length / 3));
                      return (
                    <div className="grid grid-cols-4 gap-2">
                      {visibleSections.map((specialtyId, index) => {
                        const name = specialtyLabel(specialtyId, options);
                        const sectionItems = items.filter((item) => specialtyIds(item)[0] === specialtyId);
                        const tile = sectionCover(sectionItems, specialtyId) ?? sectionItems[0];
                        if (!tile) return null;
                        return (
                          <div key={specialtyId} style={{ gridColumn: (index % 3) + 1 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setWorkFilter(specialtyId);
                                setShowAllWork(false);
                                setPreviewItem(null);
                              }}
                              className="relative block w-full rounded-lg hover:ring-2 hover:ring-[#171717]"
                              aria-label={`${name} section`}
                            >
                              <span className="block aspect-[9/16] overflow-hidden rounded-lg bg-[#f5f5f5]">
                                {tile.media_type === 'video' ? (
                                  <video src={tile.media_url} className="h-full w-full object-cover" muted />
                                ) : (
                                  <img src={tile.media_url} alt="" className="h-full w-full object-cover" />
                                )}
                              </span>
                              {tile.media_type === 'video' && (
                                <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">▶</span>
                              )}
                            </button>
                            <p className="mt-2 flex items-baseline justify-center gap-1.5 text-sm font-semibold text-[#171717]">
                              <span className="truncate">{name}</span>
                              {priceForSpecialty(specialtyId, options, specialtyPrices) && (
                                <span className="shrink-0">{priceForSpecialty(specialtyId, options, specialtyPrices)}</span>
                              )}
                            </p>
                          </div>
                        );
                      })}
                      <div
                        className="col-start-4 row-start-1 flex w-full items-center justify-center"
                        style={{ gridRow: `1 / span ${sectionRows}` }}
                      >
                        <button
                          type="button"
                          disabled={!providerId}
                          onClick={() => {
                            const platformPrefix = location.pathname.startsWith('/app') ? '/app' : '/web';
                            navigate(`${platformPrefix}/consumer/book/${providerId}`);
                          }}
                          className="h-16 w-full rounded-lg bg-[#5a7268] px-6 text-2xl font-semibold text-white hover:bg-[#445750] disabled:opacity-50"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                      );
                    })()}
                    {workChips.length > 8 && !showAllWork && (
                      <button
                        type="button"
                        onClick={() => setShowAllWork(true)}
                        className="mt-4 text-sm font-medium text-[#171717] hover:underline"
                      >
                        See all work
                      </button>
                    )}
                  </>
                )
              ) : filteredWork.length === 0 ? (
                <p className="text-sm text-[#737373]">No work in this view yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 min-[1024px]:grid-cols-4">
                    {shownWork.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="relative block w-full rounded-lg hover:ring-2 hover:ring-[#171717]"
                        aria-label={`${item.media_type === 'video' ? 'Video' : 'Photo'}, ${specialtyLabel(specialtyIds(item)[0] || '', options)}`}
                      >
                        <span className="block aspect-[9/16] overflow-hidden rounded-lg bg-[#f5f5f5]">
                          {item.media_type === 'video' ? (
                            <video src={item.media_url} className="h-full w-full object-cover" muted />
                          ) : (
                            <img src={item.media_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        {item.media_type === 'video' && (
                          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">▶</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {filteredWork.length > 8 && !showAllWork && (
                    <button
                      type="button"
                      onClick={() => setShowAllWork(true)}
                      className="mt-4 text-sm font-medium text-[#171717] hover:underline"
                    >
                      See all work
                    </button>
                  )}
                </>
              )}
              {previewItem && (
                <div
                  className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(23,23,23,0.45)] p-4"
                  onClick={() => setPreviewItem(null)}
                >
                  <div
                    className="w-full max-w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {previewItem.media_type === 'video' ? (
                      <video src={previewItem.media_url} controls className="aspect-[9/16] w-full bg-black object-cover" />
                    ) : (
                      <img src={previewItem.media_url} alt="" className="aspect-[9/16] w-full object-cover" />
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-sm font-semibold text-[#171717]">
                        {specialtyLabel(specialtyIds(previewItem)[0] || '', options)}
                      </p>
                      <button type="button" onClick={() => setPreviewItem(null)} className="text-sm font-medium text-[#525252]">
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
          {!loading && sectionIds.length === 0 && (
            <p className="text-sm text-[#737373]">Add services on your profile before building a portfolio.</p>
          )}

          {openSectionId ? (
            <div>
              <button
                type="button"
                onClick={() => setOpenSectionId(null)}
                className="mb-4 text-sm font-medium text-[#525252] hover:text-[#171717]"
              >
                ‹ All specialties
              </button>
              {(() => {
                const specialtyId = openSectionId;
                const sectionItems = items.filter((item) => specialtyIds(item)[0] === specialtyId);
                const cover = sectionCover(sectionItems, specialtyId);
                const gallery = sectionItems.filter((item) => item.id !== cover?.id);
                return (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="w-[150px] shrink-0">
                      <p className="mb-2 text-xs font-medium text-[#737373]">Cover</p>
                      <div className="relative">
                        <button
                          type="button"
                          data-slot-button
                          disabled={!providerId || saving}
                          onClick={() =>
                            setSourceMenu((current) =>
                              current?.key === `cover-${specialtyId}`
                                ? null
                                : { key: `cover-${specialtyId}`, specialtyId, asCover: true }
                            )
                          }
                          className={`relative block w-full overflow-hidden rounded-xl aspect-[9/16] ${
                            cover
                              ? 'border border-[#e5e5e5]'
                              : `border border-dashed bg-white ${sourceMenu?.key === `cover-${specialtyId}` ? 'border-[#737373] bg-[#f5f5f5]' : 'border-[#737373]'}`
                          }`}
                          aria-label={cover ? `Change ${specialtyLabel(specialtyId, options)} cover` : `Set ${specialtyLabel(specialtyId, options)} cover`}
                        >
                          {cover ? (
                            <img src={cover.media_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full flex-col items-center justify-center gap-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-white">
                                <Plus className="h-5 w-5" />
                              </span>
                              <span className="text-xs font-medium text-[#525252]">Set cover</span>
                            </span>
                          )}
                        </button>
                        {cover && (
                          <button
                            type="button"
                            onClick={() => void removeItem(cover.id)}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#171717] shadow"
                            aria-label="Remove cover photo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {renderSourceMenu(`cover-${specialtyId}`, specialtyId, true, null)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs font-medium text-[#737373]">Photos and videos</p>
                      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
                        {gallery.map((item) => renderMedia(item, specialtyId))}
                        <div className="relative">
                          <button
                            type="button"
                            data-slot-button
                            disabled={!providerId || saving}
                            onClick={() => setSourceMenu({ key: `add-${specialtyId}`, specialtyId, asCover: false })}
                            className={`relative block w-full overflow-hidden rounded-xl aspect-[9/16] border border-dashed bg-white ${
                              sourceMenu?.key === `add-${specialtyId}` ? 'border-[#737373] bg-[#f5f5f5]' : 'border-[#737373]'
                            }`}
                            aria-label={`Add to ${specialtyLabel(specialtyId, options)}`}
                          >
                            <span className="flex h-full flex-col items-center justify-center gap-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-white">
                                <Plus className="h-5 w-5" />
                              </span>
                              <span className="text-xs font-medium text-[#525252]">Add</span>
                            </span>
                          </button>
                          {renderSourceMenu(`add-${specialtyId}`, specialtyId, false, null)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              ref={sectionRowRef}
              className="flex gap-[14px] overflow-x-auto pb-2"
              onPointerMove={onSectionPointerMove}
              onPointerUp={onSectionPointerUp}
              onPointerCancel={onSectionPointerUp}
            >
              {orderedSectionIds.map((specialtyId) => {
                const cover = sectionCover(items, specialtyId);
                const name = specialtyLabel(specialtyId, options);
                return (
                  <div
                    key={specialtyId}
                    data-section-id={specialtyId}
                    className={`w-[150px] shrink-0 cursor-grab touch-none ${
                      draggingId === specialtyId ? 'cursor-grabbing opacity-70' : ''
                    }`}
                    onPointerDown={(event) => onSectionPointerDown(event, specialtyId)}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        data-slot-button
                        disabled={!providerId || saving}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          setSourceMenu(null);
                          setOpenSectionId(specialtyId);
                        }}
                        className={`relative block w-full overflow-hidden rounded-xl aspect-[9/16] ${
                          cover ? 'border border-[#e5e5e5]' : 'border border-dashed bg-white border-[#737373]'
                        }`}
                        aria-label={`${name} section`}
                      >
                        {cover ? (
                          <img src={cover.media_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full flex-col items-center justify-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-white">
                              <Plus className="h-5 w-5" />
                            </span>
                            <span className="px-2 text-center text-xs font-medium text-[#525252]">Set cover</span>
                          </span>
                        )}
                      </button>
                    </div>
                    <p className="mt-2 flex items-baseline justify-center gap-1.5 text-sm font-semibold text-[#171717]">
                      <span className="truncate">{name}</span>
                      {priceForSpecialty(specialtyId, options, specialtyPrices) && (
                        <span className="shrink-0">{priceForSpecialty(specialtyId, options, specialtyPrices)}</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={uploadTarget?.kind === 'video' ? VIDEO_ACCEPT : PHOTO_ACCEPT}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file && uploadTarget) stageFile(uploadTarget.kind, file);
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
            Categorize this service
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = tagSelection[0] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTagSelection(selected ? [] : [option.id])}
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
              className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={saving}
              onClick={() => {
                const specialtyId = specialtyIds(editing)[0] || tagSelection[0];
                if (draft) {
                  revoke(draft.previewUrl);
                  setDraft(null);
                }
                setTagOpen(false);
                if (editing && specialtyId) {
                  setSourceMenu({ key: `item-${editing.id}`, specialtyId, asCover: false });
                }
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
