/**
 * Normalize to E.164 (same rules as backend `normalizeE164Phone`).
 * Strips non-digits after `+`, or prefixes `+` to all digits so users can omit `+`.
 */
export function normalizeE164Phone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

/** Matches backend `isValidE164`: + then country code and subscriber number (7–15 digits after +). */
export function isValidE164Phone(input: string): boolean {
  const normalized = normalizeE164Phone(input);
  if (!normalized) return false;
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}
