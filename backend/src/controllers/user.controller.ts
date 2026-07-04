import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { mayDeleteAccountWithoutPasswordBody, userNeedsPlatformPassword } from '../utils/platform-password';

/** DB column names for profile PATCH/PUT (snake_case keys only after coerce). */
const PROFILE_FIELD_MAPPING: { [key: string]: string } = {
  first_name: 'first_name',
  last_name: 'last_name',
  displayName: 'displayName',
  bio: 'bio',
  avatarUrl: 'avatarUrl',
  profile_picture_url: 'avatarUrl',
  phoneNumber: 'phoneNumber',
  instagramHandle: 'instagramHandle',
};

/** Map iOS / Intera camelCase name fields to DB keys. */
function coerceProfileBody(raw: Record<string, unknown>): Record<string, unknown> {
  const u: Record<string, unknown> = { ...raw };
  if (u.first_name === undefined && u.firstName !== undefined) u.first_name = u.firstName;
  if (u.last_name === undefined && u.lastName !== undefined) u.last_name = u.lastName;
  delete u.firstName;
  delete u.lastName;
  return u;
}

async function performUserProfileUpdate(
  userId: string,
  rawUpdates: Record<string, unknown>
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const updates = coerceProfileBody(rawUpdates);

  const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [inputField, dbField] of Object.entries(PROFILE_FIELD_MAPPING)) {
    if (updates[inputField] !== undefined) {
      updateFields.push(`"${dbField}" = $${paramIndex}`);
      values.push(updates[inputField]);
      paramIndex++;
    }
  }

  if (updateFields.length === 0) {
    return { ok: false, status: 400, message: 'No valid fields to update' };
  }

  updateFields.push(`"updatedAt" = NOW()`);
  values.push(userId);

  const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, role, "campusId", "avatarUrl" as profile_picture_url, bio, "createdAt", has_platform_password
    `;

  const result = await pool.query(query, values);
  return { ok: true, row: result.rows[0] as Record<string, unknown> };
}

/**
 * Get user profile from PostgreSQL database
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Query real PostgreSQL database
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, "campusId", 
              "avatarUrl" as profile_picture_url, bio, email_verified, "createdAt",
              has_platform_password
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
      needs_platform_password: userNeedsPlatformPassword(user),
      needsPlatformPassword: userNeedsPlatformPassword(user),
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
    const out = await performUserProfileUpdate(id, req.body as Record<string, unknown>);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, message: out.message });
    }
    const row = out.row;
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...row,
        firstName: row.first_name,
        lastName: row.last_name,
        needsPlatformPassword: userNeedsPlatformPassword(
          row as { has_platform_password?: boolean }
        ),
      },
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
 * Authenticated user updates own profile (Intera / native — no user id in URL).
 */
export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const out = await performUserProfileUpdate(userId, req.body as Record<string, unknown>);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, message: out.message });
    }
    const row = out.row;
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...row,
        firstName: row.first_name,
        lastName: row.last_name,
        needsPlatformPassword: userNeedsPlatformPassword(
          row as { has_platform_password?: boolean }
        ),
      },
    });
  } catch (error) {
    logger.error('Error updating my profile:', error);
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
      'UPDATE users SET password_hash = $1, has_platform_password = TRUE, "updatedAt" = NOW() WHERE id = $2',
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
 * First-time set password for Apple-only accounts (Bearer JWT required).
 * Allowed only while has_platform_password is false.
 */
export const setInitialPassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'newPassword is required and must be at least 8 characters',
      });
    }

    const result = await pool.query(
      'SELECT has_platform_password FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (result.rows[0].has_platform_password === true) {
      return res.status(400).json({
        success: false,
        message: 'A password is already set. Use change password instead.',
        code: 'PASSWORD_ALREADY_SET',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, has_platform_password = TRUE, "updatedAt" = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    logger.info(`Initial platform password set for user ${userId}`);

    const u = await pool.query(
      `SELECT id, email, first_name, last_name, role, "campusId", email_verified, "avatarUrl", has_platform_password
       FROM users WHERE id = $1`,
      [userId]
    );
    const row = u.rows[0];

    res.json({
      success: true,
      message: 'Password set successfully',
      data: {
        needsPlatformPassword: false,
        user: {
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          campusId: row.campusId,
          emailVerified: row.email_verified,
          profile_picture_url: row.avatarUrl,
          needsPlatformPassword: false,
        },
      },
    });
  } catch (error) {
    logger.error('Error setting initial password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set password',
    });
  }
};

/**
 * Delete account (hard delete). Authenticated user only (`:id` must match JWT).
 * Apple-linked accounts without a chosen OnCuts password may omit body password
 * (client uses Face ID / passcode first); others must send `password` for verification.
 */
export const deleteAccount = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const authReq = req as AuthRequest;
    const tokenUserId = authReq.user?.userId;
    if (!tokenUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    if (String(tokenUserId) !== String(id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account',
      });
    }

    const { password } = req.body as { password?: string };
    const passwordStr =
      typeof password === 'string' && password.length > 0 ? password : '';

    const userCheck = await client.query(
      `SELECT id, password_hash, email, has_platform_password, apple_sub, auth_provider
       FROM users WHERE id = $1`,
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userCheck.rows[0];
    const omitPassword = mayDeleteAccountWithoutPasswordBody(user);

    if (!omitPassword) {
      if (!passwordStr) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account',
        });
      }
      const isPasswordValid = await bcrypt.compare(passwordStr, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password',
        });
      }
    } else if (passwordStr) {
      const isPasswordValid = await bcrypt.compare(passwordStr, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password',
        });
      }
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

    // IDs of bookings where this user is the consumer OR the barber (via barbers."userId").
    // Reused so we delete children (payments, archives, …) before bookings.
    const userBookingIdsSubquery = `
      SELECT id FROM bookings WHERE "consumerId" = $1
      UNION
      SELECT b.id FROM bookings b
      INNER JOIN barbers br ON b."barberId" = br.id
      WHERE br."userId" = $1
    `;

    // Delete in correct order to respect foreign key constraints.
    // Production messaging is booking-centric (`conversations.booking_id`); older rows may
    // still use user1_id/user2_id — clear both paths before dropping bookings.

    // 1a. Messages on booking-tied conversations (Provider / bookings-simple path)
    await safeDelete(
      `DELETE FROM messages
       WHERE conversation_id IN (
         SELECT id FROM conversations WHERE booking_id IN (${userBookingIdsSubquery})
       )`,
      [id]
    );

    // 1b. Messages on participant-tied conversations (legacy path)
    await safeDelete(
      `DELETE FROM messages
       WHERE conversation_id IN (
         SELECT id FROM conversations WHERE user1_id = $1 OR user2_id = $1
       )`,
      [id]
    );

    // 2a. Booking-tied conversations
    await safeDelete(
      `DELETE FROM conversations WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );

    // 2b. Participant-tied conversations
    await safeDelete(
      'DELETE FROM conversations WHERE user1_id = $1 OR user2_id = $1',
      [id]
    );

    // 3. Notifications
    await safeDelete('DELETE FROM notifications WHERE user_id = $1', [id]);
    await safeDelete(
      'DELETE FROM booking_request_notifications WHERE user_id = $1',
      [id]
    );

    // 4. Payments / Stripe ledger rows — must run before deleting bookings
    await safeDelete(
      `DELETE FROM payments WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      'DELETE FROM payments WHERE consumer_id = $1 OR barber_id = $1',
      [id]
    );
    await safeDelete(
      `DELETE FROM payment_transactions WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      'DELETE FROM payment_transactions WHERE student_id = $1 OR barber_id = $1',
      [id]
    );
    await safeDelete(
      `DELETE FROM barber_payouts WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete('DELETE FROM barber_payouts WHERE barber_id = $1', [id]);

    // 5. Archived / legacy booking message tables
    await safeDelete(
      `DELETE FROM archived_booking_messages WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      `DELETE FROM booking_messages WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      `DELETE FROM booking_request_notifications WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      'DELETE FROM pending_payouts WHERE booking_id IN (' + userBookingIdsSubquery + ')',
      [id]
    );

    // 6. Reviews / disputes — try snake_case and camelCase column names (schema drift)
    await safeDelete(
      `DELETE FROM reviews WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      `DELETE FROM reviews WHERE "bookingId" IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete('DELETE FROM reviews WHERE consumer_id = $1', [id]);
    await safeDelete('DELETE FROM reviews WHERE "consumerId" = $1', [id]);
    await safeDelete(
      `DELETE FROM reviews WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete(
      `DELETE FROM reviews WHERE "barberId" IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete(
      `DELETE FROM disputes WHERE booking_id IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete(
      `DELETE FROM disputes WHERE "bookingId" IN (${userBookingIdsSubquery})`,
      [id]
    );
    await safeDelete('DELETE FROM disputes WHERE opened_by = $1', [id]);

    // 7. Delete bookings (production camelCase + legacy snake_case)
    await safeDelete(`DELETE FROM bookings WHERE "consumerId" = $1`, [id]);
    await safeDelete(
      `DELETE FROM bookings WHERE "barberId" IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete('DELETE FROM bookings WHERE consumer_id = $1', [id]);
    await safeDelete(
      `DELETE FROM bookings WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 8. Availability + one-off blocks (after bookings — booking holds availability FK)
    await safeDelete(
      `DELETE FROM availability WHERE "barberId" IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete(
      `DELETE FROM barber_time_blocks WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 9. Barber-owned rows (camelCase barberId)
    await safeDelete(
      `DELETE FROM portfolio_images WHERE "barberId" IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete(
      `DELETE FROM barber_services WHERE "barberId" IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );
    await safeDelete(
      `DELETE FROM barber_service_locations WHERE barber_id IN (SELECT id FROM barbers WHERE "userId" = $1)`,
      [id]
    );

    // 9b. Campus service locations this user created (Provider CM/barber proposals).
    // FK service_locations_created_by_fkey blocks DELETE FROM users if skipped.
    await safeDelete(
      `DELETE FROM barber_service_locations WHERE location_id IN (
         SELECT id FROM service_locations WHERE created_by = $1::uuid
       )`,
      [id]
    );
    await safeDelete(
      'UPDATE service_locations SET reviewed_by = NULL WHERE reviewed_by = $1::uuid',
      [id]
    );
    await safeDelete('DELETE FROM service_locations WHERE created_by = $1::uuid', [id]);

    // 10. Customer profile / reviews about customer (optional tables)
    await safeDelete('DELETE FROM customer_profiles WHERE user_id = $1', [id]);
    await safeDelete('DELETE FROM customer_reviews WHERE customer_id = $1', [id]);

    // 11. Delete barber applications
    await safeDelete('DELETE FROM barber_applications WHERE user_id = $1', [id]);

    // 12. Delete guest barber applications linked to this user
    await safeDelete('DELETE FROM guest_barber_applications WHERE linked_user_id = $1', [id]);

    // 13. Delete barber record
    await safeDelete('DELETE FROM barbers WHERE "userId" = $1', [id]);

    // 14. UGC / devices (CASCADE on users.id where migration 028 applied)
    await safeDelete(
      'DELETE FROM ugc_content_reports WHERE reporter_user_id = $1 OR reported_user_id = $1',
      [id]
    );
    await safeDelete('DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1', [id]);
    await safeDelete('DELETE FROM mobile_devices WHERE user_id = $1', [id]);

    // 15. Finally delete the user
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    logger.info(`Account deleted successfully: ${user.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    const pgDetail = typeof error?.detail === 'string' ? error.detail : undefined;
    logger.error('Error deleting account:', {
      message: error?.message,
      code: error?.code,
      detail: pgDetail,
      table: error?.table,
      constraint: error?.constraint,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      ...(pgDetail ? { detail: pgDetail } : {}),
    });
  } finally {
    client.release();
  }
};
