'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { chatHelpers } from "../lib/supabase";

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

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminRole, setAdminRole] = useState<"doctor" | "student" | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Helper to extract display name from user metadata or email
  const getDisplayName = useCallback((u: User) => {
    return (
      u.user_metadata?.display_name ||
      u.user_metadata?.name ||
      u.email?.split("@")[0] ||
      "مستخدم"
    );
  }, []);

  // Cache for admin status to avoid repeated checks
  const [adminCache, setAdminCache] = useState<{ [userId: string]: { isAdmin: boolean, role: "doctor" | "student" | null } }>(
    {}
  );

  // Centralized function to verify admin status with caching
  const verifyAdminStatus = useCallback(
    async (u: User | null, forceRefresh = false) => {
      if (!u) {
        setIsAdmin(false);
        setIsAdminLoading(false);
        return false;
      }

      const cacheKey = `admin_status_${u.id}`;
      const cacheExpiry = 1000 * 60 * 50; // 50 minutes

      // 1. Immediate check from metadata (Fastest)
      const userMetadataRole = u.user_metadata?.role;
      const appMetadataRole = u.app_metadata?.role;
      
      const checkRole = (role: string | string[] | null | undefined) => {
        if (Array.isArray(role)) return role.includes("admin");
        return role === "admin";
      };

      const isAdminInMetadata = checkRole(userMetadataRole) || checkRole(appMetadataRole);

      // Check memory cache first for instant response
      if (!forceRefresh && adminCache[u.id] !== undefined) {
        const cached = adminCache[u.id];
        // If metadata says admin but cache says not, ignore cache and proceed to check
        if (isAdminInMetadata && !cached.isAdmin) {
          console.log("AuthContext: Metadata says admin but memory cache says no, proceeding to verify");
        } else {
          setIsAdmin(cached.isAdmin);
          setAdminRole(cached.role);
          setIsAdminLoading(false);
          return cached.isAdmin;
        }
      }

      // Check localStorage cache
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { isAdmin: cachedIsAdmin, role: cachedRole, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < cacheExpiry) {
              // If metadata says admin but cache says not, force a refresh
              if (isAdminInMetadata && !cachedIsAdmin) {
                console.log("AuthContext: Metadata says admin but cache says no, forcing refresh");
              } else {
                setAdminCache((prev) => ({ ...prev, [u.id]: { isAdmin: cachedIsAdmin, role: cachedRole } }));
                setIsAdmin(cachedIsAdmin);
                setAdminRole(cachedRole);
                setIsAdminLoading(false);
                return cachedIsAdmin;
              }
            }
          }
        } catch (e) {
          // Ignore cache errors
        }
      }

      if (isAdminInMetadata) {
        setIsAdmin(true);
        // If metadata also specifies doctor/student, use it as temporary role
        const roles = Array.isArray(userMetadataRole) ? userMetadataRole : [userMetadataRole];
        if (roles.includes("doctor")) setAdminRole("doctor");
        else if (roles.includes("student")) setAdminRole("student");
      }

      // 2. Background check from database (Reliable)
      setIsAdminLoading(true);
      try {
        const { data, error } = (await Promise.race([
          supabase
            .from("admins")
            .select("role")
            .eq("user_id", u.id)
            .maybeSingle(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Admin check timeout")), 5000)
          ),
        ])) as { data: { role: "doctor" | "student" | null } | null; error: any };

        const isDbAdmin = !!data && !error;
        const role = data?.role || null;
        
        setIsAdmin(isDbAdmin);
        setAdminRole(role);

        // Cache the result
        setAdminCache((prev) => ({ ...prev, [u.id]: { isAdmin: isDbAdmin, role } }));
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            isAdmin: isDbAdmin,
            role,
            timestamp: Date.now(),
          })
        );

        return isDbAdmin;
      } catch (err) {
        console.error("AuthContext: Admin check failed", err);
        // Preserve metadata admin status if it was already set
        if (!isAdminInMetadata) {
          setIsAdmin(false);
          setAdminRole(null);
        }
        // Cache false result for 5 minutes to avoid repeated failed requests
        setAdminCache((prev) => ({ ...prev, [u.id]: { isAdmin: false, role: null } }));
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            isAdmin: false,
            role: null,
            timestamp: Date.now(),
          })
        );
        return false;
      } finally {
        setIsAdminLoading(false);
      }
    },
    [adminCache]
  );

  // Public function to force refresh admin status
  const refreshAdminStatus = async () => {
    const {
      data: { user: freshUser },
    } = await supabase.auth.getUser();
    if (freshUser) setUser(freshUser);
    return await verifyAdminStatus(freshUser, true); // Force refresh
  };

  // Initialize and listen to auth changes
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

        // Start admin check but don't block initial loading
        if (currentUser) {
          verifyAdminStatus(currentUser);
        }
      } catch (err) {
        console.error("AuthContext: Initialization failed", err);
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

        // Set loading to false immediately - don't block on avatar loading
        setLoading(false);

        // Load avatar URL in background (non-blocking)
        if (currentUser) {
          // Set initial avatar from metadata first (instant)
          setAvatarUrl(currentUser.user_metadata?.avatar_url ?? null);

          // Then try to get from database in background
          supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", currentUser.id)
            .maybeSingle()
            .then(
              ({
                data: profileData,
                error,
              }: {
                data: { avatar_url: string | null } | null;
                error: unknown;
              }) => {
                if (!error && profileData?.avatar_url) {
                  setAvatarUrl(profileData.avatar_url);
                }
              },
              (err: unknown) => {
                console.warn("Failed to load avatar from database:", err);
              }
            );
        } else {
          setAvatarUrl(null);
        }

        if (currentUser) {
          // Only verify admin status on actual sign in/out events, not focus changes
          if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
            verifyAdminStatus(currentUser);
          }
        } else {
          // Clear admin cache on sign out
          setIsAdmin(false);
          setIsAdminLoading(false);
          setAdminRole(null);
          if (user) {
            localStorage.removeItem(`admin_status_${user.id}`);
          }
        }

        // Analytics for sign in
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
            .catch(console.error);
        }
      }
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
      // Convert file to base64
      const base64 = await fileToBase64(file);

      // Call upload-avatar Edge Function which updates both Cloudinary and database
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
        // Update local state - the Edge Function already updated the database
        setAvatarUrl(data.url);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error updating avatar:", error);
      throw error;
    }
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix
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
      options: { redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/` },
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
        .catch(console.error);
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
