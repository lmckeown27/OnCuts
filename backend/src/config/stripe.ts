import Stripe from 'stripe';
import { resolveAppNetworkModeFromEnv, stripeAutoModeFromAppNetwork } from './app-network';
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

/** Non-secret fingerprint for logs (matches Stripe Dashboard “…xxxx” style). */
export function formatStripeSecretKeyForSafeLog(sk: string | undefined): string {
  if (!sk || sk.length < 12) return '(unset)';
  const kind = sk.startsWith('sk_live') ? 'live' : sk.startsWith('sk_test') ? 'test' : 'other';
  return `${kind}:${sk.slice(0, 10)}…${sk.slice(-4)}`;
}

/**
 * Standard `pk_*` / `sk_*` keys from the same Dashboard row share the same suffix after
 * `pk_live_` / `sk_live_` (or test). If suffixes differ, keys are from different Stripe accounts
 * even when both are "live".
 */
export function stripeStandardKeyAccountSuffix(k: string | undefined): string | null {
  if (!k?.trim()) return null;
  const m = k.trim().match(/^(?:pk|sk)_(live|test)_(.+)$/);
  return m ? m[2] : null;
}

export function stripePublishableKeyMatchesSecretKey(pk: string, sk: string): boolean {
  const a = stripeStandardKeyAccountSuffix(pk);
  const b = stripeStandardKeyAccountSuffix(sk);
  return !!a && !!b && a === b;
}

/**
 * Secret key for normal API traffic (checkout, Connect, etc.), not webhook-parsed livemode.
 * STRIPE_MODE live/test locks mode; auto uses APP_NETWORK_MODE unless that would send
 * production traffic to the wrong Stripe account (see testnet + sk_live note below).
 */
export function getDefaultStripeSecretKey(): string {
  const stripeModeEnv = (trimEnv('STRIPE_MODE') || 'auto').toLowerCase();
  let mode = stripeModeEnv;
  const stripeFromNet = stripeAutoModeFromAppNetwork();
  const generic = trimEnv('STRIPE_SECRET_KEY');
  const liveKey = liveStripeSecretFromEnv();
  const testKey = testStripeSecretFromEnv();

  if (mode === 'auto' && stripeFromNet) {
    // APP_NETWORK_MODE=testnet maps to Stripe "test" in auto — but many prod servers set
    // testnet for Sui while using a single sk_live for fiat. Preferring STRIPE_SECRET_KEY_TEST
    // here would create PIs on the wrong Stripe account vs the platform's pk_live.
    if (
      stripeFromNet === 'test' &&
      process.env.NODE_ENV === 'production' &&
      generic?.startsWith('sk_live') &&
      !testKey
    ) {
      mode = 'live';
      logger.info(
        '[stripe] STRIPE_MODE auto → live for API keys: NODE_ENV=production, STRIPE_SECRET_KEY is sk_live, and STRIPE_SECRET_KEY_TEST is unset. APP_NETWORK_MODE is testnet (Sui); Stripe is not forced to test. Set STRIPE_MODE=test to use test Stripe keys.'
      );
    } else {
      mode = stripeFromNet;
    }
  }

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
  const liveTestMismatch =
    !!fallback &&
    !!sk &&
    sk.startsWith('sk_') &&
    fallback.startsWith('pk_') &&
    ((wantLive && fallback.startsWith('pk_test')) || (wantTest && fallback.startsWith('pk_live')));

  if (liveTestMismatch) {
    logger.warn(
      '[stripe] STRIPE_PUBLISHABLE_KEY* mode does not match STRIPE_SECRET_KEY (live vs test). Replace with pk_live_… when using sk_live_… (or both test). Not returning a publishable key to clients until fixed.'
    );
    return undefined;
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

  const sk = getDefaultStripeSecretKey();
  const pkTrim = publishableKey.trim();
  const suffixMatch =
    sk.startsWith('sk_') && pkTrim.startsWith('pk_')
      ? stripePublishableKeyMatchesSecretKey(pkTrim, sk)
      : null;

  try {
    const qs = new URLSearchParams({ client_secret: clientSecret.trim() });
    const url = `${STRIPE_API_BASE}/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?${qs.toString()}`;
    // Stripe CLI uses `curl -u pk_live_xxx:` (Basic). Some stacks behave more reliably than Bearer for pk-only retrieve.
    const basic = Buffer.from(`${pkTrim}:`, 'utf8').toString('base64');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    });

    if (res.status === 404) {
      const sb = stripeStandardKeyAccountSuffix(sk);
      const pb = stripeStandardKeyAccountSuffix(pkTrim);
      logger.warn(
        '[stripe] Publishable key cannot retrieve this PaymentIntent (404). Common causes: (1) pk_ and sk_ are from different Stripe Dashboard accounts — both can be "live" but still not see the same PI; (2) iOS still uses a bundled pk_ that is not this server\'s key; (3) rotated keys — restart PM2. Heuristic: standard pk/sk from the same key row usually share the same substring after pk_live_/sk_live_.',
        {
          paymentIntentId,
          standardKeySuffixesMatch: suffixMatch,
          secretKeyAccountMarker: sb ? `${sb.slice(0, 14)}…` : '(n/a)',
          publishableKeyAccountMarker: pb ? `${pb.slice(0, 14)}…` : '(n/a)',
        }
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

/** One-line proof of which secret key the process uses for PaymentIntents (safe to log). */
export function logStripeDefaultSecretKeyFingerprintAtBoot(): void {
  if (!isAnyStripeSecretKeyConfigured()) return;
  const sk = getDefaultStripeSecretKey();
  if (!sk) return;
  logger.info('[stripe] Default API secret for this process', {
    keyFingerprint: formatStripeSecretKeyForSafeLog(sk),
    STRIPE_MODE: trimEnv('STRIPE_MODE') || 'auto',
    APP_NETWORK_MODE: resolveAppNetworkModeFromEnv() ?? '(unset)',
  });
}
