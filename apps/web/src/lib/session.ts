import { v4 as uuidv4 } from 'uuid';

const SESSION_STORAGE_KEY = 'masarx_session_id';

/**
 * Retrieves the current session ID or generates a new one if it doesn't exist.
 * The session ID is stored in sessionStorage, so it persists while the tab is open
 * but is cleared when the tab/browser is closed, ensuring privacy.
 */
export const getSessionId = (): string => {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return uuidv4();

    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!sessionId) {
        sessionId = uuidv4();
        try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        } catch {
            // ignore
        }
    }

    return sessionId;
};
