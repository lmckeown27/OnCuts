import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import mockDatabaseService from '../services/mock.database.service';
import { logger } from '../utils/logger';

/**
 * Get user profile
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
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

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update user
    const updatedUser = {
      ...user,
      ...updates,
      id: user.id, // Don't allow ID changes
      email: user.email, // Don't allow email changes
      role: user.role, // Don't allow role changes
      password_hash: user.password_hash, // Don't allow password changes here
    };

    // Update in mock database
    const users = mockDatabaseService['users'] as any[];
    const userIndex = users.findIndex((u) => u.id === id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
    }

    const { password_hash, ...userWithoutPassword } = updatedUser;

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

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update profile picture
    user.profile_picture_url = photoUrl;

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

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return notification preferences (or defaults)
    const preferences = user.notification_preferences || {
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

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update notification preferences
    user.notification_preferences = {
      ...user.notification_preferences,
      ...preferences,
    };

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: user.notification_preferences,
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

    const user = mockDatabaseService.getUserById(id);

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
    user.password_hash = hashedPassword;

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

    const user = mockDatabaseService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // In mock database, just mark as inactive
    user.is_active = false;

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

