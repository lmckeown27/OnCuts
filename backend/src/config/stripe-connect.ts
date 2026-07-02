/** Default business URL on new Express Connect accounts when env is unset. */
export const DEFAULT_STRIPE_CONNECT_BUSINESS_URL = 'https://pismoplatforms.com';

export function getConnectBusinessProfileUrl(): string {
  return process.env.STRIPE_CONNECT_BUSINESS_URL?.trim() || DEFAULT_STRIPE_CONNECT_BUSINESS_URL;
}

/**
 * Base URL for Connect onboarding return/refresh redirects (no trailing slash).
 * Uses FRONTEND_URL when set (same as before the Pismo platform migration).
 */
export function getConnectFrontendBaseUrl(): string {
  const base =
    process.env.FRONTEND_URL?.trim().replace(/\/$/, '') ||
    process.env.WEB_APP_URL?.trim().replace(/\/$/, '') ||
    'https://pismoplatforms.com';
  return base;
}

export function getConnectRefreshUrl(): string {
  return `${getConnectFrontendBaseUrl()}/web/barber/connect/refresh`;
}

export function getConnectReturnUrl(): string {
  return `${getConnectFrontendBaseUrl()}/web/barber/connect/return`;
}
