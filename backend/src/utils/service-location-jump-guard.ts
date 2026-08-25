import type { ServiceLocationSource } from '../services/barber-location-schema.service';

/**
 * Whether to run the max-distance jump check for a device GPS service-location update.
 * Manual pins are placeholders — resuming device tracking should accept real GPS.
 */
export function shouldApplyDeviceLocationJumpGuard(params: {
  hasServiceAnchor: boolean;
  previousSource: ServiceLocationSource | null;
  resumeDeviceTracking: boolean;
}): boolean {
  if (!params.hasServiceAnchor) return false;
  if (params.previousSource === 'manual') return false;
  if (params.resumeDeviceTracking) return false;
  return true;
}

/**
 * Keep an existing public label when device tracking uses a privacy estimate (e.g. "UCSB").
 * Do not preserve labels from manual pins when switching back to device GPS.
 */
export function shouldPreserveDevicePrivacyLabel(
  currentLabel: unknown,
  previousSource: ServiceLocationSource | null
): boolean {
  if (previousSource !== 'device') return false;
  return typeof currentLabel === 'string' && currentLabel.trim().length > 0;
}
