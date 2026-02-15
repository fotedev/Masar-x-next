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

let puter: PuterClient = Puter as unknown as PuterClient;

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
  return {
    isReady: isPuterReady,
    isSignedIn: puter.auth?.isSignedIn?.() || false,
  };
};

export const signInToPuter = async () => {
  if (typeof window === 'undefined') return false;
  try {
    await puter.auth?.signIn?.();
    return true;
  } catch (error) {
    void error;
    return false;
  }
};

export const signOutFromPuter = () => {
  if (typeof window === 'undefined') return;
  try {
    puter.auth.signOut();
  } catch (error) {
    void error;
  }
};

export default puter;
