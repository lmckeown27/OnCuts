/**
 * Campus Manager Service
 * 
 * Handles Campus Manager role management and permissions
 * Enforces rule: Only ONE Campus Manager per campus
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

export class CampusManagerService {
  /**
   * Check if a barber is a Campus Manager
   */
  async isCampusManager(barberId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT is_campus_manager FROM barbers WHERE id = $1',
        [barberId]
      );
      
      return result.rows[0]?.is_campus_manager || false;
    } catch (error) {
      logger.error('Error checking Campus Manager status:', error);
      throw error;
    }
  }

  /**
   * Get Campus Manager for a specific campus
   */
  async getCampusManager(campusId: string): Promise<{
    barberId: string;
    userId: string;
    displayName: string;
    since: Date;
  } | null> {
    try {
      const result = await pool.query(`
        SELECT 
          b.id as barber_id,
          b.user_id,
          u.display_name,
          b.campus_manager_since
        FROM barbers b
        INNER JOIN users u ON b.user_id = u.id
        WHERE 
          b.campus_id = $1 
          AND b.is_campus_manager = true
      `, [campusId]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        barberId: result.rows[0].barber_id,
        userId: result.rows[0].user_id,
        displayName: result.rows[0].display_name,
        since: result.rows[0].campus_manager_since,
      };
    } catch (error) {
      logger.error('Error fetching Campus Manager:', error);
      throw error;
    }
  }

  /**
   * Promote a barber to Campus Manager
   * Uses PostgreSQL function to enforce uniqueness constraint
   */
  async promoteToCampusManager(
    barberId: string,
    campusId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify barber belongs to this campus and is active
      const barberCheck = await pool.query(`
        SELECT id, campus_id, is_active, is_onboarded
        FROM barbers
        WHERE id = $1 AND campus_id = $2
      `, [barberId, campusId]);

      if (barberCheck.rows.length === 0) {
        return {
          success: false,
          error: 'Barber not found or does not belong to this campus',
        };
      }

      const barber = barberCheck.rows[0];
      if (!barber.is_active || !barber.is_onboarded) {
        return {
          success: false,
          error: 'Barber must be active and onboarded to become Campus Manager',
        };
      }

      // Use PostgreSQL function to safely promote
      const result = await pool.query(
        'SELECT promote_to_campus_manager($1, $2) as success',
        [barberId, campusId]
      );

      logger.info('Barber promoted to Campus Manager', {
        barberId,
        campusId,
      });

      return { success: result.rows[0].success };
    } catch (error: any) {
      logger.error('Error promoting to Campus Manager:', error);
      
      // Handle unique constraint violation
      if (error.message?.includes('already has a Campus Manager')) {
        return {
          success: false,
          error: 'This campus already has a Campus Manager',
        };
      }

      throw error;
    }
  }

  /**
   * Revoke Campus Manager role
   */
  async revokeCampusManager(barberId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT revoke_campus_manager($1) as success',
        [barberId]
      );

      logger.info('Campus Manager role revoked', { barberId });
      return result.rows[0].success;
    } catch (error) {
      logger.error('Error revoking Campus Manager:', error);
      throw error;
    }
  }

  /**
   * Get Campus Manager permissions/scopes
   */
  getCampusManagerPermissions(): string[] {
    return [
      'manage_barber_applications',
      'view_campus_metrics',
      'upload_campus_content',
      'flag_incidents',
      'escalate_to_admin',
    ];
  }

  /**
   * Verify Campus Manager has permission for an action on a specific campus
   */
  async verifyPermission(
    barberId: string,
    campusId: string,
    action: string
  ): Promise<boolean> {
    try {
      // Check if barber is Campus Manager for this campus
      const result = await pool.query(`
        SELECT id
        FROM barbers
        WHERE 
          id = $1 
          AND campus_id = $2 
          AND is_campus_manager = true
          AND is_active = true
      `, [barberId, campusId]);

      if (result.rows.length === 0) {
        logger.warn('Permission denied: Not Campus Manager', {
          barberId,
          campusId,
          action,
        });
        return false;
      }

      // Verify action is in allowed permissions
      const allowedPermissions = this.getCampusManagerPermissions();
      return allowedPermissions.includes(action);
    } catch (error) {
      logger.error('Error verifying Campus Manager permission:', error);
      return false;
    }
  }
}

export const campusManagerService = new CampusManagerService();

