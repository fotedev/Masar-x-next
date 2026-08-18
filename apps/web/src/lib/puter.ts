"use client";

/**
 * Puter.js initialization and helper functions
 */

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

let realPuterClient: PuterClient | null = null;
let puterImportPromise: Promise<PuterClient> | null = null;

let puterWarmupPromise: Promise<boolean> | null = null;

const PUTER_SIGNED_IN_KEY = "puter_signed_in";
const PUTER_UNAVAILABLE_UNTIL_KEY = "puter_unavailable_until";

const isPuterTransportError = (error: unknown) => {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('socket.io') ||
    msg.includes('engine.io') ||
    msg.includes('websocket') ||
    msg.includes('polling') ||
    msg.includes('transport') ||
    msg.includes('400') ||
    msg.includes('bad request') ||
    msg.includes('closed before the connection') ||
    msg.includes('websocket is closed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('eio=') ||
    msg.includes('disconnect')
  );
};

export const warmupPuterAuth = async (): Promise<{ isSignedIn: boolean }> => {
  if (typeof window === 'undefined') return { isSignedIn: false };

  const unavailableUntil = getUnavailableUntil();
  if (unavailableUntil > Date.now()) {
    console.debug('[Puter] Warmup skipped - service in cooldown until', new Date(unavailableUntil).toISOString());
    return { isSignedIn: false };
  }

  if (!puterWarmupPromise) {
    puterWarmupPromise = (async () => {
      try {
        console.debug('[Puter] Starting auth warmup...');
        const client = await loadRealPuterClient();
        
        // Ensure client is healthy before proceeding
        if (!client?.auth) throw new Error('Puter auth sub-module not ready');
        
        const signedIn = Boolean(client.auth.isSignedIn?.());
        console.debug('[Puter] Auth warmup complete - signed in:', signedIn);
        try {
          if (signedIn) {
            localStorage.setItem(PUTER_SIGNED_IN_KEY, '1');
          } else {
            localStorage.removeItem(PUTER_SIGNED_IN_KEY);
          }
        } catch {
          // ignore
        }
        return signedIn;
      } catch (error) {
        puterWarmupPromise = null; // Reset on failure so we can retry
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.debug('[Puter] Auth warmup failed:', errorMsg);
        if (isPuterTransportError(error)) {
          console.warn('[Puter] Transport error detected - setting cooldown:', error instanceof Error ? error.message : String(error));
          setUnavailableCooldown(60_000); // Increased to 60s for WebSocket failures
        }
        try {
          localStorage.removeItem(PUTER_SIGNED_IN_KEY);
        } catch {
          // ignore
        }
        return false;
      }
    })();
  }

  const isSignedIn = await puterWarmupPromise;
  return { isSignedIn };
};

const getUnavailableUntil = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(PUTER_UNAVAILABLE_UNTIL_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const setUnavailableCooldown = (msFromNow: number) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PUTER_UNAVAILABLE_UNTIL_KEY, String(Date.now() + msFromNow));
  } catch {
    // ignore
  }
};

const loadRealPuterClient = async (): Promise<PuterClient> => {
  if (typeof window === 'undefined') {
    throw new Error('Puter SDK can only be loaded in the browser');
  }
  if (realPuterClient) return realPuterClient;
  if (!puterImportPromise) {
    puterImportPromise = (async () => {
      try {
        const m = await import('@heyputer/puter.js');
        const client = (m.puter as unknown as PuterClient) ?? null;
        if (!client) throw new Error('Failed to initialize Puter client');
        realPuterClient = client;
        return client;
      } catch (error) {
        // Log initialization errors for debugging
        console.debug('[Puter] Initialization error:', error instanceof Error ? error.message : String(error));
        // Re-throw so the caller can handle it appropriately
        throw error;
      }
    })();
  }
  return puterImportPromise;
};

const puter: PuterClient = {
  auth: {
    isSignedIn: () => {
      try {
        return Boolean(realPuterClient?.auth?.isSignedIn?.());
      } catch {
        return false;
      }
    },
    signIn: async (options?: unknown) => {
      const client = await loadRealPuterClient();
      return client.auth?.signIn?.(options);
    },
    signOut: () => {
      try {
        realPuterClient?.auth?.signOut?.();
      } catch {
        // ignore
      }
    },
    getUser: async () => {
      const client = await loadRealPuterClient();
      return client.auth?.getUser?.();
    },
  },
  ai: {
    chat: async (...args: unknown[]) => {
      const client = await loadRealPuterClient();
      return client.ai?.chat?.(...args);
    },
  },
};

// Initialize Puter.js status
const isPuterReady = typeof window !== 'undefined';

let puterDiagnosticsInitialized = false;

const isPuterDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('puterDebug') === '1') return true;
  } catch {
    // ignore
  }
  try {
    return localStorage.getItem('puter_debug') === '1';
  } catch {
    return false;
  }
};

export const initPuterDiagnostics = () => {
  if (puterDiagnosticsInitialized) return;
  if (typeof window === 'undefined') return;
  puterDiagnosticsInitialized = true;

  if (isPuterDebugEnabled()) {
    return;
  }

  const errorPatterns = [/socket\.io/i, /engine\.io/i, /websocket/i, /polling/i, /transport/i];

  let errorSuppressUntil = 0;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = function (...args: unknown[]) {
    const msg = String(args[0] || '').toLowerCase();
    const stack = String(new Error().stack).toLowerCase();
    
    if (errorPatterns.some((p) => p.test(msg)) || errorPatterns.some((p) => p.test(stack))) {
      const now = Date.now();
      if (now >= errorSuppressUntil) {
        originalConsoleError.apply(console, args);
        errorSuppressUntil = now + 15000;
      }
      return;
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = function (...args: unknown[]) {
    const msg = String(args[0] || '').toLowerCase();
    const stack = String(new Error().stack).toLowerCase();

    if (errorPatterns.some((p) => p.test(msg)) || errorPatterns.some((p) => p.test(stack))) {
      const now = Date.now();
      if (now >= errorSuppressUntil) {
        originalConsoleWarn.apply(console, args);
        errorSuppressUntil = now + 15000;
      }
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const msg = event.message.toLowerCase();
      if (errorPatterns.some((p) => p.test(msg))) {
        event.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const msg = String(event.reason || '').toLowerCase();
      if (errorPatterns.some((p) => p.test(msg))) {
        event.preventDefault();
      }
    },
    true,
  );
};

export const getPuterStatus = () => {
  if (typeof window === 'undefined') {
    return { isReady: false, isSignedIn: false };
  }

  const unavailableUntil = getUnavailableUntil();
  if (unavailableUntil > Date.now()) {
    return { isReady: false, isSignedIn: false };
  }

  const explicitSignedIn = localStorage.getItem(PUTER_SIGNED_IN_KEY) === "1";
  let sdkSignedIn = false;
  try {
    sdkSignedIn = Boolean(realPuterClient?.auth?.isSignedIn?.());
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

  const unavailableUntil = getUnavailableUntil();
  if (unavailableUntil > Date.now()) {
    return { ok: false, signedIn: false, reason: "unknown" };
  }

  puterWarmupPromise = null;

  try {
    initPuterDiagnostics();

    const signInOptions = options?.attemptTempUserCreation
      ? ({ attempt_temp_user_creation: true } as const)
      : undefined;

    // Set a timeout to prevent hanging on unresponsive socket.io
    const signInPromise = puter.auth.signIn(signInOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Puter sign-in timeout')), 15000)
    );
    
    await Promise.race([signInPromise, timeoutPromise]);

    const isSignedInNow = Boolean(puter.auth.isSignedIn());
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
    if (isPuterTransportError(error)) {
      console.warn('[Puter] Sign-in transport error - setting cooldown:', error instanceof Error ? error.message : String(error));
      setUnavailableCooldown(90_000); // Longer cooldown for sign-in failures
    }
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
    puterWarmupPromise = null;
    try {
      localStorage.removeItem(PUTER_SIGNED_IN_KEY);
      localStorage.removeItem(PUTER_UNAVAILABLE_UNTIL_KEY);
    } catch {
      // ignore
    }
  } catch (error) {
    void error;
  }
};

export default puter;
