import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../database/connection';
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

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Build update query dynamically
    // Map frontend field names to database column names
    const fieldMapping: { [key: string]: string } = {
      first_name: 'first_name',
      last_name: 'last_name',
      displayName: 'displayName',
      bio: 'bio',
      avatarUrl: 'avatarUrl',
      profile_picture_url: 'avatarUrl', // Frontend sends profile_picture_url, maps to avatarUrl
      phoneNumber: 'phoneNumber',
      instagramHandle: 'instagramHandle',
    };
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [inputField, dbField] of Object.entries(fieldMapping)) {
      if (updates[inputField] !== undefined) {
        updateFields.push(`"${dbField}" = $${paramIndex}`);
        values.push(updates[inputField]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Add updatedAt
    updateFields.push(`"updatedAt" = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, role, "campusId", "avatarUrl" as profile_picture_url, bio, "createdAt"
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0],
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

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update profile picture
    await pool.query(
      'UPDATE users SET "avatarUrl" = $1, "updatedAt" = NOW() WHERE id = $2',
      [photoUrl, id]
    );

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
 * Note: notification_preferences column may not exist yet - return defaults
 */
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return default notification preferences
    // TODO: Add notification_preferences column to users table for customization
    const preferences = {
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
 * Note: notification_preferences column may not exist yet - just return success
 */
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const preferences = req.body;

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // TODO: Add notification_preferences column to users table
    // For now, just acknowledge the update
    const updatedPreferences = {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      booking_reminders: true,
      promotional_emails: false,
      ...preferences,
    };

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

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];

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
    await pool.query(
      'UPDATE users SET password_hash = $1, "updatedAt" = NOW() WHERE id = $2',
      [hashedPassword, id]
    );

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

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Mark as blocked (soft delete)
    await pool.query(
      'UPDATE users SET "isBlocked" = true, "updatedAt" = NOW() WHERE id = $1',
      [id]
    );

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
