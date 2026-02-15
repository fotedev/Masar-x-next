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
import { supabase } from "../lib/supabase";
import { chatHelpers } from "../lib/chatHelpers";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  adminRole: "doctor" | "student" | null;
  displayName: string | null;
  avatarUrl: string | null;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  refreshAdminStatus: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("admin_status_"),
      );
      if (keys.length > 0) {
        const cached = JSON.parse(localStorage.getItem(keys[0])!);
        if (cached && Date.now() - cached.timestamp < 50 * 60 * 1000) {
          return cached.isAdmin;
        }
      }
    } catch {
      /* ignore */
    }
    return false;
  });
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminRole, setAdminRole] = useState<"doctor" | "student" | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith("admin_status_"),
        );
        if (keys.length > 0) {
          const cached = JSON.parse(localStorage.getItem(keys[0])!);
          if (cached && Date.now() - cached.timestamp < 50 * 60 * 1000) {
            return cached.role || null;
          }
        }
      } catch {
        /* ignore */
      }
      return null;
    },
  );
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const getDisplayName = useCallback((u: User) => {
    return (
      u.user_metadata?.display_name ||
      u.user_metadata?.name ||
      u.email?.split("@")[0] ||
      "مستخدم"
    );
  }, []);

  const adminCacheRef = useRef<{
    [userId: string]: { isAdmin: boolean; role: "doctor" | "student" | null };
  }>({});

  const verifyAdminStatus = useCallback(
    async (u: User | null, forceRefresh = false): Promise<boolean> => {
      if (!u) {
        setIsAdmin(false);
        setIsAdminLoading(false);
        return false;
      }

      const cacheKey = `admin_status_${u.id}`;
      const cacheExpiry = 1000 * 60 * 50;

      const userMetadataRole = u.user_metadata?.role;
      const appMetadataRole = u.app_metadata?.role;

      const checkRole = (role: string | string[] | null | undefined) => {
        if (Array.isArray(role)) return role.includes("admin");
        return role === "admin";
      };

      const isAdminInMetadata =
        checkRole(userMetadataRole) || checkRole(appMetadataRole);

      if (!forceRefresh && adminCacheRef.current[u.id] !== undefined) {
        const cached = adminCacheRef.current[u.id];
        if (!(isAdminInMetadata && !cached.isAdmin)) {
          setIsAdmin(cached.isAdmin);
          setAdminRole(cached.role);
          setIsAdminLoading(false);
          return cached.isAdmin;
        }
      }

      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const {
              isAdmin: cachedIsAdmin,
              role: cachedRole,
              timestamp,
            } = JSON.parse(cached);
            if (Date.now() - timestamp < cacheExpiry) {
              if (!(isAdminInMetadata && !cachedIsAdmin)) {
                adminCacheRef.current = {
                  ...adminCacheRef.current,
                  [u.id]: { isAdmin: cachedIsAdmin, role: cachedRole },
                };
                setIsAdmin(cachedIsAdmin);
                setAdminRole(cachedRole);
                setIsAdminLoading(false);
                return cachedIsAdmin;
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (isAdminInMetadata) {
        setIsAdmin(true);
        const roles = Array.isArray(userMetadataRole)
          ? userMetadataRole
          : [userMetadataRole];
        if (roles.includes("doctor")) setAdminRole("doctor");
        else if (roles.includes("student")) setAdminRole("student");
      }

      setIsAdminLoading(true);
      try {
        const { data, error } = (await Promise.race([
          supabase
            .from("admins")
            .select("role")
            .eq("user_id", u.id)
            .maybeSingle(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Admin check timeout")), 5000),
          ),
        ])) as {
          data: { role: "doctor" | "student" | null } | null;
          error: unknown;
        };

        const isDbAdmin = !!data && !error;
        const role = data?.role || null;

        setIsAdmin(isDbAdmin);
        setAdminRole(role);

        adminCacheRef.current = {
          ...adminCacheRef.current,
          [u.id]: { isAdmin: isDbAdmin, role },
        };
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            isAdmin: isDbAdmin,
            role,
            timestamp: Date.now(),
          }),
        );

        return isDbAdmin;
      } catch {
        if (!isAdminInMetadata) {
          setIsAdmin(false);
          setAdminRole(null);
        }
        adminCacheRef.current = {
          ...adminCacheRef.current,
          [u.id]: { isAdmin: false, role: null },
        };
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            isAdmin: false,
            role: null,
            timestamp: Date.now(),
          }),
        );
        return isAdminInMetadata;
      } finally {
        setIsAdminLoading(false);
      }
    },
    [],
  );

  const refreshAdminStatus = async () => {
    try {
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      if (freshUser) setUser(freshUser);
      return await verifyAdminStatus(freshUser, true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.toLowerCase().includes("invalid refresh token")) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        setUser(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setIsAdmin(false);
        setAdminRole(null);
        return false;
      }
      throw e;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setDisplayName(currentUser ? getDisplayName(currentUser) : null);

        if (currentUser) {
          verifyAdminStatus(currentUser);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.toLowerCase().includes("invalid refresh token")) {
          try {
            await supabase.auth.signOut();
          } catch {
            /* ignore */
          }
          if (!mounted) return;
          setUser(null);
          setDisplayName(null);
          setAvatarUrl(null);
          setIsAdmin(false);
          setAdminRole(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setDisplayName(currentUser ? getDisplayName(currentUser) : null);
        setLoading(false);

        if (currentUser) {
          setAvatarUrl(currentUser.user_metadata?.avatar_url ?? null);

          supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", currentUser.id)
            .maybeSingle()
            .then(
              ({ data: profileData, error }) => {
                if (!error && profileData?.avatar_url) {
                  setAvatarUrl(profileData.avatar_url);
                }
              },
              () => {
                /* ignore */
              },
            );

          if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
            verifyAdminStatus(currentUser);
          }
        } else {
          setAvatarUrl(null);
          setIsAdmin(false);
          setIsAdminLoading(false);
          setAdminRole(null);
          if (typeof window !== "undefined") {
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith("admin_status_"))
                .forEach((k) => localStorage.removeItem(k));
            } catch {
              /* ignore */
            }
          }
        }

        if (event === "SIGNED_IN" && currentUser) {
          chatHelpers
            .recordAnalytics({
              userId: currentUser.id,
              actionType: "ai_interaction",
              contentType: "user_login",
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
  }, [getDisplayName, verifyAdminStatus]);

  const updateDisplayName = async (name: string) => {
    if (!user) throw new Error("No user logged in");
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (error) throw error;
    setDisplayName(name);
  };

  const updateAvatar = async (file: File) => {
    if (!user) throw new Error("No user logged in");

    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("upload-avatar", {
        body: {
          file: base64,
          fileName: file.name,
          contentType: file.type,
          folder: "avatars",
          resourceType: "image",
        },
      });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      if (data.success && data.url) {
        setAvatarUrl(data.url);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      throw error;
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

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
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) {
      chatHelpers
        .recordAnalytics({
          userId: user.id,
          actionType: "user_logout",
          contentType: "user_logout",
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
        loading,
        isAdmin,
        isAdminLoading,
        adminRole,
        displayName,
        avatarUrl,
        updateDisplayName,
        updateAvatar,
        refreshAdminStatus,
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
