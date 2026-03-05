"use client";

/**
 * Puter.js initialization and helper functions
 */

import Puter from '@heyputer/puter.js';

type PuterClient = {
  auth: {
    isSignedIn: () => boolean;
    signIn: (options?: unknown) => Promise<unknown>;
    signOut: () => void;
    user: () => unknown;
  };
  ai: {
    chat: (...args: unknown[]) => unknown;
  };
};

export type PuterSignInResult =
  | { ok: true; signedIn: true }
  | {
      ok: false;
      signedIn: false;
      reason?: "cancelled" | "popup_blocked" | "not_signed_in" | "unknown";
      error?: unknown;
    };

let puter: PuterClient = Puter as unknown as PuterClient;

const PUTER_SIGNED_IN_KEY = "puter_signed_in";

// Ensure puter object exists even if load failed or on server
if (!puter) {
  puter = {
    auth: {
      isSignedIn: () => false,
      signIn: async () => null,
      signOut: () => { },
      user: () => null,
    },
    ai: {
      chat: async () => "AI capabilities are only available in the browser.",
    },
    // Add other mocks as needed
  };
}

// Initialize Puter.js status
let isPuterReady = false;

if (typeof window !== 'undefined') {
  // Check if we are in the browser
  isPuterReady = true;
}

export const getPuterStatus = () => {
  if (typeof window === 'undefined') {
    return { isReady: false, isSignedIn: false };
  }
  const explicitSignedIn = localStorage.getItem(PUTER_SIGNED_IN_KEY) === "1";

  // If localStorage says signed in but Puter SDK says no (token expired),
  // still treat as signed in — the actual AI call will re-trigger auth if needed.
  // This prevents the limit message from flashing for Puter users with expired tokens.
  return {
    isReady: isPuterReady,
    isSignedIn: explicitSignedIn,
  };
};

export const isProbablyMobileDevice = () => {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
  } catch {
    // ignore
  }
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

export const signInToPuter = async (options?: {
  attemptTempUserCreation?: boolean;
}): Promise<PuterSignInResult> => {
  if (typeof window === 'undefined') return { ok: false, signedIn: false, reason: "unknown" };
  try {
    const signInOptions = options?.attemptTempUserCreation
      ? ({ attempt_temp_user_creation: true } as const)
      : undefined;

    await puter.auth?.signIn?.(signInOptions);

    const isSignedInNow = Boolean(puter.auth?.isSignedIn?.());
    if (!isSignedInNow) {
      try {
        localStorage.removeItem(PUTER_SIGNED_IN_KEY);
      } catch {
        // ignore
      }
      return { ok: false, signedIn: false, reason: "not_signed_in" };
    }

    try {
      localStorage.setItem(PUTER_SIGNED_IN_KEY, "1");
    } catch {
      // ignore
    }
    return { ok: true, signedIn: true };
  } catch (error) {
    void error;
    try {
      localStorage.removeItem(PUTER_SIGNED_IN_KEY);
    } catch {
      // ignore
    }
    return { ok: false, signedIn: false, reason: "unknown", error };
  }
};

export const signOutFromPuter = () => {
  if (typeof window === 'undefined') return;
  try {
    puter.auth.signOut();
    try {
      localStorage.removeItem(PUTER_SIGNED_IN_KEY);
    } catch {
      // ignore
    }
  } catch (error) {
    void error;
  }
};

export default puter;
