/**
 * Platform password (OnCuts password distinct from Apple / SSO).
 * `has_platform_password` is NOT NULL in schema; treat missing/null as "no explicit password" for safety.
 */

/** True when the client should prompt to set a known password (e.g. Sign in with Apple before set-initial-password). */
export function userNeedsPlatformPassword(row: { has_platform_password?: boolean | null }): boolean {
  return row.has_platform_password !== true;
}

/**
 * DELETE /users/:id may omit body password when the account is Apple-linked and the user has never
 * set an OnCuts password (device confirms via Face ID / passcode before calling the API).
 */
export function mayDeleteAccountWithoutPasswordBody(row: {
  has_platform_password?: boolean | null;
  apple_sub?: string | null;
  auth_provider?: string | null;
}): boolean {
  if (row.has_platform_password === true) {
    return false;
  }
  const sub = row.apple_sub != null && String(row.apple_sub).trim() !== '';
  const appleProvider = String(row.auth_provider || '').toLowerCase() === 'apple';
  return sub || appleProvider;
}
