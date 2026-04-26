/**
 * Notification Routes for CampusCuts
 * Handles push notification device registration, preferences, and in-app notifications
 */

import express from 'express';
import { pool } from '../database/connection';
import pushNotificationService from '../services/pushNotification.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/notifications/devices
 * Debug: list push registration rows for the JWT user (token suffix only). Use when logs show "Found 0 registered devices".
 */
router.get('/devices', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const r = await pool.query(
      `SELECT id, platform, is_active, apns_environment, updated_at,
              '…' || RIGHT(device_token, 8) AS token_suffix
       FROM mobile_devices WHERE user_id = $1::uuid
       ORDER BY updated_at DESC NULLS LAST`,
      [userId]
    );
    const active = r.rows.filter((row: { is_active: boolean }) => row.is_active).length;
    res.json({
      success: true,
      data: {
        userId,
        activeDeviceCount: active,
        devices: r.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications
 * Get user's in-app notifications
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if notifications table exists, return empty if not
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist yet, return empty notifications
      console.warn('Notifications table does not exist yet');
      return res.json({
        success: true,
        data: {
          notifications: [],
          unreadCount: 0,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
          },
        },
      });
    }

    const result = await pool.query(
      `SELECT id, type, title, message, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
      [userId]
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(unreadResult.rows[0].unread),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: parseInt(countResult.rows[0].total),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    // Return empty notifications on error to prevent breaking the UI
    res.json({
      success: true,
      data: {
        notifications: [],
        unreadCount: 0,
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
        },
      },
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;

    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/all
 * Delete all notifications for the current user
 */
router.delete('/all', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications deleted',
      data: { deletedCount: result.rowCount },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/unregister-device
 * Must be registered **before** `DELETE /:id` so Express does not treat `unregister-device` as a UUID id.
 */
router.delete('/unregister-device', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { deviceToken, logoutSince } = req.body as { deviceToken?: string; logoutSince?: string };

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'deviceToken is required' },
      });
    }

    if (logoutSince) {
      await pool.query(
        `UPDATE mobile_devices
         SET is_active = false, updated_at = NOW()
         WHERE device_token = $1 AND user_id = $2 AND updated_at <= $3::timestamptz`,
        [deviceToken, userId, logoutSince]
      );
    } else {
      await pool.query(
        'UPDATE mobile_devices SET is_active = false, updated_at = NOW() WHERE device_token = $1 AND user_id = $2',
        [deviceToken, userId]
      );
    }

    res.json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/register-device
 * Register a device token for push notifications
 */
router.post('/register-device', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { deviceToken, platform: platformRaw, apnsEnvironment } = req.body;
    const platform =
      typeof platformRaw === 'string' ? platformRaw.trim().toLowerCase() : platformRaw;

    if (!deviceToken || !platform) {
      return res.status(400).json({
        success: false,
        error: { message: 'Device token and platform are required' },
      });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Platform must be ios or android' },
      });
    }

    let apnsEnv: 'sandbox' | 'production' = 'production';
    if (apnsEnvironment != null && apnsEnvironment !== '') {
      if (!['sandbox', 'production'].includes(apnsEnvironment)) {
        return res.status(400).json({
          success: false,
          error: { message: 'apnsEnvironment must be sandbox or production' },
        });
      }
      apnsEnv = apnsEnvironment;
    }

    // Check if device token already exists
    const existing = await pool.query(
      'SELECT id, user_id FROM mobile_devices WHERE device_token = $1',
      [deviceToken]
    );

    try {
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE mobile_devices SET user_id = $1, platform = $2, is_active = true,
           apns_environment = $4, updated_at = NOW() WHERE device_token = $3`,
          [userId, platform, deviceToken, apnsEnv]
        );
      } else {
        await pool.query(
          `INSERT INTO mobile_devices (user_id, device_token, platform, apns_environment) VALUES ($1, $2, $3, $4)`,
          [userId, deviceToken, platform, apnsEnv]
        );
      }
    } catch (err: any) {
      if (err?.code === '42703' && String(err?.message || '').includes('apns_environment')) {
        console.warn(
          '⚠️ mobile_devices.apns_environment missing — run backend/src/database/migrations/025_mobile_devices_apns_environment.sql'
        );
        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE mobile_devices SET user_id = $1, platform = $2, is_active = true, updated_at = NOW() WHERE device_token = $3`,
            [userId, platform, deviceToken]
          );
        } else {
          await pool.query(
            `INSERT INTO mobile_devices (user_id, device_token, platform) VALUES ($1, $2, $3)`,
            [userId, deviceToken, platform]
          );
        }
      } else {
        throw err;
      }
    }

    console.log(`✅ Registered ${platform} device for user ${userId}`);

    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        apnsEnvironment: platform === 'ios' ? apnsEnv : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const preferences = await pushNotificationService.getNotificationPreferences(userId);

    res.json({
      success: true,
      data: { preferences },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.userId;
    const { preferences } = req.body;

    const result = await pushNotificationService.updateNotificationPreferences(userId, preferences);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/test
 * Send a test notification (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', authenticate, async (req, res, next) => {
    try {
      const userId = (req as any).user.userId;

      const result = await pushNotificationService.sendSystemNotification(
        userId,
        'Test Notification',
        'This is a test notification from CampusCuts!'
      );

      res.json({
        success: true,
        message: 'Test notification sent',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });
}

export default router;

