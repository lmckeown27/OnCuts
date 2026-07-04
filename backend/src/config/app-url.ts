/** Canonical production web origin (no trailing slash). Override with FRONTEND_URL on the server. */
export const DEFAULT_PRODUCTION_APP_URL = 'https://oncuts.com';

const LOCAL_DEV_DEFAULT_APP_URL = 'http://localhost:5173';

/** Base URL for email links, OAuth redirects, and Connect return/refresh (no trailing slash). */
export function getFrontendBaseUrl(): string {
  const fromEnv =
    process.env.FRONTEND_URL?.trim().replace(/\/$/, '') ||
    process.env.WEB_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== 'production') return LOCAL_DEV_DEFAULT_APP_URL;
  return DEFAULT_PRODUCTION_APP_URL;
}

export function getGoogleCalendarRedirectUri(): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${getFrontendBaseUrl()}/api/v1/auth/google-calendar/callback`
  );
}
