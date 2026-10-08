import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/constants';
import api from '../services/api.service';

const PHOTO_KEYS = [
  'profileImageUrl',
  'profilePictureUrl',
  'profile_picture_url',
  'avatar',
  'avatarUrl',
  'avatar_url',
  'profile_picture',
] as const;

/** Turn `/api/uploads/...` into an absolute API URL when the app talks to another origin. */
export function resolveProfilePhotoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith('/')) return trimmed;
  const origin = String(API_BASE_URL).replace(/\/api\/v1\/?$/, '');
  if (origin && /^https?:\/\//i.test(origin)) {
    return `${origin.replace(/\/$/, '')}${trimmed}`;
  }
  return trimmed;
}

export function pickProfilePhotoUrl(
  source?: object | null,
  ...extra: Array<string | null | undefined>
): string {
  const record =
    source && typeof source === 'object' ? (source as Record<string, unknown>) : null;
  const candidates: unknown[] = [...extra];
  if (record) {
    for (const key of PHOTO_KEYS) candidates.push(record[key]);
  }
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return resolveProfilePhotoUrl(value);
  }
  return '';
}

/** Booking payload photo, then the live user profile when that payload has none. */
export function useResolvedProfilePhoto(
  person?: object | null,
  userId?: string | null,
  ...extra: Array<string | null | undefined>
): string {
  const inline = pickProfilePhotoUrl(person, ...extra);
  const [fetched, setFetched] = useState('');

  useEffect(() => {
    if (inline || !userId) {
      setFetched('');
      return;
    }
    let cancelled = false;
    api
      .get<Record<string, unknown>>(`/users/${userId}`)
      .then((user) => {
        if (!cancelled) setFetched(pickProfilePhotoUrl(user));
      })
      .catch(() => {
        if (!cancelled) setFetched('');
      });
    return () => {
      cancelled = true;
    };
  }, [inline, userId]);

  return inline || fetched;
}
