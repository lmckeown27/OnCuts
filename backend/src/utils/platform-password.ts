/** True when the user must set a known password (e.g. Sign in with Apple random hash). */
export function userNeedsPlatformPassword(row: { has_platform_password?: boolean }): boolean {
  return row.has_platform_password === false;
}
