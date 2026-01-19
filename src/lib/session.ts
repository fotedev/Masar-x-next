import { v4 as uuidv4 } from 'uuid';

const SESSION_STORAGE_KEY = 'masarx_session_id';

/**
 * Retrieves the current session ID or generates a new one if it doesn't exist.
 * The session ID is stored in sessionStorage, so it persists while the tab is open
 * but is cleared when the tab/browser is closed, ensuring privacy.
 */
export const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!sessionId) {
        sessionId = uuidv4();
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    return sessionId;
};

/**
 * Resets the session ID. Useful if you want to force a new session.
 */
export const resetSessionId = (): string => {
    const newSessionId = uuidv4();
    sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    return newSessionId;
};
