"use client";

/**
 * Puter.js initialization and helper functions
 */

import { puter as Puter } from '@heyputer/puter.js';

type PuterClient = {
  auth: {
    isSignedIn: () => boolean;
    signIn: (options?: unknown) => Promise<unknown>;
    signOut: () => void;
    getUser: () => Promise<unknown>;
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
      getUser: async () => null,
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
  let sdkSignedIn = false;
  try {
    sdkSignedIn = Boolean(puter.auth?.isSignedIn?.());
  } catch {
    sdkSignedIn = false;
  }

  // Prefer the SDK's truth when available (prevents unauthenticated socket.io calls).
  // Keep localStorage as a fallback for UI hints if the SDK hasn't initialized yet.
  const isSignedIn = sdkSignedIn || explicitSignedIn;

  return {
    isReady: isPuterReady,
    isSignedIn,
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
