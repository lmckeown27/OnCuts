/**
 * Push Notification Service for CampusCuts
 * Transferred from CampusKinect with CampusCuts adaptations
 * 
 * Handles:
 * - iOS push notifications (APN)
 * - Android push notifications (FCM)
 * - Booking confirmations and reminders
 * - Chat message notifications
 * - Badge management
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

// Optional mobile dependencies - gracefully handle if not installed
let apn: any, admin: any;
try {
  apn = require('apn');
} catch (error) {
  console.log('📱 APN module not installed - iOS push notifications disabled');
}

try {
  admin = require('firebase-admin');
} catch (error) {
  console.log('📱 Firebase Admin module not installed - Android push notifications disabled');
}

interface NotificationData {
  title: string;
  body: string;
  type: string;
  category?: string;
  sound?: string;
  badge?: number;
  data?: Record<string, any>;
}

interface DeviceResult {
  platform: string;
  token: string;
  result?: any;
  error?: string;
}

/** Load .p8 content: inline PEM (with literal \\n) or path relative to `process.cwd()`. */
function loadApnP8FromEnv(envValue: string, envLabel: string): string {
  const fs = require('fs');
  const path = require('path');
  if (envValue.includes('BEGIN PRIVATE KEY')) {
    return envValue.replace(/\\n/g, '\n');
  }
  const keyPath = path.resolve(process.cwd(), envValue);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`${envLabel}: private key file not found: ${keyPath}`);
  }
  return fs.readFileSync(keyPath, 'utf8');
}

class PushNotificationService {
  /** Production APNs gateway (TestFlight / App Store tokens). */
  private apnProviderProduction: any = null;
  /** Sandbox APNs gateway (Xcode / development tokens). */
  private apnProviderSandbox: any = null;
  private fcmApp: any = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    console.log('📱 Initializing push notification services...');

    // Initialize Apple Push Notification service — both gateways so each device can use the right one (see mobile_devices.apns_environment).
    if (apn && process.env.APN_KEY_ID && process.env.APN_TEAM_ID && process.env.APN_PRIVATE_KEY) {
      try {
        const teamId = process.env.APN_TEAM_ID;
        const prodPem = loadApnP8FromEnv(process.env.APN_PRIVATE_KEY, 'APN_PRIVATE_KEY');
        const prodKeyId = process.env.APN_KEY_ID;

        let sandboxPem = prodPem;
        let sandboxKeyId = prodKeyId;
        if (process.env.APN_SANDBOX_KEY_ID && process.env.APN_SANDBOX_PRIVATE_KEY) {
          sandboxKeyId = process.env.APN_SANDBOX_KEY_ID;
          sandboxPem = loadApnP8FromEnv(
            process.env.APN_SANDBOX_PRIVATE_KEY,
            'APN_SANDBOX_PRIVATE_KEY'
          );
          console.log('📱 APN: sandbox gateway uses APN_SANDBOX_KEY_ID + APN_SANDBOX_PRIVATE_KEY');
        } else {
          console.log('📱 APN: sandbox gateway uses same .p8 as production (recommended)');
        }

        this.apnProviderProduction = new apn.Provider({
          token: { key: prodPem, keyId: prodKeyId, teamId },
          production: true,
        });
        this.apnProviderSandbox = new apn.Provider({
          token: { key: sandboxPem, keyId: sandboxKeyId, teamId },
          production: false,
        });
        console.log('✅ APN: production + sandbox providers initialized (per-device apns_environment)');
      } catch (error: any) {
        console.error('❌ Failed to initialize APN Providers:', error.message);
        this.apnProviderProduction = null;
        this.apnProviderSandbox = null;
      }
    } else {
      console.log('❌ APN Providers not initialized - missing APN_KEY_ID / APN_TEAM_ID / APN_PRIVATE_KEY');
    }

    // Initialize Firebase Cloud Messaging
    if (admin && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        this.fcmApp = admin.initializeApp(
          {
            credential: admin.credential.cert(serviceAccount),
          },
          'campuscuts-mobile'
        );

        console.log('✅ FCM initialized');
      } catch (error: any) {
        console.error('❌ FCM initialization failed:', error.message);
        this.fcmApp = null;
      }
    } else {
      console.log('❌ FCM not initialized - missing FIREBASE_SERVICE_ACCOUNT');
    }
  }

  /**
   * Send notification to a user
   */
  async sendNotification(userId: string | number, notification: NotificationData): Promise<any> {
    try {
      console.log(`📱 Sending notification to user ${userId}:`, {
        title: notification.title,
        body: notification.body,
        type: notification.type,
      });

      // Get user's registered devices (apns_environment: sandbox = Xcode token, production = TestFlight/App Store)
      let devices: { rows: Array<{ device_token: string; platform: string; apns_environment?: string }> };
      try {
        devices = await pool.query(
          `SELECT device_token, platform,
                  COALESCE(apns_environment, 'production') AS apns_environment
           FROM mobile_devices WHERE user_id = $1 AND is_active = true`,
          [userId]
        );
      } catch (err: any) {
        // 42703 = undefined_column — deploy migration 025 before relying on per-device sandbox
        if (err?.code === '42703' && String(err?.message || '').includes('apns_environment')) {
          logger.warn(
            '📱 mobile_devices.apns_environment missing — run migration 025; using production APNs for all devices',
            { userId }
          );
          devices = await pool.query(
            `SELECT device_token, platform FROM mobile_devices WHERE user_id = $1 AND is_active = true`,
            [userId]
          );
          devices.rows = devices.rows.map((r: { device_token: string; platform: string }) => ({
            ...r,
            apns_environment: 'production',
          }));
        } else {
          throw err;
        }
      }

      console.log(`📱 Found ${devices.rows.length} registered devices`);

      if (devices.rows.length === 0) {
        logger.warn('📱 Push not delivered: no registered devices', {
          userId,
          notificationType: notification.type,
        });
        return { success: false, reason: 'No registered devices' };
      }

      const results: DeviceResult[] = [];
      const apnOk = !!(this.apnProviderProduction || this.apnProviderSandbox);

      for (const device of devices.rows) {
        try {
          if (device.platform === 'ios' && apnOk) {
            const apnsEnv =
              device.apns_environment === 'sandbox' ? 'sandbox' : 'production';
            const result = await this.sendIOSNotificationWithEnvFallback(
              device.device_token,
              notification,
              apnsEnv,
              userId
            );
            results.push({ platform: 'ios', token: device.device_token, result });
          } else if (device.platform === 'android' && this.fcmApp) {
            const result = await this.sendAndroidNotification(device.device_token, notification, userId);
            results.push({ platform: 'android', token: device.device_token, result });
          } else if (device.platform === 'ios' && !apnOk) {
            logger.warn('📱 Push skipped: iOS device but APN providers not initialized', {
              userId,
              notificationType: notification.type,
            });
          } else if (device.platform === 'android' && !this.fcmApp) {
            logger.warn('📱 Push skipped: Android device but FCM not initialized', {
              userId,
              notificationType: notification.type,
            });
          }
        } catch (deviceError: any) {
          console.error(`❌ Error sending to device:`, deviceError);
          results.push({
            platform: device.platform,
            token: device.device_token,
            error: deviceError.message,
          });
        }
      }

      if (results.length === 0 && devices.rows.length > 0) {
        logger.warn('📱 Push not delivered: no sends attempted (check APN/FCM env and platform)', {
          userId,
          notificationType: notification.type,
          deviceCount: devices.rows.length,
          platforms: [...new Set(devices.rows.map((d: { platform: string }) => d.platform))],
          apnInitialized: apnOk,
          fcmInitialized: !!this.fcmApp,
        });
        return {
          success: false,
          reason: 'No push provider available for registered device platforms',
        };
      }

      // Log notification
      await this.logNotification(userId, notification, results);

      return { success: true, results };
    } catch (error) {
      console.error('❌ Push notification error:', error);
      logger.error('📱 Push notification error', {
        userId,
        err: error instanceof Error ? error.message : error,
      });
      return { success: false, error };
    }
  }

  private getApnProvider(apnsEnvironment: 'sandbox' | 'production'): any {
    return apnsEnvironment === 'sandbox'
      ? this.apnProviderSandbox
      : this.apnProviderProduction;
  }

  /**
   * Try preferred APNs environment; on sandbox/production token mismatch, retry the other gateway once and persist `apns_environment`.
   * Helps clients (e.g. Intera) that registered before sending apnsEnvironment.
   */
  private async sendIOSNotificationWithEnvFallback(
    deviceToken: string,
    notification: NotificationData,
    preferredEnv: 'sandbox' | 'production',
    userId: string | number
  ): Promise<any> {
    try {
      return await this.sendIOSNotification(deviceToken, notification, preferredEnv, userId);
    } catch (firstErr: any) {
      const m = String(firstErr?.message || '');
      if (
        !m.includes('BadEnvironmentKeyInToken') &&
        !m.includes('BadCertificateEnvironment')
      ) {
        throw firstErr;
      }
      const alt: 'sandbox' | 'production' =
        preferredEnv === 'production' ? 'sandbox' : 'production';
      logger.warn('📱 APNs gateway mismatch — retrying with alternate environment', {
        tokenSuffix: deviceToken.length > 8 ? `…${deviceToken.slice(-8)}` : '(short)',
        tried: preferredEnv,
        retry: alt,
      });
      const result = await this.sendIOSNotification(deviceToken, notification, alt, userId);
      try {
        await pool.query(
          `UPDATE mobile_devices SET apns_environment = $1, updated_at = NOW() WHERE device_token = $2`,
          [alt, deviceToken]
        );
        logger.info('📱 Persisted apns_environment after successful alternate-gateway send', {
          apns_environment: alt,
        });
      } catch (dbErr: any) {
        logger.warn('📱 Could not persist apns_environment', {
          err: dbErr?.message,
        });
      }
      return result;
    }
  }

  /**
   * Send iOS notification via APN
   */
  private async sendIOSNotification(
    deviceToken: string,
    notification: NotificationData,
    apnsEnvironment: 'sandbox' | 'production' = 'production',
    userId: string | number
  ): Promise<any> {
    const provider = this.getApnProvider(apnsEnvironment);
    if (!provider) {
      throw new Error('APN Provider not initialized');
    }

    const note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    note.topic = process.env.APN_BUNDLE_ID || 'com.campuscuts.ios';

    const isBadgeOnly =
      notification.type === 'badge_update' ||
      (notification.data?.silent === true &&
        !(notification.title || '').trim() &&
        !(notification.body || '').trim());

    if (isBadgeOnly) {
      // Silent badge sync: no alert (empty alert still shows a broken banner on some iOS versions)
      note.contentAvailable = true;
      note.priority = 5;
      note.badge = notification.badge ?? 0;
    } else {
      note.badge = notification.badge ?? 1;
      note.sound = notification.sound || 'default';
      note.alert = {
        title: notification.title,
        body: notification.body,
      };
      if (notification.category) {
        note.category = notification.category;
      }
    }

    note.payload = {
      ...notification.data,
      type: notification.type,
      category: notification.category,
    };

    const result = await provider.send(note, deviceToken);

    // Apple can reject the notification (wrong env/token/topic) while still returning 200 from our HTTP client.
    // node-apn puts rejections in `failed`; `sent` stays empty — we must not treat that as success.
    if (result.failed && result.failed.length > 0) {
      for (const failure of result.failed) {
        const apnsReason =
          (failure as any).response?.reason ||
          (failure as any).error?.message ||
          (failure as any).status ||
          'unknown';
        logger.warn('📱 APNs rejected notification', {
          tokenSuffix: deviceToken.length > 8 ? `…${deviceToken.slice(-8)}` : '(short)',
          httpStatus: (failure as any).status,
          reason: apnsReason,
          topic: note.topic,
          apnsGateway: apnsEnvironment,
          hint:
            apnsReason === 'BadDeviceToken' || apnsReason === 'DeviceTokenNotForTopic'
              ? 'Check APN_BUNDLE_ID matches the app; re-register device with apnsEnvironment sandbox vs production'
              : apnsReason === 'BadCertificateEnvironment' || apnsReason === 'BadEnvironmentKeyInToken'
                ? 'Token/gateway mismatch: POST /notifications/register-device with apnsEnvironment "sandbox" for Xcode builds, "production" for TestFlight/App Store'
                : undefined,
        });
        const st = String((failure as any).status || '');
        const reasonStr = String(apnsReason);
        // Only drop tokens Apple says are gone/invalid — not 400 in general (env/topic/config errors also use 400).
        const shouldDeactivateToken =
          st === '410' ||
          reasonStr === 'BadDeviceToken' ||
          reasonStr === 'Unregistered';
        if (shouldDeactivateToken) {
          await this.deactivateDevice(deviceToken, userId, {
            reason: reasonStr,
            httpStatus: st,
          });
        }
      }
    }

    const sentCount = result.sent?.length ?? 0;
    if (sentCount === 0 && (result.failed?.length ?? 0) > 0) {
      const firstReason =
        (result.failed![0] as any).response?.reason ||
        (result.failed![0] as any).error?.message ||
        'APNs did not accept notification';
      throw new Error(`APNs failed: ${firstReason}`);
    }

    return result;
  }

  /**
   * Send Android notification via FCM
   */
  private async sendAndroidNotification(
    deviceToken: string,
    notification: NotificationData,
    userId: string | number
  ): Promise<any> {
    if (!this.fcmApp) {
      throw new Error('FCM not initialized');
    }

    const message = {
      token: deviceToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: notification.sound || 'default',
          channelId: 'campuscuts_notifications',
        },
      },
    };

    try {
      const result = await admin.messaging(this.fcmApp).send(message);
      return { success: true, messageId: result };
    } catch (error: any) {
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        await this.deactivateDevice(deviceToken, userId, {
          reason: String(error?.code || error?.message || 'fcm_error'),
        });
      }
      throw error;
    }
  }

  /**
   * Deactivate invalid device token (APNs 410 / BadDeviceToken / Unregistered, or FCM invalid token).
   * Scoped to user_id so we never flip another user's row; bumps updated_at for debugging.
   */
  private async deactivateDevice(
    deviceToken: string,
    userId: string | number,
    meta?: { reason?: string; httpStatus?: string }
  ): Promise<void> {
    try {
      const r = await pool.query(
        `UPDATE mobile_devices
         SET is_active = false, updated_at = NOW()
         WHERE device_token = $1 AND user_id = $2`,
        [deviceToken, userId]
      );
      if ((r.rowCount ?? 0) > 0) {
        logger.warn('📱 Deactivated mobile_devices row after push provider rejected token', {
          userId,
          tokenSuffix: deviceToken.length > 8 ? `…${deviceToken.slice(-8)}` : '(short)',
          ...meta,
        });
      }
    } catch (error) {
      console.error('Error deactivating device:', error);
    }
  }

  /**
   * Log notification for analytics
   */
  private async logNotification(
    userId: string | number,
    notification: NotificationData,
    results: DeviceResult[]
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO notification_logs (user_id, title, body, type, results, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, notification.title, notification.body, notification.type || 'general', JSON.stringify(results)]
      );
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  // MARK: - Notification Templates

  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmationNotification(
    userId: string | number,
    barberName: string,
    service: string,
    dateTime: string
  ): Promise<any> {
    const notification: NotificationData = {
      title: 'Booking Confirmed!',
      body: `${barberName} confirmed your ${service} appointment for ${dateTime}`,
      type: 'booking_confirmation',
      category: 'BOOKING_CATEGORY',
      sound: 'default',
      badge: 1,
      data: {
        type: 'booking_confirmation',
        action: 'open_bookings',
      },
    };

    return await this.sendNotification(userId, notification);
  }

  /**
   * Send appointment reminder notification
   */
  async sendAppointmentReminderNotification(
    userId: string | number,
    barberName: string,
    service: string,
    hoursUntil: number
  ): Promise<any> {
    const notification: NotificationData = {
      title: `Appointment in ${hoursUntil} hours`,
      body: `${service} with ${barberName} is coming up soon!`,
      type: 'booking_reminder',
      category: 'REMINDER_CATEGORY',
      sound: 'default',
      badge: 1,
      data: {
        type: 'booking_reminder',
        action: 'open_bookings',
      },
    };

    return await this.sendNotification(userId, notification);
  }

  /**
   * Send chat message notification
   */
  async sendMessageNotification(
    recipientId: string | number,
    senderName: string,
    messagePreview: string
  ): Promise<any> {
    // Get unread message count for badge
    let unreadCount = 1;
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE (c.user1_id = $1 OR c.user2_id = $1)
         AND m.sender_id != $1 AND m.is_read = false`,
        [recipientId]
      );
      unreadCount = parseInt(result.rows[0]?.count || '1');
    } catch (error) {
      console.error('Failed to get unread count:', error);
    }

    const notification: NotificationData = {
      title: senderName,
      body: messagePreview.length > 50 ? `${messagePreview.substring(0, 50)}...` : messagePreview,
      type: 'message',
      category: 'MESSAGE_CATEGORY',
      sound: 'default',
      badge: unreadCount,
      data: {
        type: 'message',
        action: 'open_chat',
        unreadCount,
      },
    };

    const result = await this.sendNotification(recipientId, notification);
    if (!result?.success) {
      const reason =
        typeof result?.reason === 'string'
          ? result.reason
          : result?.error
            ? String(result.error)
            : 'unknown';
      logger.warn('📱 Message push not delivered', {
        recipientId,
        reason,
        notificationType: 'message',
      });
    }
    return result;
  }

  /**
   * Send payment received notification (for barbers)
   */
  async sendPaymentReceivedNotification(
    barberId: string | number,
    amount: number,
    studentName: string
  ): Promise<any> {
    const notification: NotificationData = {
      title: 'Payment Received!',
      body: `You received $${amount.toFixed(2)} from ${studentName}`,
      type: 'payment_received',
      category: 'PAYMENT_CATEGORY',
      sound: 'default',
      badge: 1,
      data: {
        type: 'payment_received',
        action: 'open_earnings',
      },
    };

    return await this.sendNotification(barberId, notification);
  }

  /**
   * Send review notification (for barbers)
   */
  async sendReviewNotification(
    barberId: string | number,
    studentName: string,
    rating: number
  ): Promise<any> {
    const notification: NotificationData = {
      title: 'New Review!',
      body: `${studentName} rated you ${rating} stars`,
      type: 'review',
      category: 'REVIEW_CATEGORY',
      sound: 'default',
      badge: 1,
      data: {
        type: 'review',
        action: 'open_reviews',
      },
    };

    return await this.sendNotification(barberId, notification);
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(
    userId: string | number,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<any> {
    const notification: NotificationData = {
      title,
      body,
      type: 'system',
      category: 'SYSTEM_CATEGORY',
      sound: 'default',
      data: {
        type: 'system',
        ...data,
      },
    };

    return await this.sendNotification(userId, notification);
  }

  /**
   * Mirror an in-app notification row to APNs/FCM so lock-screen banners appear when a device is registered.
   * Call after notificationService.saveNotification for booking-related events.
   */
  async sendMirrorPush(
    userId: string | number,
    title: string,
    body: string,
    type: string,
    data: Record<string, unknown> = {}
  ): Promise<any> {
    let category = 'BOOKING_CATEGORY';
    if (type === 'payment_received') category = 'PAYMENT_CATEGORY';
    else if (type === 'new_review' || type === 'review') category = 'REVIEW_CATEGORY';

    return this.sendNotification(userId, {
      title,
      body,
      type,
      category,
      sound: 'default',
      badge: 1,
      data: { ...data, type },
    });
  }

  /**
   * Update badge count
   */
  async updateBadgeCount(userId: string | number, badgeCount: number | null = null): Promise<any> {
    try {
      if (badgeCount === null) {
        // Get current unread count (messages + pending bookings)
        const result = await pool.query(
          `SELECT 
            (SELECT COUNT(*) FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE (c.user1_id = $1 OR c.user2_id = $1)
             AND m.sender_id != $1 AND m.is_read = false) +
            (SELECT COUNT(*) FROM bookings
             WHERE "consumerId" = $1
             AND status = 'PENDING') as count`,
          [userId]
        );
        badgeCount = parseInt(result.rows[0]?.count || '0');
      }

      const notification: NotificationData = {
        title: '',
        body: '',
        type: 'badge_update',
        badge: badgeCount,
        data: {
          type: 'badge_update',
          silent: true,
        },
      };

      return await this.sendNotification(userId, notification);
    } catch (error) {
      console.error('Failed to update badge count:', error);
      return { success: false, error };
    }
  }

  /**
   * Clear badge
   */
  async clearBadge(userId: string | number): Promise<any> {
    return await this.updateBadgeCount(userId, 0);
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string | number): Promise<any> {
    try {
      const result = await pool.query(
        'SELECT notification_preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return this.getDefaultPreferences();
      }

      return result.rows[0].notification_preferences || this.getDefaultPreferences();
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Default notification preferences
   */
  private getDefaultPreferences() {
    return {
      bookings: true,
      messages: true,
      payments: true,
      reviews: true,
      reminders: true,
      system: true,
      marketing: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(userId: string | number, preferences: any): Promise<any> {
    try {
      await pool.query('UPDATE users SET notification_preferences = $1 WHERE id = $2', [
        JSON.stringify(preferences),
        userId,
      ]);
      return { success: true };
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error };
    }
  }

  /**
   * Check if user should receive notification
   */
  async shouldSendNotification(userId: string | number, notificationType: string): Promise<boolean> {
    try {
      const preferences = await this.getNotificationPreferences(userId);

      // Check if notification type is enabled
      if (!preferences[notificationType]) {
        return false;
      }

      // Check quiet hours
      if (preferences.quietHours && preferences.quietHours.enabled) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        const { start, end } = preferences.quietHours;

        if (start < end) {
          if (currentTime >= start || currentTime <= end) {
            return false;
          }
        } else {
          if (currentTime >= start && currentTime <= end) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to sending
    }
  }
}

export default new PushNotificationService();

