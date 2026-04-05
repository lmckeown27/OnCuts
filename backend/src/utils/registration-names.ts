/**
 * Resolve display names for a new user when first/last are omitted at signup.
 * Derives missing parts from the email local-part (before @), split on . _ - +.
 */

function capitalizeWord(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function resolveNamesForUser(
  email: string,
  firstNameRaw: string | null | undefined,
  lastNameRaw: string | null | undefined
): { firstName: string; lastName: string } {
  const local = (email.split('@')[0] || 'user').trim();
  const tokens = local.split(/[._\-+]+/).filter(Boolean);

  const fromEmailFirst = tokens[0] ? capitalizeWord(tokens[0]) : 'User';
  const lastTok = tokens.length >= 2 ? tokens[tokens.length - 1] : undefined;
  const fromEmailLast = lastTok ? capitalizeWord(lastTok) : fromEmailFirst;

  const first = String(firstNameRaw ?? '').trim();
  const last = String(lastNameRaw ?? '').trim();

  return {
    firstName: first || fromEmailFirst,
    lastName: last || fromEmailLast,
  };
}
