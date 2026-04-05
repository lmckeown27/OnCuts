/**
 * Normalize "user accepted Terms" from request bodies across web and mobile clients.
 * Accepts camelCase, snake_case, booleans, and common string/number encodings.
 */
export function isAcceptTermsTrue(body: Record<string, unknown> | undefined | null): boolean {
  if (!body || typeof body !== 'object') return false;

  const candidates = [
    body.acceptTerms,
    body.accept_terms,
    body.termsAccepted,
    body.terms_accepted,
  ];

  for (const raw of candidates) {
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) continue;
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
    }
  }

  return false;
}
