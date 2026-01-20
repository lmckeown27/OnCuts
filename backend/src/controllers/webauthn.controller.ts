/**
 * WebAuthn Controller
 * 
 * Handles biometric authentication (Touch ID, Face ID, Windows Hello)
 * using the WebAuthn standard (FIDO2).
 * 
 * Flow:
 * 1. Registration: User enables biometrics after logging in
 *    - generateRegistrationOptions -> client performs ceremony -> verifyRegistration
 * 2. Authentication: User logs in with biometrics
 *    - generateAuthenticationOptions -> client performs ceremony -> verifyAuthentication
 */

import { Response, NextFunction } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  AuthenticatorDevice,
} from '@simplewebauthn/types';
import { pool } from '../database/connection';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.utils';

// WebAuthn Relying Party configuration
const rpName = 'CampusCut';
const rpID = process.env.WEBAUTHN_RP_ID || 'campuscut.com';
const origin = process.env.FRONTEND_URL || `https://${rpID}`;

// For development, allow localhost
const expectedOrigins = process.env.NODE_ENV === 'production' 
  ? [origin]
  : [origin, 'http://localhost:5173', 'http://localhost:3000', 'https://localhost:5173'];

/**
 * Get user's registered WebAuthn credentials
 */
async function getUserCredentials(userId: string) {
  const result = await pool.query(
    `SELECT credential_id, public_key, counter, transports 
     FROM webauthn_credentials 
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows;
}

/**
 * Generate registration options for a new credential
 * POST /api/v1/auth/webauthn/register/options
 */
export const getRegistrationOptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];

    // Get existing credentials to exclude
    const existingCredentials = await getUserCredentials(userId);
    const excludeCredentials = existingCredentials.map(cred => ({
      id: cred.credential_id,
      transports: cred.transports as AuthenticatorTransportFuture[] || ['internal'],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: `${user.first_name} ${user.last_name}`.trim() || user.email,
      // Exclude existing credentials to prevent re-registration
      excludeCredentials,
      // Prefer platform authenticators (Touch ID, Face ID, Windows Hello)
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      // Timeout: 5 minutes
      timeout: 300000,
    });

    // Store challenge for verification
    await pool.query(
      `UPDATE users 
       SET webauthn_challenge = $1, webauthn_challenge_expires_at = NOW() + INTERVAL '5 minutes'
       WHERE id = $2`,
      [options.challenge, userId]
    );

    logger.info(`WebAuthn registration options generated for user: ${user.email}`);

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify registration response and store credential
 * POST /api/v1/auth/webauthn/register/verify
 */
export const verifyRegistration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const { response, friendlyName } = req.body as {
      response: RegistrationResponseJSON;
      friendlyName?: string;
    };

    if (!response) {
      throw new ApiError(400, 'Registration response is required');
    }

    // Get stored challenge
    const userResult = await pool.query(
      `SELECT id, email, webauthn_challenge, webauthn_challenge_expires_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];

    if (!user.webauthn_challenge) {
      throw new ApiError(400, 'No registration challenge found. Please start registration again.');
    }

    if (new Date(user.webauthn_challenge_expires_at) < new Date()) {
      throw new ApiError(400, 'Registration challenge expired. Please start registration again.');
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: user.webauthn_challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (error: any) {
      logger.error('WebAuthn registration verification failed:', error.message);
      throw new ApiError(400, `Registration failed: ${error.message}`);
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      throw new ApiError(400, 'Registration verification failed');
    }

    // Store the credential (v10 API uses flat structure)
    const { 
      credentialID, 
      credentialPublicKey, 
      counter, 
      credentialDeviceType, 
      credentialBackedUp 
    } = registrationInfo;

    // credentialID is already base64url in v10
    // credentialPublicKey is Uint8Array, convert to base64url
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url');

    await pool.query(
      `INSERT INTO webauthn_credentials 
       (user_id, credential_id, public_key, counter, device_type, backed_up, transports, friendly_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        credentialID,  // Already base64url string in v10
        publicKeyBase64,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        ['internal'],  // transports not available on registrationInfo in v10
        friendlyName || 'Biometric Login',
      ]
    );

    // Clear the challenge
    await pool.query(
      'UPDATE users SET webauthn_challenge = NULL, webauthn_challenge_expires_at = NULL WHERE id = $1',
      [userId]
    );

    logger.info(`WebAuthn credential registered for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Biometric login enabled successfully!',
      data: {
        credentialId: credentialID,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate authentication options for login
 * POST /api/v1/auth/webauthn/login/options
 */
export const getAuthenticationOptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'No account found with this email');
    }

    const user = userResult.rows[0];

    // Get user's credentials
    const credentials = await getUserCredentials(user.id);

    if (credentials.length === 0) {
      throw new ApiError(400, 'No biometric credentials registered for this account');
    }

    const allowCredentials = credentials.map(cred => ({
      id: cred.credential_id,
      transports: cred.transports as AuthenticatorTransportFuture[] || ['internal'],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required',
      timeout: 300000,
    });

    // Store challenge for verification
    await pool.query(
      `UPDATE users 
       SET webauthn_challenge = $1, webauthn_challenge_expires_at = NOW() + INTERVAL '5 minutes'
       WHERE id = $2`,
      [options.challenge, user.id]
    );

    logger.info(`WebAuthn authentication options generated for user: ${user.email}`);

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify authentication response and log user in
 * POST /api/v1/auth/webauthn/login/verify
 */
export const verifyAuthentication = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, response } = req.body as {
      email: string;
      response: AuthenticationResponseJSON;
    };

    if (!email || !response) {
      throw new ApiError(400, 'Email and authentication response are required');
    }

    // Find user
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, role, "campusId", "isBlocked", "isBanned",
              webauthn_challenge, webauthn_challenge_expires_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];

    if (user.isBlocked || user.isBanned) {
      throw new ApiError(403, 'Account is deactivated');
    }

    if (!user.webauthn_challenge) {
      throw new ApiError(400, 'No authentication challenge found. Please start login again.');
    }

    if (new Date(user.webauthn_challenge_expires_at) < new Date()) {
      throw new ApiError(400, 'Authentication challenge expired. Please start login again.');
    }

    // Find the credential being used
    const credentialResult = await pool.query(
      'SELECT id, credential_id, public_key, counter, transports FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2',
      [response.id, user.id]
    );

    if (credentialResult.rows.length === 0) {
      throw new ApiError(400, 'Credential not found');
    }

    const credential = credentialResult.rows[0];

    // Convert stored base64 back to Uint8Array for the authenticator device
    const publicKeyBytes = new Uint8Array(Buffer.from(credential.public_key, 'base64url'));

    // Build the authenticator device object for v10 API
    const authenticator: AuthenticatorDevice = {
      credentialID: credential.credential_id,
      credentialPublicKey: publicKeyBytes,
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[],
    };

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: user.webauthn_challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
        requireUserVerification: true,
        authenticator,  // v10 uses 'authenticator' instead of 'credential'
      });
    } catch (error: any) {
      logger.error('WebAuthn authentication verification failed:', error.message);
      throw new ApiError(400, `Authentication failed: ${error.message}`);
    }

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      throw new ApiError(400, 'Authentication verification failed');
    }

    // Update counter to prevent replay attacks
    await pool.query(
      'UPDATE webauthn_credentials SET counter = $1, last_used_at = NOW() WHERE id = $2',
      [authenticationInfo.newCounter, credential.id]
    );

    // Clear the challenge
    await pool.query(
      'UPDATE users SET webauthn_challenge = NULL, webauthn_challenge_expires_at = NULL, "lastActiveAt" = NOW() WHERE id = $1',
      [user.id]
    );

    // Check if user has an active barber profile
    const barberCheck = await pool.query(
      'SELECT id FROM barbers WHERE "userId" = $1 AND "isActive" = true',
      [user.id]
    );
    const hasBarberProfile = barberCheck.rows.length > 0;

    // Generate JWT tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campusId,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campusId,
    });

    logger.info(`WebAuthn authentication successful for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          campusId: user.campusId,
          hasBarberProfile,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has WebAuthn credentials registered
 * GET /api/v1/auth/webauthn/status
 */
export const getCredentialStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const result = await pool.query(
      `SELECT id, friendly_name, device_type, backed_up, created_at, last_used_at
       FROM webauthn_credentials 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        enabled: result.rows.length > 0,
        credentials: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if an email has WebAuthn credentials (for login page)
 * POST /api/v1/auth/webauthn/check
 */
export const checkCredentialsForEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM webauthn_credentials wc
       JOIN users u ON wc.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    const hasCredentials = parseInt(result.rows[0].count) > 0;

    res.json({
      success: true,
      data: {
        hasBiometricLogin: hasCredentials,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a WebAuthn credential
 * DELETE /api/v1/auth/webauthn/credentials/:credentialId
 */
export const deleteCredential = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { credentialId } = req.params;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const result = await pool.query(
      'DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2 RETURNING id',
      [credentialId, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Credential not found');
    }

    logger.info(`WebAuthn credential deleted for user: ${userId}`);

    res.json({
      success: true,
      message: 'Biometric login removed',
    });
  } catch (error) {
    next(error);
  }
};

