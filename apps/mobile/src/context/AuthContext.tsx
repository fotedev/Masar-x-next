/**
 * Mobile auth provider (spec FR-014 / US4): the same Supabase Auth
 * account as web/desktop, sessions persisted on-device through the
 * SecureStore-backed adapter in src/lib/supabase.ts, with the app-level
 * LocalAuthSession mirror (src/auth-storage.ts) kept in sync.
 *
 * Email/password only in v1 code scope - Google sign-in on mobile needs
 * an AS/OAuth browser session + deep-link callback and is tracked as a
 * follow-up (spec US4 T046); the login screen states this.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SupabaseClient } from "masarx-shared/supabase";

import {
  clearLocalAuthSession,
  saveLocalAuthSession,
} from "../auth-storage";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

type Session = NonNullable<
  Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>["data"]["session"]
>;
type User = Session["user"];

export type AuthStatus =
  | "loading"
  | "unconfigured"
  | "authenticated"
  | "signedOut";

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Bump to re-run the session bootstrap (e.g. from a retry button). */
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "unconfigured",
  );
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!isSupabaseConfigured) {
      setStatus("unconfigured");
      return;
    }

    const supabase = getSupabaseClient();

    const bootstrap = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        if (!mounted.current) return;
        setSession(initialSession);
        setStatus(initialSession ? "authenticated" : "signedOut");
      } catch {
        if (!mounted.current) return;
        setStatus("signedOut");
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "signedOut");

      // Keep the app-level LocalAuthSession mirror in step with the
      // client's own (adapter-persisted) session.
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && nextSession) {
        void saveLocalAuthSession(nextSession).catch(() => {});
      } else if (event === "SIGNED_OUT") {
        void clearLocalAuthSession().catch(() => {});
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [attempt]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await clearLocalAuthSession().catch(() => {});
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      signIn,
      signOut,
      retry,
    }),
    [status, session, signIn, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}