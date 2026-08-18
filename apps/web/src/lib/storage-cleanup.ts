/**
 * T034: localStorage Cleanup Utility
 * Cleans up old localStorage keys that have been migrated to sessionStorage
 * Run this on app initialization to clear PII from persistent storage
 */

const OLD_LOCALSTORAGE_KEYS = [
  'quiz_attempt_',      // Prefix - quiz attempts now in sessionStorage
  'quiz_history',       // Quiz history now in sessionStorage
  'USER_ACADEMIC_CACHE_KEY', // Academic cache now in sessionStorage without PII
  'login_attempts',     // Login attempts now in sessionStorage
  'signup_attempts',    // Signup attempts now in sessionStorage
];

/**
 * Removes old localStorage keys that have been migrated to sessionStorage
 * This prevents PII from persisting in localStorage after the security update
 */
export function cleanupOldLocalStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    // Remove specific keys
    OLD_LOCALSTORAGE_KEYS.forEach((key) => {
      if (key.endsWith('_')) {
        // For prefix keys, find and remove all matching
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const itemKey = localStorage.key(i);
          if (itemKey && itemKey.startsWith(key)) {
            localStorage.removeItem(itemKey);
          }
        }
      } else {
        // For exact keys
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // Silently fail if localStorage is not available
    console.warn('Failed to cleanup old localStorage keys:', e);
  }
}

/**
 * Checks if there are any old localStorage keys present
 * Useful for debugging/monitoring the migration
 */
export function hasOldLocalStorageKeys(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    for (const key of OLD_LOCALSTORAGE_KEYS) {
      if (key.endsWith('_')) {
        for (let i = 0; i < localStorage.length; i++) {
          const itemKey = localStorage.key(i);
          if (itemKey && itemKey.startsWith(key)) {
            return true;
          }
        }
      } else {
        if (localStorage.getItem(key)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}
