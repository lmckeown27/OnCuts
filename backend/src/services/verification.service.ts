/**
 * Verification Service - In-Memory Verification Code Management
 * 
 * Manages pending user registrations and email verification codes.
 * Codes expire after 10 minutes.
 * 
 * @module verification.service
 */

import { logger } from '../utils/logger';

/**
 * Pending Registration Data
 */
export interface PendingRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  campusId: string;
  role: 'student' | 'barber';
  verificationCode: string;
  expiresAt: Date;
  createdAt: Date;
}

// Legacy alias for backwards compatibility
export type { PendingRegistration as PendingRegistrationData };

/**
 * In-Memory Storage for Pending Registrations
 * Key: email (lowercase)
 * Value: PendingRegistration
 */
const pendingRegistrations = new Map<string, PendingRegistration>();

/**
 * Verification Code Expiration Time (10 minutes)
 */
const VERIFICATION_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate Random 6-Digit Verification Code
 * 
 * @returns 6-digit numeric string
 * 
 * @example
 * generateVerificationCode() // "123456"
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create Pending Registration
 * 
 * Stores user registration data with email verification code.
 * Overwrites existing pending registration for the same email.
 * 
 * @param registrationData - User registration data
 * @returns Email verification code
 * 
 * @example
 * const code = createPendingRegistration({
 *   email: 'student@university.edu',
 *   password: 'hashed_password',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   campusId: 1,
 *   role: 'student'
 * });
 */
export function createPendingRegistration(
  registrationData: Omit<PendingRegistration, 'verificationCode' | 'expiresAt' | 'createdAt'>
): string {
  const verificationCode = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS);
  
  const emailKey = registrationData.email.toLowerCase();
  
  const pendingReg: PendingRegistration = {
    ...registrationData,
    email: emailKey,
    verificationCode,
    expiresAt,
    createdAt: now
  };
  
  pendingRegistrations.set(emailKey, pendingReg);
  
  logger.info(`Created pending registration for ${emailKey}, expires at ${expiresAt.toISOString()}`);
  
  // Schedule cleanup after expiration
  setTimeout(() => {
    if (pendingRegistrations.has(emailKey)) {
      const reg = pendingRegistrations.get(emailKey);
      if (reg && reg.verificationCode === verificationCode) {
        pendingRegistrations.delete(emailKey);
        logger.info(`Expired verification code for ${emailKey}`);
      }
    }
  }, VERIFICATION_CODE_EXPIRY_MS);
  
  return verificationCode;
}

/**
 * Verify Email Code and Complete Registration
 * 
 * Validates email verification code and returns registration data if valid.
 * Removes the pending registration after success.
 * 
 * @param email - User's email address
 * @param code - 6-digit verification code
 * @returns PendingRegistration if valid, null if invalid/expired
 */
export function verifyCode(email: string, code: string): PendingRegistration | null {
  const emailKey = email.toLowerCase();
  const pendingReg = pendingRegistrations.get(emailKey);
  
  if (!pendingReg) {
    logger.warn(`No pending registration found for ${emailKey}`);
    return null;
  }
  
  // Check if expired
  if (new Date() > pendingReg.expiresAt) {
    pendingRegistrations.delete(emailKey);
    logger.warn(`Verification code expired for ${emailKey}`);
    return null;
  }
  
  // Check if code matches
  if (pendingReg.verificationCode !== code) {
    logger.warn(`Invalid verification code for ${emailKey}`);
    return null;
  }
  
  // Valid! Remove from pending
  pendingRegistrations.delete(emailKey);
  logger.info(`Email verified for ${emailKey}, registration complete`);
  
  return pendingReg;
}

/**
 * Check if Email Has Pending Registration
 * 
 * @param email - User's email address
 * @returns true if pending registration exists and not expired
 */
export function hasPendingRegistration(email: string): boolean {
  const emailKey = email.toLowerCase();
  const pendingReg = pendingRegistrations.get(emailKey);
  
  if (!pendingReg) {
    return false;
  }
  
  // Check if expired
  if (new Date() > pendingReg.expiresAt) {
    pendingRegistrations.delete(emailKey);
    return false;
  }
  
  return true;
}

/**
 * Get Pending Registration (without verification)
 * 
 * Returns pending registration data without verifying code.
 * Useful for checking status or resending code.
 * 
 * @param email - User's email address
 * @returns PendingRegistration if exists and not expired, null otherwise
 */
export function getPendingRegistration(email: string): PendingRegistration | null {
  const emailKey = email.toLowerCase();
  const pendingReg = pendingRegistrations.get(emailKey);
  
  if (!pendingReg) {
    return null;
  }
  
  // Check if expired
  if (new Date() > pendingReg.expiresAt) {
    pendingRegistrations.delete(emailKey);
    return null;
  }
  
  return pendingReg;
}

/**
 * Cancel Pending Registration
 * 
 * Removes a pending registration from storage.
 * 
 * @param email - User's email address
 * @returns true if removed, false if didn't exist
 */
export function cancelPendingRegistration(email: string): boolean {
  const emailKey = email.toLowerCase();
  const existed = pendingRegistrations.has(emailKey);
  
  if (existed) {
    pendingRegistrations.delete(emailKey);
    logger.info(`Cancelled pending registration for ${emailKey}`);
  }
  
  return existed;
}

/**
 * Get All Pending Registrations (Admin/Debug)
 * 
 * Returns all pending registrations with non-expired codes.
 * Useful for monitoring and debugging.
 * 
 * @returns Array of pending registrations
 */
export function getAllPendingRegistrations(): PendingRegistration[] {
  const now = new Date();
  const validRegistrations: PendingRegistration[] = [];
  
  pendingRegistrations.forEach((reg, email) => {
    if (now <= reg.expiresAt) {
      validRegistrations.push(reg);
    } else {
      // Clean up expired
      pendingRegistrations.delete(email);
    }
  });
  
  return validRegistrations;
}

/**
 * Clear All Pending Registrations (Testing Only)
 * 
 * Removes all pending registrations from memory.
 * Should only be used in tests.
 */
export function clearAllPendingRegistrations(): void {
  const count = pendingRegistrations.size;
  pendingRegistrations.clear();
  logger.warn(`Cleared ${count} pending registrations`);
}

/**
 * Get Pending Registrations Count
 * 
 * @returns Number of pending registrations (including expired)
 */
export function getPendingRegistrationsCount(): number {
  return pendingRegistrations.size;
}

/**
 * Cleanup Expired Registrations
 * 
 * Removes all expired pending registrations from memory.
 * Automatically runs every 5 minutes.
 */
export function cleanupExpiredRegistrations(): void {
  const now = new Date();
  let removed = 0;
  
  pendingRegistrations.forEach((reg, email) => {
    if (now > reg.expiresAt) {
      pendingRegistrations.delete(email);
      removed++;
    }
  });
  
  if (removed > 0) {
    logger.info(`Cleaned up ${removed} expired pending registrations`);
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredRegistrations, 5 * 60 * 1000);

logger.info('Verification service initialized');
