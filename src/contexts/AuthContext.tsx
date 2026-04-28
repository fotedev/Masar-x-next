"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { ProfileRow } from "@/lib/admin-db/schema";
import { supabase } from "../lib/supabase";
import { analyticsHelpers } from "../lib/analyticsHelpers";
import { logger } from "../lib/logger";
import { cleanupOldLocalStorage } from '@/lib/storage-cleanup';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
  initialIsAdmin = false,
}: {
  children: ReactNode;
  initialUser?: User | null;
  initialProfile?: ProfileRow | null;
  initialIsAdmin?: boolean;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(initialProfile);
  const [isAdmin, setIsAdmin] = useState<boolean>(initialIsAdmin);
  const [loading, setLoading] = useState(!initialUser);
  
  // T005: Sync guards
  const syncInProgress = useRef<boolean>(false);
  const lastSyncTime = useRef<number>(0);
  const SYNC_COOLDOWN = 10000; // 10 seconds cooldown between syncs

  const triggerSync = useCallback(async (userId: string, force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastSyncTime.current < SYNC_COOLDOWN) {
      return;
    }

    if (syncInProgress.current) {
      return;
    }

    syncInProgress.current = true;
    try {
      const response = await fetch('/api/auth/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Sync failed');
      }
      
      lastSyncTime.current = Date.now();
      logger.info(`[auth] Successfully synced profile for ${userId}`);
    } catch (err) {
      logger.error(`[auth] Profile sync failed for ${userId}:`, err);
    } finally {
      syncInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // T034: Cleanup old localStorage keys migrated to sessionStorage
    cleanupOldLocalStorage();

    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        
        if (!mounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // If we have an initial session on mount, trigger a sync to be safe
        if (initialSession?.user) {
          triggerSync(initialSession.user.id);
        }
      } catch (e) {
        logger.error("Auth initialization failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        if (!mounted) return;

        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        setLoading(false);

        // Update local state based on metadata if user changed
        if (currentUser) {
          const role = currentUser.app_metadata?.role;
          setIsAdmin(role === 'admin' || role === 'doctor' || role === 'student_admin');
          // Note: profile will be updated via Server Action sync and layout revalidation
        } else {
          setIsAdmin(false);
          setProfile(null);
        }

        if (event === "SIGNED_IN" && currentUser) {
          // Trigger profile sync after sign-in
          triggerSync(currentUser.id, true); // Force sync on explicit sign-in

          analyticsHelpers
            .recordAnalytics({
              userId: currentUser.id,
              actionType: "user_login",
              contentType: "login",
              metadata: {
                provider: currentUser.app_metadata?.provider || "email",
              },
            })
            .catch(() => {});
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) {
      analyticsHelpers
        .recordAnalytics({
          userId: user.id,
          actionType: "user_logout",
          contentType: "logout",
        })
        .catch(() => {});
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

