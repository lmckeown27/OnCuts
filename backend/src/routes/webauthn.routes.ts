/**
 * WebAuthn Routes
 * 
 * Biometric authentication endpoints (Touch ID, Face ID, Windows Hello)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  getCredentialStatus,
  checkCredentialsForEmail,
  deleteCredential,
} from '../controllers/webauthn.controller';

const router = Router();

// ============================================================================
// Registration (requires authentication - user must be logged in first)
// ============================================================================

// Step 1: Get registration options (generates challenge)
router.post('/register/options', authenticate, getRegistrationOptions);

// Step 2: Verify registration response and store credential
router.post('/register/verify', authenticate, verifyRegistration);

// ============================================================================
// Authentication (public - used for login)
// ============================================================================

// Step 1: Get authentication options (generates challenge)
router.post('/login/options', getAuthenticationOptions);

// Step 2: Verify authentication response and return JWT
router.post('/login/verify', verifyAuthentication);

// ============================================================================
// Utility endpoints
// ============================================================================

// Check if current user has WebAuthn credentials (requires auth)
router.get('/status', authenticate, getCredentialStatus);

// Check if an email has WebAuthn credentials (public - for login page)
router.post('/check', checkCredentialsForEmail);

// Delete a credential (requires auth)
router.delete('/credentials/:credentialId', authenticate, deleteCredential);

export default router;

