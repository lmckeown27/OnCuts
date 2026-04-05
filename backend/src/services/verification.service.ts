/**
 * Verification Service - Database-backed Verification Code Management
 * 
 * Manages pending user registrations and email verification codes.
 * Uses PostgreSQL for persistence (survives server restarts).
 * Verification codes do not time-expire (until the row is consumed or replaced).
 * 
 * @module verification.service
 */

import { logger } from '../utils/logger';
import { pool } from '../database/connection';

/**
 * Pending Registration Data
 */
export interface PendingRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  campusId: string | null;
  role: 'student' | 'barber';
  verificationCode: string;
  expiresAt: Date;
  createdAt: Date;
}

// Legacy alias for backwards compatibility
export type { PendingRegistration as PendingRegistrationData };

/** Stored on `expires_at` for NOT NULL column; enforcement is disabled in application logic. */
const PENDING_REGISTRATION_PLACEHOLDER_EXPIRY = new Date('9999-12-31T23:59:59.999Z');

/**
 * Generate Random 6-Digit Verification Code
 * 
 * @returns 6-digit numeric string
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Initialize pending_registrations table if it doesn't exist
 */
async function ensureTableExists(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        email VARCHAR(255) PRIMARY KEY,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        campus_id UUID,
        role VARCHAR(50) NOT NULL,
        verification_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    logger.error('Failed to create pending_registrations table:', error);
  }
}

/**
 * Run after PostgreSQL is connected (see index.ts). Avoids module-load races with the DB pool.
 */
export async function initVerificationSchema(): Promise<void> {
  await ensureTableExists();
  try {
    await pool.query(
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`
    );
    await pool.query(
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS code_verified_at TIMESTAMPTZ`
    );
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMPTZ`);
  } catch (error) {
    logger.error('Failed to extend verification / users schema for terms acceptance:', error);
  }
}

/**
 * Create Pending Registration
 * 
 * Stores user registration data with email verification code.
 * Overwrites existing pending registration for the same email.
 * 
 * @param registrationData - User registration data
 * @returns Email verification code
 */
export async function createPendingRegistration(
  registrationData: Omit<PendingRegistration, 'verificationCode' | 'expiresAt' | 'createdAt'>
): Promise<string> {
  const verificationCode = generateVerificationCode();
  const now = new Date();
  const expiresAt = PENDING_REGISTRATION_PLACEHOLDER_EXPIRY;
  
  const emailKey = registrationData.email.toLowerCase();
  
  try {
    // Upsert - insert or update if exists; new code invalidates prior "code verified" gate
    await pool.query(`
      INSERT INTO pending_registrations (email, password_hash, first_name, last_name, campus_id, role, verification_code, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        campus_id = EXCLUDED.campus_id,
        role = EXCLUDED.role,
        verification_code = EXCLUDED.verification_code,
        expires_at = EXCLUDED.expires_at,
        created_at = EXCLUDED.created_at,
        code_verified_at = NULL
    `, [
      emailKey,
      registrationData.password,
      registrationData.firstName,
      registrationData.lastName,
      registrationData.campusId,
      registrationData.role,
      verificationCode,
      expiresAt,
      now,
    ]);
    
    logger.info(`Created pending registration for ${emailKey} (verification code does not expire)`);
  } catch (error) {
    logger.error(`Failed to create pending registration for ${emailKey}:`, error);
    throw error;
  }
  
  return verificationCode;
}

/**
 * Confirm verification code only (does not create a user).
 * Marks the pending row so the client can complete registration (verify-email) afterward.
 */
export async function confirmVerificationCode(email: string, code: string): Promise<boolean> {
  const emailKey = email.toLowerCase();

  try {
    const result = await pool.query(
      `
      SELECT verification_code
      FROM pending_registrations
      WHERE email = $1
    `,
      [emailKey]
    );

    if (result.rows.length === 0) {
      logger.warn(`No pending registration found for ${emailKey}`);
      return false;
    }

    const row = result.rows[0];

    if (row.verification_code !== code) {
      logger.warn(`Invalid verification code for ${emailKey}`);
      return false;
    }

    await pool.query(
      `UPDATE pending_registrations SET code_verified_at = NOW() WHERE email = $1`,
      [emailKey]
    );
    logger.info(`Verification code confirmed for ${emailKey} (pending verify-email before account creation)`);
    return true;
  } catch (error) {
    logger.error(`Error confirming verification code for ${emailKey}:`, error);
    return false;
  }
}

/**
 * Single-step: if the code matches the pending row, delete it and return data for user insert.
 * Use when the client sends email + code together (e.g. mobile) without a prior confirm-verification-code call.
 */
export async function takePendingRegistrationIfCodeValid(
  email: string,
  code: string
): Promise<PendingRegistration | null> {
  const emailKey = email.toLowerCase();
  const codeNorm = String(code).trim();

  try {
    const result = await pool.query(
      `
      DELETE FROM pending_registrations
      WHERE email = $1 AND verification_code = $2
      RETURNING email, password_hash, first_name, last_name, campus_id, role, verification_code, expires_at, created_at
    `,
      [emailKey, codeNorm]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      email: row.email,
      password: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      campusId: row.campus_id,
      role: row.role,
      verificationCode: row.verification_code,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    logger.error(`Error taking pending registration with code for ${emailKey}:`, error);
    return null;
  }
}

/**
 * Atomically remove pending row and return data for user insert.
 * Requires a prior successful confirmVerificationCode for this email.
 */
export async function takeCodeVerifiedPendingRegistration(
  email: string
): Promise<PendingRegistration | null> {
  const emailKey = email.toLowerCase();

  try {
    const result = await pool.query(
      `
      DELETE FROM pending_registrations
      WHERE email = $1
        AND code_verified_at IS NOT NULL
      RETURNING email, password_hash, first_name, last_name, campus_id, role, verification_code, expires_at, created_at
    `,
      [emailKey]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      email: row.email,
      password: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      campusId: row.campus_id,
      role: row.role,
      verificationCode: row.verification_code,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    logger.error(`Error taking code-verified pending registration for ${emailKey}:`, error);
    return null;
  }
}

/**
 * Check if Email Has Pending Registration
 * 
 * @param email - User's email address
 * @returns true if pending registration exists
 */
export async function hasPendingRegistration(email: string): Promise<boolean> {
  const emailKey = email.toLowerCase();
  
  try {
    const result = await pool.query(`
      SELECT 1 FROM pending_registrations
      WHERE email = $1
    `, [emailKey]);
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Error checking pending registration for ${emailKey}:`, error);
    return false;
  }
}

/**
 * Get Pending Registration (without verification)
 * 
 * Returns pending registration data without verifying code.
 * Useful for checking status or resending code.
 * 
 * @param email - User's email address
 * @returns PendingRegistration if exists, null otherwise
 */
export async function getPendingRegistration(email: string): Promise<PendingRegistration | null> {
  const emailKey = email.toLowerCase();
  
  try {
    const result = await pool.query(`
      SELECT email, password_hash, first_name, last_name, campus_id, role, verification_code, expires_at, created_at
      FROM pending_registrations
      WHERE email = $1
    `, [emailKey]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      email: row.email,
      password: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      campusId: row.campus_id,
      role: row.role,
      verificationCode: row.verification_code,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    logger.error(`Error getting pending registration for ${emailKey}:`, error);
    return null;
  }
}

/**
 * Cancel Pending Registration
 * 
 * Removes a pending registration from storage.
 * 
 * @param email - User's email address
 * @returns true if removed, false if didn't exist
 */
export async function cancelPendingRegistration(email: string): Promise<boolean> {
  const emailKey = email.toLowerCase();
  
  try {
    const result = await pool.query(
      'DELETE FROM pending_registrations WHERE email = $1',
      [emailKey]
    );
    
    const existed = (result.rowCount ?? 0) > 0;
    if (existed) {
      logger.info(`Cancelled pending registration for ${emailKey}`);
    }
    
    return existed;
  } catch (error) {
    logger.error(`Error cancelling pending registration for ${emailKey}:`, error);
    return false;
  }
}

/**
 * Cleanup legacy expired rows (before codes were made non-expiring).
 * Current registrations use a far-future `expires_at` and are not removed here.
 */
export async function cleanupExpiredRegistrations(): Promise<void> {
  try {
    const result = await pool.query(
      `DELETE FROM pending_registrations
       WHERE expires_at < NOW()
         AND expires_at < TIMESTAMPTZ '2100-01-01'`
    );
    
    const removed = result.rowCount ?? 0;
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} expired pending registrations`);
    }
  } catch (error) {
    logger.error('Error cleaning up expired registrations:', error);
  }
}

// Auto-cleanup every hour
setInterval(cleanupExpiredRegistrations, 60 * 60 * 1000);

logger.info('Verification service initialized (database-backed)');
