/**
 * Specialty work from an operator's portfolio, shown beside a booking conversation.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api.service';
import { findService } from '../config/services';

interface PortfolioItem {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  specialties?: string[];
}

function specialtyKeys(serviceName: string): Set<string> {
  const keys = new Set<string>();
  const lower = serviceName.trim().toLowerCase();
  if (!lower) return keys;
  keys.add(lower);
  keys.add(
    lower
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  );
  const service = findService(serviceName);
  if (service) {
    keys.add(service.id.toLowerCase());
    keys.add(service.name.toLowerCase());
  }
  keys.delete('');
  return keys;
}

function itemMatchesService(item: PortfolioItem, keys: Set<string>): boolean {
  const primary = Array.isArray(item.specialties) ? item.specialties[0] : '';
  return typeof primary === 'string' && keys.has(primary.trim().toLowerCase());
}

export default function ConversationSpecialtyPortfolio({
  providerId,
  serviceName,
}: {
  providerId?: string | null;
  serviceName?: string | null;
}) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!providerId || !serviceName?.trim()) {
      setItems([]);
      return;
    }
    const keys = specialtyKeys(serviceName);
    let cancelled = false;
    api
      .get<{ items?: PortfolioItem[] }>(`/barbers/${providerId}/operator-portfolio/preview`)
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.items) ? data.items : [];
        setItems(rows.filter((item) => itemMatchesService(item, keys) && item.media_url));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, serviceName]);

  useEffect(() => {
    return () => {
      if (previewCloseTimer.current) window.clearTimeout(previewCloseTimer.current);
    };
  }, []);

  const openPreview = (item: PortfolioItem) => {
    if (previewCloseTimer.current) {
      window.clearTimeout(previewCloseTimer.current);
      previewCloseTimer.current = null;
    }
    setPreviewItem(item);
    setPreviewVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPreviewVisible(true));
    });
  };

  const closePreview = () => {
    setPreviewVisible(false);
    if (previewCloseTimer.current) return;
    previewCloseTimer.current = window.setTimeout(() => {
      previewCloseTimer.current = null;
      setPreviewItem(null);
    }, 150);
  };

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openPreview(item)}
            className="relative block w-full rounded-lg hover:outline hover:outline-2 hover:outline-[#171717] hover:-outline-offset-2"
            aria-label={`${item.media_type === 'video' ? 'Video' : 'Photo'}, ${serviceName}`}
          >
            <span className="block aspect-[9/16] overflow-hidden rounded-lg bg-[#f5f5f5]">
              {item.media_type === 'video' ? (
                <video src={item.media_url} className="h-full w-full object-cover" muted />
              ) : (
                <img src={item.media_url} alt="" className="h-full w-full object-cover" />
              )}
            </span>
          </button>
        ))}
      </div>
      {previewItem &&
        createPortal(
          <div
            className={`fixed inset-0 z-[1200] flex items-center justify-center p-4 transition-colors duration-150 ${
              previewVisible ? 'bg-[rgba(23,23,23,0.45)]' : 'bg-transparent'
            }`}
            onClick={closePreview}
          >
            <div
              className={`flex max-h-[85dvh] w-full max-w-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)] transition-all duration-150 ${
                previewVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              {previewItem.media_type === 'video' ? (
                <video
                  src={previewItem.media_url}
                  controls
                  className="aspect-[9/16] min-h-0 w-full max-h-[calc(85dvh-3.25rem)] rounded-t-2xl bg-black object-cover"
                />
              ) : (
                <img
                  src={previewItem.media_url}
                  alt=""
                  className="aspect-[9/16] min-h-0 w-full max-h-[calc(85dvh-3.25rem)] rounded-t-2xl object-cover"
                />
              )}
              <div className="relative flex shrink-0 items-center justify-center rounded-b-2xl px-4 py-3">
                <p className="text-center text-sm font-semibold text-[#171717]">{serviceName}</p>
                <button type="button" onClick={closePreview} className="absolute right-4 text-sm font-medium text-[#525252]">
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
