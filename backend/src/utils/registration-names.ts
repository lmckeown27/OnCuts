/**
 * Resolve display names for a new user when first/last are omitted at signup.
 * Derives missing parts from the email local-part (before @), split on . _ - +.
 *
 * Apple “Hide My Email” uses random local parts (e.g. s2hmkbms8j@privaterelay.appleid.com);
 * those must not be turned into fake “first” / “last” names.
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
    if (last) return { firstName: 'User', lastName: last };
    return { firstName: 'Apple', lastName: 'User' };
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
