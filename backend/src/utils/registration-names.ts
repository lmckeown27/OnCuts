/**
 * Resolve display names for a new user when first/last are omitted at signup.
 * Derives missing parts from the email local-part (before @), split on . _ - +.
 *
 * Apple “Hide My Email” uses random local parts (e.g. s2hmkbms8j@privaterelay.appleid.com);
 * those must not be turned into fake “first” / “last” from the random token as if they were real names.
 * When Apple does not send a person name, we use a neutral label + short suffix (not “Apple” / “User”).
 */

function capitalizeWord(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Sign in with Apple private relay (Hide My Email). */
export function isApplePrivateRelayEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@privaterelay.appleid.com');
}

/**
 * Legacy placeholder rows from older server behavior (relay + no name from client).
 * When Apple later sends real names, auth should overwrite these.
 */
export function isLegacyAppleRelayPlaceholderName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): boolean {
  const f = String(firstName ?? '').trim();
  const l = String(lastName ?? '').trim();
  return f === 'Apple' && l === 'User';
}

/** Matches relay fallback from {@link relayFallbackDisplayNamesFromEmail} (first = Member). */
export function isRelayMemberStyleFallbackName(
  email: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined
): boolean {
  if (!isApplePrivateRelayEmail(email)) return false;
  if (String(firstName ?? '').trim() !== 'Member') return false;
  const l = String(lastName ?? '').trim();
  if (!l) return false;
  return l === relayFallbackDisplayNamesFromEmail(email).lastName;
}

/**
 * Neutral display fallback for relay addresses when Apple sent no person name.
 * Not the user’s legal name — only less misleading than “Apple” / “User”.
 */
export function relayFallbackDisplayNamesFromEmail(email: string): { firstName: string; lastName: string } {
  const localRaw = (email.split('@')[0] || '').trim().toLowerCase();
  const local = localRaw.replace(/[^a-z0-9]/g, '');
  const suffix =
    local.length >= 4
      ? capitalizeWord(local.slice(-4))
      : local
        ? capitalizeWord(local)
        : 'Guest';
  return { firstName: 'Member', lastName: suffix };
}

export function resolveNamesForUser(
  email: string,
  firstNameRaw: string | null | undefined,
  lastNameRaw: string | null | undefined
): { firstName: string; lastName: string } {
  const first = String(firstNameRaw ?? '').trim();
  const last = String(lastNameRaw ?? '').trim();

  if (isApplePrivateRelayEmail(email)) {
    if (first && last) return { firstName: first, lastName: last };
    if (first) return { firstName: first, lastName: first };
    if (last) return { firstName: 'Member', lastName: last };
    return relayFallbackDisplayNamesFromEmail(email);
  }

  const local = (email.split('@')[0] || 'user').trim();
  const tokens = local.split(/[._\-+]+/).filter(Boolean);

  const fromEmailFirst = tokens[0] ? capitalizeWord(tokens[0]) : 'User';
  const lastTok = tokens.length >= 2 ? tokens[tokens.length - 1] : undefined;
  const fromEmailLast = lastTok ? capitalizeWord(lastTok) : fromEmailFirst;

  return {
    firstName: first || fromEmailFirst,
    lastName: last || fromEmailLast,
  };
}
