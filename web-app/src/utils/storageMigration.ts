/** Migrate browser storage keys from legacy brand prefixes to oncuts_* without losing user prefs. */

export function migrateLocalStorageKey(newKey: string, legacyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(newKey) != null) return;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue != null) {
      localStorage.setItem(newKey, legacyValue);
      localStorage.removeItem(legacyKey);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function migrateLocalStorageKeys(newKey: string, legacyKeys: readonly string[]): void {
  for (const legacyKey of legacyKeys) {
    migrateLocalStorageKey(newKey, legacyKey);
  }
}

export function migrateSessionStorageKey(newKey: string, legacyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(newKey) != null) return;
    const legacyValue = sessionStorage.getItem(legacyKey);
    if (legacyValue != null) {
      sessionStorage.setItem(newKey, legacyValue);
      sessionStorage.removeItem(legacyKey);
    }
  } catch {
    // ignore
  }
}

export function readLocalStorageWithMigration(
  newKey: string,
  legacyKeys: readonly string[],
): string | null {
  migrateLocalStorageKeys(newKey, legacyKeys);
  return localStorage.getItem(newKey);
}

export function readSessionStorageWithMigration(
  newKey: string,
  legacyKeys: readonly string[],
): string | null {
  for (const legacyKey of legacyKeys) {
    migrateSessionStorageKey(newKey, legacyKey);
  }
  return sessionStorage.getItem(newKey);
}

export function removeLocalStorageKeys(...keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function removeSessionStorageKeys(...keys: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of keys) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export const PENDING_SIGNUP_PHONE_KEY = 'oncuts_pending_signup_phone';
export const LEGACY_PENDING_SIGNUP_PHONE_KEY = 'avilaplatforms_pending_signup_phone';
