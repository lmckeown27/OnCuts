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

class PushNotificationService {
  private apnProvider: any = null;
  private fcmApp: any = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    console.log('📱 Initializing push notification services...');

    // Initialize Apple Push Notification service
    if (apn && process.env.APN_KEY_ID && process.env.APN_TEAM_ID && process.env.APN_PRIVATE_KEY) {
      try {
        const fs = require('fs');
        const path = require('path');

        let privateKey: string;

        // Check if APN_PRIVATE_KEY is file path or actual key content
        if (process.env.APN_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
          privateKey = process.env.APN_PRIVATE_KEY.replace(/\\n/g, '\n');
          console.log('📱 Using APN private key from environment variable');
        } else {
          const keyPath = path.resolve(process.cwd(), process.env.APN_PRIVATE_KEY);
          console.log('📱 Reading APN private key from file:', keyPath);

          if (!fs.existsSync(keyPath)) {
            throw new Error(`APN private key file not found: ${keyPath}`);
          }

          privateKey = fs.readFileSync(keyPath, 'utf8');
          console.log('✅ APN private key file read successfully');
        }

        // Xcode/debug builds use sandbox tokens; App Store/TestFlight use production.
        // Set APN_USE_SANDBOX=true if NODE_ENV is production but you only test with dev builds.
        const forceSandbox =
          process.env.APN_USE_SANDBOX === 'true' || process.env.APN_USE_SANDBOX === '1';
        const apnProduction = !forceSandbox && process.env.NODE_ENV === 'production';

        const apnOptions = {
          token: {
            key: privateKey,
            keyId: process.env.APN_KEY_ID,
            teamId: process.env.APN_TEAM_ID,
          },
          production: apnProduction,
        };

        console.log(`📱 APN client: ${apnProduction ? 'production' : 'sandbox'} gateway`);

        this.apnProvider = new apn.Provider(apnOptions);
        console.log('✅ APN Provider initialized successfully');
      } catch (error: any) {
        console.error('❌ Failed to initialize APN Provider:', error.message);
        this.apnProvider = null;
      }
    } else {
      console.log('❌ APN Provider not initialized - missing environment variables');
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

      // Get user's registered devices
      const devices = await pool.query(
        'SELECT device_token, platform FROM mobile_devices WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      console.log(`📱 Found ${devices.rows.length} registered devices`);

      if (devices.rows.length === 0) {
        logger.warn('📱 Push not delivered: no registered devices', {
          userId,
          notificationType: notification.type,
        });
        return { success: false, reason: 'No registered devices' };
      }

      const results: DeviceResult[] = [];

      for (const device of devices.rows) {
        try {
          if (device.platform === 'ios' && this.apnProvider) {
            const result = await this.sendIOSNotification(device.device_token, notification);
            results.push({ platform: 'ios', token: device.device_token, result });
          } else if (device.platform === 'android' && this.fcmApp) {
            const result = await this.sendAndroidNotification(device.device_token, notification);
            results.push({ platform: 'android', token: device.device_token, result });
          } else if (device.platform === 'ios' && !this.apnProvider) {
            logger.warn('📱 Push skipped: iOS device but APN provider not initialized', {
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
          apnInitialized: !!this.apnProvider,
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

  /**
   * Send iOS notification via APN
   */
  private async sendIOSNotification(deviceToken: string, notification: NotificationData): Promise<any> {
    if (!this.apnProvider) {
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

    const result = await this.apnProvider.send(note, deviceToken);

    // Handle failed devices
    if (result.failed && result.failed.length > 0) {
      for (const failure of result.failed) {
        if (failure.status === '410' || failure.status === '400') {
          await this.deactivateDevice(deviceToken);
        }
      }
    }

    return result;
  }

  /**
   * Send Android notification via FCM
   */
  private async sendAndroidNotification(
    deviceToken: string,
    notification: NotificationData
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
        await this.deactivateDevice(deviceToken);
      }
      throw error;
    }
  }

  /**
   * Deactivate invalid device token
   */
  private async deactivateDevice(deviceToken: string): Promise<void> {
    try {
      await pool.query('UPDATE mobile_devices SET is_active = false WHERE device_token = $1', [
        deviceToken,
      ]);
      console.log(`Deactivated invalid device token`);
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

