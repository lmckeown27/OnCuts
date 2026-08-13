import { logger } from './logger';
import notificationService from '../services/notification.service';
import pushNotificationService from '../services/pushNotification.service';
import { inferServiceProviderType } from '../services/service-schema.service';

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
  const data = {
    applicationId: opts.applicationId,
    operatorType,
    action: 'open_operator_home',
  };

  try {
    await notificationService.saveNotification({
      userId,
      type: 'application_approved',
      title: message,
      message,
      data,
    });
    await pushNotificationService.sendMirrorPush(
      userId,
      message,
      message,
      'application_approved',
      data
    );
  } catch (err) {
    logger.warn('Failed to notify operator of application approval', {
      userId,
      applicationId: opts.applicationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
