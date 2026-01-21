/**
 * WebAuthn Service
 * 
 * Handles biometric authentication (Touch ID, Face ID, Windows Hello)
 * using the WebAuthn browser API.
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import apiClient from './api.service';

// Types
interface WebAuthnCredential {
  id: string;
  friendly_name: string;
  device_type: string;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface WebAuthnStatusResponse {
  enabled: boolean;
  credentials: WebAuthnCredential[];
}

interface WebAuthnLoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    campusId: string | null;
    hasBarberProfile: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Check if the browser supports WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return browserSupportsWebAuthn();
}

/**
 * Check if a platform authenticator (Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/**
 * Check if biometric login is available on this device
 * Returns true if both WebAuthn is supported AND a platform authenticator exists
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }
  return await isPlatformAuthenticatorAvailable();
}

/**
 * Get the current user's WebAuthn credential status
 */
export async function getCredentialStatus(): Promise<WebAuthnStatusResponse> {
  const response = await apiClient.get('/auth/webauthn/status');
  return response.data.data;
}

/**
 * Check if an email has WebAuthn credentials registered
 */
export async function checkEmailHasBiometrics(email: string): Promise<boolean> {
  try {
    const response = await apiClient.post('/auth/webauthn/check', { email });
    return response.data.data.hasBiometricLogin;
  } catch {
    return false;
  }
}

/**
 * Register a new biometric credential
 * User must be logged in first
 */
export async function registerBiometric(friendlyName?: string): Promise<{
  success: boolean;
  message: string;
  credentialId?: string;
}> {
  // Step 1: Get registration options from server
  const optionsResponse = await apiClient.post('/auth/webauthn/register/options');
  const options = optionsResponse.data.data;

  // Step 2: Create credential using browser API (triggers biometric prompt)
  // v10 API: pass options directly
  const credential = await startRegistration(options);

  // Step 3: Verify and store credential on server
  const verifyResponse = await apiClient.post('/auth/webauthn/register/verify', {
    response: credential,
    friendlyName: friendlyName || getBiometricType(),
  });

  return {
    success: true,
    message: verifyResponse.data.message,
    credentialId: verifyResponse.data.data.credentialId,
  };
}

/**
 * Login using biometric authentication
 * Returns user data and tokens on success
 */
export async function loginWithBiometric(email: string): Promise<WebAuthnLoginResponse> {
  // Step 1: Get authentication options from server
  const optionsResponse = await apiClient.post('/auth/webauthn/login/options', { email });
  const options = optionsResponse.data.data;

  // Step 2: Authenticate using browser API (triggers biometric prompt)
  // v10 API: pass options directly
  const credential = await startAuthentication(options);

  // Step 3: Verify authentication on server
  const verifyResponse = await apiClient.post('/auth/webauthn/login/verify', {
    email,
    response: credential,
  });

  return verifyResponse.data.data;
}

/**
 * Delete a biometric credential
 */
export async function deleteBiometricCredential(credentialId: string): Promise<void> {
  await apiClient.delete(`/auth/webauthn/credentials/${credentialId}`);
}

/**
 * Get a friendly name for the current device's biometric type
 */
export function getBiometricType(): string {
  const ua = navigator.userAgent.toLowerCase();
  
  // iOS devices
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'Face ID / Touch ID';
  }
  
  // macOS
  if (/macintosh|mac os x/.test(ua)) {
    return 'Touch ID';
  }
  
  // Windows
  if (/windows/.test(ua)) {
    return 'Windows Hello';
  }
  
  // Android
  if (/android/.test(ua)) {
    return 'Fingerprint / Face Unlock';
  }
  
  return 'Biometric Login';
}

/**
 * Get an icon name for the current device's biometric type
 */
export function getBiometricIcon(): 'fingerprint' | 'face' | 'shield' {
  const ua = navigator.userAgent.toLowerCase();
  
  // iOS with Face ID (iPhone X and later)
  if (/iphone|ipad/.test(ua)) {
    return 'face';
  }
  
  // macOS with Touch ID
  if (/macintosh|mac os x/.test(ua)) {
    return 'fingerprint';
  }
  
  // Windows Hello can be face or fingerprint, use generic
  if (/windows/.test(ua)) {
    return 'shield';
  }
  
  // Android typically uses fingerprint
  if (/android/.test(ua)) {
    return 'fingerprint';
  }
  
  return 'fingerprint';
}

/**
 * Get a user-friendly label for the biometric button
 */
export function getBiometricButtonLabel(): string {
  const type = getBiometricType();
  return `Sign in with ${type}`;
}

// ============================================================================
// Local Storage Helpers for Remember Me functionality
// ============================================================================

const LAST_EMAIL_KEY = 'campuscut_last_email';
const BIOMETRIC_PROMPTED_KEY = 'campuscut_biometric_prompted';

/**
 * Save the last logged-in email for auto-fill on return
 */
export function saveLastEmail(email: string): void {
  localStorage.setItem(LAST_EMAIL_KEY, email);
}

/**
 * Get the last logged-in email
 */
export function getLastEmail(): string | null {
  return localStorage.getItem(LAST_EMAIL_KEY);
}

/**
 * Clear the last email (for logout or "use different account")
 */
export function clearLastEmail(): void {
  localStorage.removeItem(LAST_EMAIL_KEY);
}

/**
 * Check if we've already prompted this user to enable biometrics
 * (to avoid nagging them every login)
 */
export function hasBiometricBeenPrompted(email: string): boolean {
  const prompted = localStorage.getItem(BIOMETRIC_PROMPTED_KEY);
  if (!prompted) return false;
  try {
    const emails = JSON.parse(prompted) as string[];
    return emails.includes(email.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Mark that we've prompted this user about biometrics
 */
export function markBiometricPrompted(email: string): void {
  const prompted = localStorage.getItem(BIOMETRIC_PROMPTED_KEY);
  let emails: string[] = [];
  try {
    emails = prompted ? JSON.parse(prompted) : [];
  } catch {
    emails = [];
  }
  if (!emails.includes(email.toLowerCase())) {
    emails.push(email.toLowerCase());
    localStorage.setItem(BIOMETRIC_PROMPTED_KEY, JSON.stringify(emails));
  }
}

/**
 * Clear the biometric prompted flag for an email (if they want to be asked again)
 */
export function clearBiometricPrompted(email: string): void {
  const prompted = localStorage.getItem(BIOMETRIC_PROMPTED_KEY);
  if (!prompted) return;
  try {
    let emails = JSON.parse(prompted) as string[];
    emails = emails.filter(e => e !== email.toLowerCase());
    localStorage.setItem(BIOMETRIC_PROMPTED_KEY, JSON.stringify(emails));
  } catch {
    // ignore
  }
}

// Default export for convenience
const webauthnService = {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  isBiometricAvailable,
  getCredentialStatus,
  checkEmailHasBiometrics,
  registerBiometric,
  loginWithBiometric,
  deleteBiometricCredential,
  getBiometricType,
  getBiometricIcon,
  getBiometricButtonLabel,
  // Remember me helpers
  saveLastEmail,
  getLastEmail,
  clearLastEmail,
  hasBiometricBeenPrompted,
  markBiometricPrompted,
  clearBiometricPrompted,
};

export default webauthnService;
