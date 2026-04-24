import Stripe from 'stripe';
import { stripeAutoModeFromAppNetwork } from './app-network';
import { logger } from '../utils/logger';

/** Keep in sync across all Stripe entrypoints. */
export const STRIPE_API_VERSION = '2023-10-16' as const;

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Live secret: STRIPE_SECRET_KEY_LIVE or STRIPE_LIVE_SECRET_KEY */
function liveStripeSecretFromEnv(): string | undefined {
  return trimEnv('STRIPE_SECRET_KEY_LIVE') || trimEnv('STRIPE_LIVE_SECRET_KEY');
}

/** Test secret: STRIPE_SECRET_KEY_TEST or STRIPE_TEST_SECRET_KEY */
function testStripeSecretFromEnv(): string | undefined {
  return trimEnv('STRIPE_SECRET_KEY_TEST') || trimEnv('STRIPE_TEST_SECRET_KEY');
}

/** Live webhook signing secret */
function liveStripeWebhookFromEnv(): string | undefined {
  return trimEnv('STRIPE_WEBHOOK_SECRET_LIVE') || trimEnv('STRIPE_LIVE_WEBHOOK_SECRET');
}

/** Test webhook signing secret */
function testStripeWebhookFromEnv(): string | undefined {
  return trimEnv('STRIPE_WEBHOOK_SECRET_TEST') || trimEnv('STRIPE_TEST_WEBHOOK_SECRET');
}

/** True if any secret-key env var is set (generic or split live/test). */
export function isAnyStripeSecretKeyConfigured(): boolean {
  return Boolean(
    trimEnv('STRIPE_SECRET_KEY') || liveStripeSecretFromEnv() || testStripeSecretFromEnv()
  );
}

function dedupeStrings(values: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of values) {
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Webhook signing secrets to try in order (same HTTPS endpoint for test + live dashboards).
 * STRIPE_WEBHOOK_SECRET remains the primary / backward-compatible name.
 */
export function getStripeWebhookSecrets(): string[] {
  return dedupeStrings([
    trimEnv('STRIPE_WEBHOOK_SECRET'),
    trimEnv('STRIPE_WEBHOOK_SECRET_LIVE'),
    trimEnv('STRIPE_WEBHOOK_SECRET_TEST'),
  ]);
}

export function hasStripeWebhookSecretConfigured(): boolean {
  return getStripeWebhookSecrets().length > 0;
}

/**
 * Verify Stripe-Signature using any configured webhook secret.
 */
export function constructStripeWebhookEvent(
  payload: Buffer | string,
  signature: string
): Stripe.Event {
  const secrets = getStripeWebhookSecrets();
  if (secrets.length === 0) {
    throw new Error('No STRIPE_WEBHOOK_SECRET* configured');
  }
  const parser = new Stripe('sk_test_000000000000000000000000', { apiVersion: STRIPE_API_VERSION });
  let lastErr: Error | undefined;
  for (const secret of secrets) {
    try {
      return parser.webhooks.constructEvent(payload, signature, secret);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error('Webhook signature verification failed');
}

const clientByKey = new Map<string, Stripe>();

export function getStripeClient(secretKey: string): Stripe {
  if (!secretKey) {
    throw new Error('Stripe secret key is empty');
  }
  let c = clientByKey.get(secretKey);
  if (!c) {
    c = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
    clientByKey.set(secretKey, c);
  }
  return c;
}

/**
 * Resolve restricted key for a given Stripe object livemode (from events or API objects).
 * STRIPE_MODE=live|test forces that key; auto picks sk_live_* / sk_test_* specific env vars first.
 */
export function resolveStripeSecretKeyForLivemode(livemode: boolean): string {
  const mode = (trimEnv('STRIPE_MODE') || 'auto').toLowerCase();
  const generic = trimEnv('STRIPE_SECRET_KEY');
  const liveKey = liveStripeSecretFromEnv();
  const testKey = testStripeSecretFromEnv();

  if (mode === 'live') {
    const k =
      liveKey ||
      (generic?.startsWith('sk_live') ? generic : undefined) ||
      generic;
    if (!k) {
      throw new Error(
        'STRIPE_MODE=live: set STRIPE_SECRET_KEY_LIVE / STRIPE_LIVE_SECRET_KEY or STRIPE_SECRET_KEY (sk_live_...)'
      );
    }
    return k;
  }

  if (mode === 'test') {
    const k =
      testKey ||
      (generic?.startsWith('sk_test') ? generic : undefined) ||
      generic;
    if (!k) {
      throw new Error(
        'STRIPE_MODE=test: set STRIPE_SECRET_KEY_TEST / STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY (sk_test_...)'
      );
    }
    return k;
  }

  if (livemode) {
    const k = liveKey || (generic?.startsWith('sk_live') ? generic : undefined);
    if (k) return k;
    if (generic?.startsWith('sk_test')) {
      throw new Error(
        'Live Stripe event but only sk_test STRIPE_SECRET_KEY is set; add STRIPE_SECRET_KEY_LIVE / STRIPE_LIVE_SECRET_KEY or use sk_live in STRIPE_SECRET_KEY'
      );
    }
    if (generic) return generic;
    throw new Error(
      'Live Stripe event: configure STRIPE_SECRET_KEY_LIVE / STRIPE_LIVE_SECRET_KEY or STRIPE_SECRET_KEY (sk_live_...)'
    );
  }

  const k = testKey || (generic?.startsWith('sk_test') ? generic : undefined);
  if (k) return k;
  if (generic?.startsWith('sk_live')) {
    throw new Error(
      'Test Stripe event but only sk_live STRIPE_SECRET_KEY is set; add STRIPE_SECRET_KEY_TEST or use sk_test in STRIPE_SECRET_KEY'
    );
  }
  if (generic) return generic;
  throw new Error(
    'Test Stripe event: configure STRIPE_SECRET_KEY_TEST / STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY (sk_test_...)'
  );
}

export function getStripeClientForLivemode(livemode: boolean): Stripe {
  return getStripeClient(resolveStripeSecretKeyForLivemode(livemode));
}

/**
 * Secret key for normal API traffic (checkout, Connect, etc.), not webhook-parsed livemode.
 * STRIPE_MODE live/test locks mode; auto prefers live in production, else test, with sensible fallbacks.
 */
export function getDefaultStripeSecretKey(): string {
  let mode = (trimEnv('STRIPE_MODE') || 'auto').toLowerCase();
  const stripeFromNet = stripeAutoModeFromAppNetwork();
  if (mode === 'auto' && stripeFromNet) {
    mode = stripeFromNet;
  }
  const generic = trimEnv('STRIPE_SECRET_KEY');
  const liveKey = liveStripeSecretFromEnv();
  const testKey = testStripeSecretFromEnv();

  if (mode === 'live') {
    return (
      liveKey ||
      (generic?.startsWith('sk_live') ? generic : undefined) ||
      generic ||
      ''
    );
  }
  if (mode === 'test') {
    return (
      testKey ||
      (generic?.startsWith('sk_test') ? generic : undefined) ||
      generic ||
      ''
    );
  }

  if (process.env.NODE_ENV === 'production') {
    return (
      liveKey ||
      (generic?.startsWith('sk_live') ? generic : undefined) ||
      generic ||
      testKey ||
      ''
    );
  }

  return (
    testKey ||
    (generic?.startsWith('sk_test') ? generic : undefined) ||
    generic ||
    liveKey ||
    ''
  );
}

let defaultClient: Stripe | null = null;

/**
 * Default Stripe SDK client for API calls (checkout, Connect, etc.).
 * Do not call at module load time if the process should boot without Stripe keys;
 * call from route handlers or lazy helpers so missing env fails on first use only.
 */
export function getDefaultStripeClient(): Stripe {
  const k = getDefaultStripeSecretKey();
  if (!k) {
    throw new Error(
      'Stripe not configured: set STRIPE_SECRET_KEY and/or split keys, or APP_NETWORK_MODE=testnet|mainnet with STRIPE_TEST_SECRET_KEY / STRIPE_LIVE_SECRET_KEY (see src/config/app-network.ts)'
    );
  }
  if (!defaultClient) {
    defaultClient = getStripeClient(k);
  }
  return defaultClient;
}

/**
 * Clear cached default client (e.g. tests).
 */
export function resetDefaultStripeClientCache(): void {
  defaultClient = null;
}

/**
 * Publishable key aligned with {@link getDefaultStripeSecretKey} so native apps and
 * tooling can initialize Stripe.js / PaymentSheet with the same live|test mode as the PI.
 */
export function getStripePublishableKeyForDefaultClient(): string | undefined {
  const sk = getDefaultStripeSecretKey();
  const wantLive = sk.startsWith('sk_live');
  const wantTest = sk.startsWith('sk_test');

  const ordered = [
    trimEnv('STRIPE_PUBLISHABLE_KEY'),
    trimEnv('STRIPE_PUBLIC_KEY'), // some deployments mis-name; must still be pk_* from Stripe Dashboard
    trimEnv('STRIPE_PUBLISHABLE_KEY_LIVE'),
    trimEnv('STRIPE_LIVE_PUBLISHABLE_KEY'),
    trimEnv('STRIPE_PUBLISHABLE_KEY_TEST'),
    trimEnv('STRIPE_TEST_PUBLISHABLE_KEY'),
  ];

  for (const pk of ordered) {
    if (!pk) continue;
    if (wantLive && pk.startsWith('pk_live')) return pk;
    if (wantTest && pk.startsWith('pk_test')) return pk;
  }

  const fallback = ordered.find((pk) => !!pk && pk.startsWith('pk_'));
  if (
    fallback &&
    sk &&
    sk.startsWith('sk_') &&
    fallback.startsWith('pk_') &&
    ((wantLive && fallback.startsWith('pk_test')) || (wantTest && fallback.startsWith('pk_live')))
  ) {
    console.warn(
      '[stripe] STRIPE_PUBLISHABLE_KEY* mode does not match STRIPE_SECRET_KEY (live vs test). Card payments will fail until env keys match.'
    );
  }
  return fallback;
}

/** Safe prefix for clients to compare against their bundled key without exposing full `pk_`. */
export function stripePublishableKeyPrefix(publishableKey: string | null | undefined): string | null {
  if (!publishableKey || publishableKey.length < 8) return null;
  return publishableKey.slice(0, 12);
}

/**
 * Payload for `/api/v1/stripe/client-config` and booking payment bootstrap.
 * `publishableKey` is null when STRIPE_PUBLISHABLE_KEY* is not set or cannot be resolved.
 */
export function getStripeClientConfigPayload(): {
  publishableKey: string | null;
  publishableKeyPrefix: string | null;
} {
  const publishableKey = getStripePublishableKeyForDefaultClient() ?? null;
  return {
    publishableKey,
    publishableKeyPrefix: stripePublishableKeyPrefix(publishableKey),
  };
}

const STRIPE_API_BASE = 'https://api.stripe.com';

/**
 * Same retrieval the mobile SDK performs: `GET /v1/payment_intents/:id?client_secret=…`
 * with `Authorization: Bearer pk_…`. If this returns 404, the publishable key does not
 * match the secret key’s Stripe account/mode (common cause of PaymentSheet 404 on iOS).
 */
export async function logIfPublishableKeyCannotRetrievePaymentIntent(
  paymentIntentId: string,
  clientSecret: string | null | undefined,
  publishableKey: string | null | undefined
): Promise<void> {
  if (!publishableKey?.trim()) {
    logger.warn(
      '[stripe] Skipping PaymentIntent retrieval probe: no publishable key in process env. Set STRIPE_PUBLISHABLE_KEY (same Stripe account as STRIPE_SECRET_KEY) for the PM2 Node process, restart PM2, and have the app use publishableKey from create-payment-intent or GET /api/v1/stripe/client-config — bundled pk_live in the app will 404 if it is a different account.'
    );
    return;
  }
  if (!clientSecret?.trim()) {
    logger.warn('[stripe] Skipping PaymentIntent retrieval probe: missing client_secret');
    return;
  }

  try {
    const qs = new URLSearchParams({ client_secret: clientSecret.trim() });
    const url = `${STRIPE_API_BASE}/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?${qs.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${publishableKey.trim()}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    });

    if (res.status === 404) {
      logger.warn(
        '[stripe] Publishable key cannot retrieve this PaymentIntent (404). STRIPE_PUBLISHABLE_KEY likely does not match STRIPE_SECRET_KEY (wrong account or live vs test). Restart PM2 after fixing env.',
        { paymentIntentId }
      );
      return;
    }

    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      logger.warn('[stripe] PaymentIntent retrieval probe failed', {
        paymentIntentId,
        status: res.status,
        body,
      });
    }
  } catch (e: unknown) {
    logger.warn('[stripe] PaymentIntent retrieval probe error', {
      paymentIntentId,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * One-shot boot check: secret configured but no matching publishable key → native Stripe will 404.
 */
export function warnStripePublishableKeyMisconfiguredOnBoot(): void {
  if (!isAnyStripeSecretKeyConfigured()) return;
  if (getStripePublishableKeyForDefaultClient()) return;
  logger.error(
    '[stripe] STRIPE_PUBLISHABLE_KEY is missing for this Node process while Stripe secret key(s) are set. Add STRIPE_PUBLISHABLE_KEY (pk_live_… or pk_test_… from the same Dashboard account as STRIPE_SECRET_KEY) to the PM2/env file, restart PM2, then call GET https://<host>/api/v1/stripe/client-config to verify.'
  );
}
