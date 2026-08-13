import { logger } from './logger';
import { inferServiceProviderType } from '../services/service-schema.service';
import { sendTemplatedNotification } from '../services/notification-template.service';

function operatorTypeLabel(specialties: unknown): 'Barber' | 'Beauty' {
  const list = Array.isArray(specialties) ? specialties : [];
  const isBeauty = list.some(
    (item) => inferServiceProviderType(null, item) === 'beauty'
  );
  return isBeauty ? 'Beauty' : 'Barber';
}

/**
 * In-app + Operator-app APNs when a consumer becomes a BARBER after approval.
 * Call after the users.role update and barbers row exist so topic routing uses the provider app.
 */
export async function notifyOperatorApplicationApproved(opts: {
  userId: string;
  applicationId: string;
  specialties?: unknown;
}): Promise<void> {
  const userId = String(opts.userId ?? '').trim();
  if (!userId) return;

  const operatorType = operatorTypeLabel(opts.specialties);
  const message = `Your ${operatorType} application was accepted. Welcome to OnCuts`;
  try {
    await sendTemplatedNotification({
      userId,
      key: 'application_approved',
      side: 'operator',
      vars: { operatorType },
      type: 'application_approved',
      data: {
        applicationId: opts.applicationId,
        operatorType,
        action: 'open_operator_home',
      },
      fallbackTitle: message,
      fallbackBody: message,
    });
  } catch (err) {
    logger.warn('Failed to notify operator of application approval', {
      userId,
      applicationId: opts.applicationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
