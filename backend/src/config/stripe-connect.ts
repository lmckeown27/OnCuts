import { DEFAULT_PRODUCTION_APP_URL, getFrontendBaseUrl } from './app-url';

/** Default business URL on new Express Connect accounts when env is unset. */
export const DEFAULT_STRIPE_CONNECT_BUSINESS_URL = DEFAULT_PRODUCTION_APP_URL;

export function getConnectBusinessProfileUrl(): string {
  return process.env.STRIPE_CONNECT_BUSINESS_URL?.trim() || DEFAULT_STRIPE_CONNECT_BUSINESS_URL;
}

/** Base URL for Connect onboarding return/refresh redirects (no trailing slash). */
export function getConnectFrontendBaseUrl(): string {
  return getFrontendBaseUrl();
}

export function getConnectRefreshUrl(): string {
  return `${getConnectFrontendBaseUrl()}/web/barber/connect/refresh`;
}

export function getConnectReturnUrl(): string {
  return `${getConnectFrontendBaseUrl()}/web/barber/connect/return`;
}
