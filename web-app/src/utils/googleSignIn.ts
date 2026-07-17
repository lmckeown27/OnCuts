/**
 * Google Identity Services (GIS) — obtain a Google ID token for POST /auth/google.
 * Does not use Firebase Auth.
 */

import { GOOGLE_OAUTH_CLIENT_ID } from '../config/constants';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ID = 'google-gsi-client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (
            momentListener?: (notification: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              isDismissedMoment: () => boolean;
              getDismissedReason?: () => string;
              getNotDisplayedReason?: () => string;
            }) => void
          ) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              width?: number;
              shape?: string;
            }
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

export function isGoogleSignInConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID);
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), {
        once: true,
      });
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Google Sign-In'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

function removeFallbackUi(): void {
  document.getElementById('oncuts-google-signin-fallback')?.remove();
}

function showRenderButtonFallback(
  clientId: string,
  onCredential: (credential: string) => void,
  onCancel: () => void
): void {
  removeFallbackUi();

  const overlay = document.createElement('div');
  overlay.id = 'oncuts-google-signin-fallback';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Continue with Google');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);padding:16px;';

  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,0.2);text-align:center;';

  const title = document.createElement('p');
  title.textContent = 'Continue with Google';
  title.style.cssText = 'margin:0 0 16px;font-size:16px;font-weight:600;color:#111;';

  const buttonHost = document.createElement('div');
  buttonHost.style.cssText = 'display:flex;justify-content:center;min-height:44px;';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.style.cssText =
    'margin-top:16px;background:transparent;border:none;color:#6b7280;font-size:14px;cursor:pointer;';
  cancel.onclick = () => {
    removeFallbackUi();
    onCancel();
  };

  card.appendChild(title);
  card.appendChild(buttonHost);
  card.appendChild(cancel);
  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      removeFallbackUi();
      onCancel();
    }
  });
  document.body.appendChild(overlay);

  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      removeFallbackUi();
      if (response.credential) onCredential(response.credential);
      else onCancel();
    },
    cancel_on_tap_outside: true,
  });

  window.google!.accounts.id.renderButton(buttonHost, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    width: 312,
    shape: 'rectangular',
  });
}

/**
 * Opens Google sign-in and resolves with a Google ID token (JWT).
 * Tries One Tap / FedCM prompt first; if suppressed, shows a GIS Continue button overlay.
 */
export async function requestGoogleIdToken(): Promise<string> {
  const clientId = GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured');
  }

  await loadGisScript();
  if (!window.google?.accounts?.id) {
    throw new Error('Google Sign-In failed to initialize');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err?: Error, token?: string) => {
      if (settled) return;
      settled = true;
      try {
        window.google?.accounts.id.cancel();
      } catch {
        /* ignore */
      }
      removeFallbackUi();
      if (err) reject(err);
      else resolve(token!);
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) settle(undefined, response.credential);
        else settle(new Error('Google did not return an ID token'));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });

    window.google!.accounts.id.prompt((notification) => {
      if (settled) return;

      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        showRenderButtonFallback(
          clientId,
          (credential) => settle(undefined, credential),
          () => settle(new Error('Google sign-in was cancelled'))
        );
        return;
      }

      if (notification.isDismissedMoment()) {
        const reason = notification.getDismissedReason?.() ?? '';
        if (reason === 'credential_returned') return;
        settle(new Error('Google sign-in was cancelled'));
      }
    });
  });
}
