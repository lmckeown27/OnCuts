/**
 * Notification Routes for CampusCuts
 * Handles push notification device registration and preferences
 */

import express from 'express';
import { pool } from '../database/connection';
import pushNotificationService from '../services/pushNotification.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/notifications/register-device
 * Register a device token for push notifications
 */
router.post('/register-device', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { deviceToken, platform } = req.body;

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

    // Check if device token already exists
    const existing = await pool.query(
      'SELECT id, user_id FROM mobile_devices WHERE device_token = $1',
      [deviceToken]
    );

    if (existing.rows.length > 0) {
      // Update existing device token
      await pool.query(
        'UPDATE mobile_devices SET user_id = $1, platform = $2, is_active = true, updated_at = NOW() WHERE device_token = $3',
        [userId, platform, deviceToken]
      );
    } else {
      // Insert new device token
      await pool.query(
        'INSERT INTO mobile_devices (user_id, device_token, platform) VALUES ($1, $2, $3)',
        [userId, deviceToken, platform]
      );
    }

    console.log(`✅ Registered ${platform} device for user ${userId}`);

    res.json({
      success: true,
      message: 'Device registered successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/unregister-device
 * Unregister a device token
 */
router.delete('/unregister-device', authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user.id;
    const { deviceToken } = req.body;

    await pool.query(
      'UPDATE mobile_devices SET is_active = false WHERE device_token = $1 AND user_id = $2',
      [deviceToken, userId]
    );

    res.json({
      success: true,
      message: 'Device unregistered successfully',
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
    const userId = (req as any).user.id;
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
    const userId = (req as any).user.id;
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
      const userId = (req as any).user.id;

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

