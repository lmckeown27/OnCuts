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

// Default notification preferences
const DEFAULT_NOTIFICATION_PREFERENCES = {
  email_notifications: true,
  push_notifications: true,
  sms_notifications: false,
  booking_reminders: true,
  promotional_emails: false,
};

/**
 * Ensure notification_preferences column exists
 */
async function ensureNotificationPreferencesColumn(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '${JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES)}'::jsonb
    `);
  } catch (error) {
    // Column might already exist or other non-critical error
    logger.debug('Notification preferences column check:', error);
  }
}

/**
 * Get notification preferences
 * Stores and retrieves from notification_preferences JSONB column
 */
export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure column exists
    await ensureNotificationPreferencesColumn();

    // Get user with notification preferences
    const result = await pool.query(
      'SELECT id, notification_preferences FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Merge stored preferences with defaults (in case new preferences are added)
    const storedPreferences = result.rows[0].notification_preferences || {};
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...storedPreferences,
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
 * Stores preferences in notification_preferences JSONB column
 */
export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const preferences = req.body;

    // Ensure column exists
    await ensureNotificationPreferencesColumn();

    // Check if user exists and get current preferences
    const userCheck = await pool.query(
      'SELECT id, notification_preferences FROM users WHERE id = $1',
      [id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Merge current preferences with new ones
    const currentPreferences = userCheck.rows[0].notification_preferences || {};
    const updatedPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...currentPreferences,
      ...preferences,
    };

    // Update the database
    await pool.query(
      'UPDATE users SET notification_preferences = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(updatedPreferences), id]
    );

    logger.info(`Updated notification preferences for user ${id}:`, updatedPreferences);

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
 * Requires password verification for security
 * Performs hard delete of user and all associated data
 */
export const deleteAccount = async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Require password for verification
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account',
      });
    }

    // Check if user exists and get password hash
    const userCheck = await client.query(
      'SELECT id, password_hash, email FROM users WHERE id = $1',
      [id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userCheck.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    // Start transaction for hard delete
    await client.query('BEGIN');

    // Counter for unique savepoint names
    let savepointCounter = 0;

    // Helper function to safely delete from a table using SAVEPOINTs
    // This allows individual queries to fail without aborting the entire transaction
    const safeDelete = async (query: string, params: any[]) => {
      const savepointName = `sp_${savepointCounter++}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(query, params);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (err: any) {
        // Roll back to savepoint to recover the transaction
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        // Only log warning for expected errors (missing tables/columns)
        if (err.code === '42P01' || err.code === '42703') {
          logger.warn(`Safe delete skipped (table/column not found): ${err.message}`);
        } else {
          // For other errors, log but continue (don't throw to avoid breaking the whole delete)
          logger.warn(`Safe delete failed (continuing): ${err.message}`);
        }
      }
    };

    // Delete in correct order to respect foreign key constraints
    // 1. Delete messages (references conversations)
    await safeDelete(
      `DELETE FROM messages 
       WHERE conversation_id IN (
         SELECT id FROM conversations WHERE user1_id = $1 OR user2_id = $1
       )`,
      [id]
    );

    // 2. Delete conversations
    await safeDelete(
      'DELETE FROM conversations WHERE user1_id = $1 OR user2_id = $1',
      [id]
    );

    // 3. Delete notifications
    await safeDelete('DELETE FROM notifications WHERE user_id = $1', [id]);

    // 4. Delete bookings (as consumer) - try both column naming conventions
    await safeDelete('DELETE FROM bookings WHERE consumer_id = $1', [id]);
    await safeDelete('DELETE FROM bookings WHERE "consumerId" = $1', [id]);
    
    // 5. Delete bookings (as barber via barber record)
    await safeDelete(
      `DELETE FROM bookings 
       WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 6. Delete barber services
    await safeDelete(
      `DELETE FROM barber_services 
       WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 7. Delete barber availability
    await safeDelete(
      `DELETE FROM barber_availability 
       WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 8. Delete barber applications
    await safeDelete('DELETE FROM barber_applications WHERE user_id = $1', [id]);

    // 9. Delete barber record
    await safeDelete('DELETE FROM barbers WHERE "userId" = $1', [id]);

    // 10. Finally delete the user (this will cascade to any tables with ON DELETE CASCADE)
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    logger.info(`Account deleted successfully: ${user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
    });
  } finally {
    client.release();
  }
};
