import Stripe from 'stripe';
import { resolveAppNetworkModeFromEnv, stripeAutoModeFromAppNetwork } from './app-network';
import { logger } from '../utils/logger';

/** Keep in sync across all Stripe entrypoints. */
export const STRIPE_API_VERSION = '2023-10-16' as const;

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Strip quotes and trailing junk (e.g. `>` from HTML copy-paste) from Stripe key env vars. */
function trimStripeCredentialEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  const cleaned = v.replace(/[^a-zA-Z0-9_]+$/, '');
  if (cleaned !== v) {
    logger.warn(
      `[stripe] Sanitized ${name}: removed trailing invalid characters from the env value (common when copying keys from HTML/docs)`
    );
  }
  return cleaned || undefined;
}

/**
 * Text shown on the customer's **card/bank statement** for charges (5–22 characters, Stripe rules).
 * Also influences some Stripe-generated copy when set on the PaymentIntent. For **receipt email**
 * "You paid" / business name, set your legal or DBA name in the Stripe Dashboard (see env.example).
 */
export function getOptionalStatementDescriptor(): string | undefined {
  const raw = trimEnv('STRIPE_STATEMENT_DESCRIPTOR');
  if (!raw) return undefined;
  // Stripe: 5–22 chars, Latin letters/numbers and spaces, at least one letter; avoid * etc.
  const cleaned = raw.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 5) {
    logger.warn(
      '[stripe] STRIPE_STATEMENT_DESCRIPTOR must be at least 5 characters (Stripe requirement); ignored'
    );
    return undefined;
  }
  if (cleaned.length > 22) {
    return cleaned.slice(0, 22);
  }
  if (!/[a-zA-Z]/.test(cleaned)) {
    logger.warn('[stripe] STRIPE_STATEMENT_DESCRIPTOR must contain a letter; ignored');
    return undefined;
  }
  return cleaned;
}

/** Live secret: STRIPE_SECRET_KEY_LIVE or STRIPE_LIVE_SECRET_KEY */
function liveStripeSecretFromEnv(): string | undefined {
  return trimStripeCredentialEnv('STRIPE_SECRET_KEY_LIVE') || trimStripeCredentialEnv('STRIPE_LIVE_SECRET_KEY');
}

/** Test secret: STRIPE_SECRET_KEY_TEST or STRIPE_TEST_SECRET_KEY */
function testStripeSecretFromEnv(): string | undefined {
  return trimStripeCredentialEnv('STRIPE_SECRET_KEY_TEST') || trimStripeCredentialEnv('STRIPE_TEST_SECRET_KEY');
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
    trimStripeCredentialEnv('STRIPE_SECRET_KEY') || liveStripeSecretFromEnv() || testStripeSecretFromEnv()
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
  const generic = trimStripeCredentialEnv('STRIPE_SECRET_KEY');
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
 * Random portion after `pk_live_` / `sk_live_` (or test). Brand-new key pairs often share this
 * string; after **secret rotation** Stripe keeps the publishable key and issues a new secret
 * with a different suffix — that is still a valid pair on the same account.
 */
export function stripeStandardKeyAccountSuffix(k: string | undefined): string | null {
  if (!k?.trim()) return null;
  const m = k.trim().match(/^(?:pk|sk)_(live|test)_(.+)$/);
  return m ? m[2] : null;
}

/** True when a newly minted standard key pair shares the same suffix (same Dashboard row). */
export function stripePublishableKeyMatchesSecretKey(pk: string, sk: string): boolean {
  const a = stripeStandardKeyAccountSuffix(pk);
  const b = stripeStandardKeyAccountSuffix(sk);
  return !!a && !!b && a === b;
}

/** Live|test mode alignment — required; suffix equality is not (see secret rotation). */
export function stripePublishableKeyModeMatchesSecretKey(pk: string, sk: string): boolean {
  return (
    (pk.startsWith('pk_live') && sk.startsWith('sk_live')) ||
    (pk.startsWith('pk_test') && sk.startsWith('sk_test'))
  );
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
  const generic = trimStripeCredentialEnv('STRIPE_SECRET_KEY');
  const liveKey = liveStripeSecretFromEnv();
  const testKey = testStripeSecretFromEnv();

  if (mode === 'auto' && stripeFromNet) {
    // APP_NETWORK_MODE=testnet maps to Stripe "test" in auto — but many servers set testnet
    // for Sui while using a single sk_live for fiat. Preferring STRIPE_SECRET_KEY_TEST here
    // would create PIs on the wrong Stripe account vs the platform's pk_live.
    // Do not gate this on NODE_ENV=production: PM2 often leaves NODE_ENV=development on EC2
    // while still using live Stripe keys; that would skip this fix and pick test keys when set.
    if (stripeFromNet === 'test' && generic?.startsWith('sk_live') && !testKey) {
      mode = 'live';
      logger.info(
        '[stripe] STRIPE_MODE auto → live for API keys: STRIPE_SECRET_KEY is sk_live and STRIPE_SECRET_KEY_TEST is unset — ignoring APP_NETWORK_MODE=testnet for Stripe (Sui-only). NODE_ENV=%s. Set STRIPE_MODE=test to force test Stripe keys.',
        process.env.NODE_ENV || '(unset)'
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
let lastResolvedPublishableKeyEnv: string | null = null;

/** Which env var supplied the active publishable key (for logs). */
export function getResolvedPublishableKeyEnvName(): string | null {
  return lastResolvedPublishableKeyEnv;
}

type PublishableKeyCandidate = { envName: string; value: string };

function collectPublishableKeyCandidates(envNames: string[]): PublishableKeyCandidate[] {
  return envNames
    .map((envName) => ({ envName, value: trimStripeCredentialEnv(envName) }))
    .filter((c): c is PublishableKeyCandidate => !!c.value);
}

/**
 * Publishable key aligned with {@link getDefaultStripeSecretKey} so native apps and
 * tooling can initialize Stripe.js / PaymentSheet with the same live|test mode as the PI.
 *
 * When STRIPE_MODE=test (or the secret is sk_test), test-specific env vars are preferred
 * over generic STRIPE_PUBLISHABLE_KEY so an old pk_test left in .env does not win.
 */
export function getStripePublishableKeyForDefaultClient(): string | undefined {
  const sk = getDefaultStripeSecretKey();
  const stripeMode = (trimEnv('STRIPE_MODE') || 'auto').toLowerCase();
  const wantLive = sk.startsWith('sk_live');
  const wantTest = sk.startsWith('sk_test');

  const testEnvOrder = [
    'STRIPE_PUBLISHABLE_KEY_TEST',
    'STRIPE_TEST_PUBLISHABLE_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PUBLIC_KEY',
  ];
  const liveEnvOrder = [
    'STRIPE_PUBLISHABLE_KEY_LIVE',
    'STRIPE_LIVE_PUBLISHABLE_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PUBLIC_KEY',
  ];
  const neutralEnvOrder = [
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PUBLIC_KEY',
    'STRIPE_PUBLISHABLE_KEY_LIVE',
    'STRIPE_LIVE_PUBLISHABLE_KEY',
    'STRIPE_PUBLISHABLE_KEY_TEST',
    'STRIPE_TEST_PUBLISHABLE_KEY',
  ];

  let envOrder: string[];
  if (stripeMode === 'test' || wantTest) envOrder = testEnvOrder;
  else if (stripeMode === 'live' || wantLive) envOrder = liveEnvOrder;
  else envOrder = neutralEnvOrder;

  const requiredPrefix = wantLive ? 'pk_live' : wantTest ? 'pk_test' : 'pk_';
  const candidates = collectPublishableKeyCandidates(envOrder).filter((c) =>
    requiredPrefix === 'pk_' ? c.value.startsWith('pk_') : c.value.startsWith(requiredPrefix)
  );

  if (candidates.length === 0) {
    lastResolvedPublishableKeyEnv = null;
    const anyPk = collectPublishableKeyCandidates(neutralEnvOrder).find((c) => c.value.startsWith('pk_'));
    const liveTestMismatch =
      !!anyPk &&
      !!sk &&
      sk.startsWith('sk_') &&
      ((wantLive && anyPk.value.startsWith('pk_test')) || (wantTest && anyPk.value.startsWith('pk_live')));

    if (liveTestMismatch) {
      logger.warn(
        '[stripe] STRIPE_PUBLISHABLE_KEY* mode does not match STRIPE_SECRET_KEY (live vs test). Replace with pk_live_… when using sk_live_… (or both test). Not returning a publishable key to clients until fixed.'
      );
    }
    return undefined;
  }

  const suffixMatch = candidates.find((c) => stripePublishableKeyMatchesSecretKey(c.value, sk));
  if (suffixMatch) {
    lastResolvedPublishableKeyEnv = suffixMatch.envName;
    return suffixMatch.value;
  }

  if (sk.startsWith('sk_') && candidates.length > 0) {
    const chosen = candidates[0];
    lastResolvedPublishableKeyEnv = chosen.envName;
    logger.info(
      '[stripe] Using publishable key whose suffix differs from the active secret key (expected after Stripe secret rotation). Require matching live|test mode only.',
      {
        publishableKeyEnv: chosen.envName,
        secretKeySuffixTail: stripeStandardKeyAccountSuffix(sk)?.slice(-8) ?? '(n/a)',
        publishableKeySuffixTail: stripeStandardKeyAccountSuffix(chosen.value)?.slice(-8) ?? '(n/a)',
        candidateEnvVars: candidates.map((c) => c.envName),
      }
    );
    return chosen.value;
  }

  lastResolvedPublishableKeyEnv = candidates[0]?.envName ?? null;
  return candidates[0]?.value;
}

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
  lastResolvedPublishableKeyEnv = null;
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
      const sb = stripeStandardKeyAccountSuffix(sk);
      const pb = stripeStandardKeyAccountSuffix(pkTrim);
      logger.warn('[stripe] PaymentIntent retrieval probe failed', {
        paymentIntentId,
        status: res.status,
        body,
        publishableKeyEnv: getResolvedPublishableKeyEnvName(),
        standardKeySuffixesMatch: suffixMatch,
        secretKeyAccountMarker: sb ? `…${sb.slice(-8)}` : '(n/a)',
        publishableKeyAccountMarker: pb ? `…${pb.slice(-8)}` : '(n/a)',
        hint:
          res.status === 401
            ? 'Publishable key is rejected by Stripe (invalid or from an old Dashboard account). Use pk_test from the same Developers → API keys row as STRIPE_TEST_SECRET_KEY; remove or update stale STRIPE_PUBLISHABLE_KEY, then pm2 restart all'
            : undefined,
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

/** Warn on live|test mode mismatch; suffix-only drift is OK after secret rotation. */
export function warnStripePublishableSecretKeyMismatchOnBoot(): void {
  if (!isAnyStripeSecretKeyConfigured()) return;
  const sk = getDefaultStripeSecretKey();
  const pk = getStripePublishableKeyForDefaultClient();
  if (!sk || !pk) return;

  if (!stripePublishableKeyModeMatchesSecretKey(pk, sk)) {
    logger.error(
      '[stripe] Publishable key mode does not match secret key (pk_live_ requires sk_live_, pk_test_ requires sk_test_). Fix STRIPE_PUBLISHABLE_KEY or STRIPE_SECRET_KEY, then pm2 restart.',
      {
        publishableKeyEnv: getResolvedPublishableKeyEnvName(),
        publishableKeyPrefix: stripePublishableKeyPrefix(pk),
        secretKeyFingerprint: formatStripeSecretKeyForSafeLog(sk),
      }
    );
    return;
  }

  if (!stripePublishableKeyMatchesSecretKey(pk, sk)) {
    logger.info(
      '[stripe] Publishable and secret key suffixes differ (normal after Stripe secret rotation).',
      {
        publishableKeyEnv: getResolvedPublishableKeyEnvName(),
        secretKeySuffixTail: stripeStandardKeyAccountSuffix(sk)?.slice(-8),
        publishableKeySuffixTail: stripeStandardKeyAccountSuffix(pk)?.slice(-8),
      }
    );
  }
}

/** One-line proof of which secret key the process uses for PaymentIntents (safe to log). */
export function logStripeDefaultSecretKeyFingerprintAtBoot(): void {
  if (!isAnyStripeSecretKeyConfigured()) return;
  const sk = getDefaultStripeSecretKey();
  if (!sk) return;
  const pk = getStripePublishableKeyForDefaultClient();
  logger.info('[stripe] Default API secret for this process', {
    keyFingerprint: formatStripeSecretKeyForSafeLog(sk),
    publishableKeyPrefix: stripePublishableKeyPrefix(pk),
    publishableKeyEnv: getResolvedPublishableKeyEnvName(),
    publishableKeyMatchesSecret: pk ? stripePublishableKeyMatchesSecretKey(pk, sk) : null,
    STRIPE_MODE: trimEnv('STRIPE_MODE') || 'auto',
    APP_NETWORK_MODE: resolveAppNetworkModeFromEnv() ?? '(unset)',
  });
}
