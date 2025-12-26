import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../database/connection';
import mockDatabaseService from '../services/mock.database.service';
import { logger } from '../utils/logger';

/**
 * Get user profile from PostgreSQL database
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Query real PostgreSQL database
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, "campusId", 
              "avatarUrl" as profile_picture_url, bio, email_verified, "createdAt"
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];

    // Map database columns to expected frontend format
    const userData = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      campus_id: user.campusId,
      profile_picture_url: user.profile_picture_url,
      bio: user.bio,
      is_verified: user.email_verified,
      created_at: user.createdAt,
    };

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
    });
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await mockDatabaseService.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Filter out fields that shouldn't be updated
    const { id: _id, email, role, password_hash, ...allowedUpdates } = updates;

    // Update user using the service method
    const updatedUser = await mockDatabaseService.updateUser(id, allowedUpdates);

    const { password_hash: _pwd, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

/**
 * Upload profile photo
 */
export const uploadProfilePhoto = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { photoUrl } = req.body;

    const user = await mockDatabaseService.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update profile picture
    await mockDatabaseService.updateUser(id, { profile_picture_url: photoUrl });

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        profile_picture_url: photoUrl,
      },
    });
  } catch (error) {
    logger.error('Error uploading profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
    });
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await mockDatabaseService.findUserById(id);

    // Return notification preferences (or defaults for demo users)
    const preferences = user?.notification_preferences || {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      booking_reminders: true,
      promotional_emails: false,
    };

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification preferences',
    });
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const preferences = req.body;

    const user = await mockDatabaseService.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update notification preferences
    const updatedPreferences = {
      ...user.notification_preferences,
      ...preferences,
    };

    await mockDatabaseService.updateUser(id, { notification_preferences: updatedPreferences });

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: updatedPreferences,
    });
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
    });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    const user = await mockDatabaseService.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash || '');

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await mockDatabaseService.updateUser(id, { password_hash: hashedPassword });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

/**
 * Delete account
 */
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await mockDatabaseService.findUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // In mock database, just mark as inactive
    await mockDatabaseService.updateUser(id, { is_active: false });

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
    });
  }
};

