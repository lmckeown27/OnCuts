/**
 * APNs apns-topic (bundle ID) routing for dual Intera apps on one backend.
 *
 * Consumer and Provider share the same Team ID, Key ID, and .p8 — only the
 * `apns-topic` header differs per app. Resolution order for each send:
 *
 *   1. mobile_devices.bundle_id — from POST /notifications/register-device (most accurate)
 *   2. Role-based env — CONSUMER_APN_BUNDLE_ID vs PROVIDER_APN_BUNDLE_ID
 *   3. Legacy APN_BUNDLE_ID (defaults to com.campuscuts.ios)
 */

import { pool } from '../database/connection';

/** Which Intera iOS app should receive the push (drives env topic fallback). */
export type RecipientApnApp = 'consumer' | 'provider';

export interface ApnTopicResolution {
  topic: string;
  /** Where `topic` came from — for logs and DeviceTokenNotForTopic debugging. */
  source: string;
  recipientApp: RecipientApnApp;
}

/**
 * Read bundle ID from env without altering interior characters
 * (e.g. Liam.Intera---Provider must keep three hyphens).
 */
export function readApnBundleIdEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Env topic for consumer vs provider app (no DB / per-device row). */
export function topicForRecipientApp(app: RecipientApnApp): string | null {
  if (app === 'provider') {
    return (
      readApnBundleIdEnv('PROVIDER_APN_BUNDLE_ID') ??
      readApnBundleIdEnv('APN_PROVIDER_BUNDLE_ID')
    );
  }
  return readApnBundleIdEnv('CONSUMER_APN_BUNDLE_ID');
}

/**
 * Classify recipient for topic routing.
 * Provider = BARBER or any user with a barbers row; else consumer.
 */
export async function classifyRecipientApnApp(userId: string): Promise<RecipientApnApp> {
  const uid = String(userId ?? '').trim();
  if (!uid) return 'consumer';

  try {
    const r = await pool.query<{ role: string; has_barber: boolean }>(
      `SELECT u.role,
              EXISTS (SELECT 1 FROM barbers b WHERE b."userId" = u.id) AS has_barber
       FROM users u
       WHERE u.id = $1::uuid`,
      [uid]
    );
    if (r.rows.length === 0) return 'consumer';

    const role = String(r.rows[0].role || '').toUpperCase();
    const hasBarber = r.rows[0].has_barber === true;
    if (role === 'BARBER' || role === 'CAMPUS_MANAGER' || hasBarber) {
      return 'provider';
    }
    return 'consumer';
  } catch {
    return 'consumer';
  }
}

/**
 * Resolve apns-topic for one iOS device row + recipient user.
 * Pass `cachedRecipientApp` when sending to multiple devices for the same user (one DB lookup).
 */
export async function resolveApnTopicForRecipient(
  recipientUserId: string,
  deviceBundleId?: string | null,
  cachedRecipientApp?: RecipientApnApp
): Promise<ApnTopicResolution> {
  const recipientApp =
    cachedRecipientApp ?? (await classifyRecipientApnApp(recipientUserId));

  const perDevice =
    typeof deviceBundleId === 'string' ? deviceBundleId.trim() : '';
  if (perDevice) {
    return {
      topic: perDevice,
      source: 'mobile_devices.bundle_id',
      recipientApp,
    };
  }

  const roleTopic = topicForRecipientApp(recipientApp);
  if (roleTopic) {
    return {
      topic: roleTopic,
      source:
        recipientApp === 'provider'
          ? 'env.PROVIDER_APN_BUNDLE_ID'
          : 'env.CONSUMER_APN_BUNDLE_ID',
      recipientApp,
    };
  }

  const legacy = readApnBundleIdEnv('APN_BUNDLE_ID') ?? 'com.campuscuts.ios';
  return {
    topic: legacy,
    source: 'env.APN_BUNDLE_ID',
    recipientApp,
  };
}

/** Log configured topic matrix once at APN provider startup (shared .p8 for both apps). */
export function logApnTopicMatrixAtStartup(): void {
  const consumer = topicForRecipientApp('consumer');
  const provider = topicForRecipientApp('provider');
  const legacy = readApnBundleIdEnv('APN_BUNDLE_ID') ?? 'com.campuscuts.ios';
  console.log('📱 APN topic matrix (shared Team ID + .p8):', {
    consumer: consumer ?? '(unset — set CONSUMER_APN_BUNDLE_ID)',
    provider: provider ?? '(unset — set PROVIDER_APN_BUNDLE_ID)',
    legacyFallback: legacy,
  });
}

/** Actionable hint when Apple returns DeviceTokenNotForTopic / BadDeviceToken. */
export function formatApnTopicMismatchHint(
  resolution: ApnTopicResolution,
  apnsGateway: string
): string {
  const consumerTopic = topicForRecipientApp('consumer') ?? '(unset)';
  const providerTopic = topicForRecipientApp('provider') ?? '(unset)';
  return (
    `Token/topic mismatch (gateway=${apnsGateway}): recipientApp=${resolution.recipientApp}, ` +
    `topicSent=${resolution.topic} (from ${resolution.source}). ` +
    `Matrix: consumer→${consumerTopic}, provider→${providerTopic}. ` +
    `Re-register device with bundleId + apnsEnvironment sandbox|production.`
  );
}
