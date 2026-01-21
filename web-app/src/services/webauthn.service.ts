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
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
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
  const options: PublicKeyCredentialCreationOptionsJSON = optionsResponse.data.data;

  // Step 2: Create credential using browser API (triggers biometric prompt)
  const credential = await startRegistration({ optionsJSON: options });

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
  const options: PublicKeyCredentialRequestOptionsJSON = optionsResponse.data.data;

  // Step 2: Authenticate using browser API (triggers biometric prompt)
  const credential = await startAuthentication({ optionsJSON: options });

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
    // Face ID was introduced with iPhone X (2017)
    // Check for notch-era devices by screen size or just use generic name
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
};

export default webauthnService;

