import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { queryCache } from "../lib/queryCache";

export type AcademicLevel = {
  id: string;
  name: string;
  level_number: number | null;
};

export type Department = {
  id: string;
  name: string;
  academic_level_id: string | null;
};

export type UserAcademic = {
  level: number | null;
  semester: number | null;
  department_id?: string | null;
};

const DEFAULT_ACADEMIC: UserAcademic = { level: null, semester: null, department_id: null };

const CACHE_KEY = "masarx_academic_options_cache";
const ACADEMIC_FETCH_KEY = "masarx_academic_fetch_timestamp";
const USER_ACADEMIC_CACHE_KEY = "masarx_user_academic_cache";
const RATE_LIMIT_KEY = "masarx_academic_rate_limit";

// Increased TTLs for Supabase free tier unreliability
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_COOLDOWN = 60 * 60 * 1000; // 1 hour cooldown for fetching profile data

type AcademicCache = {
  levels: AcademicLevel[];
  departments: Department[];
  lastFetched: number;
};

type RateLimitState = {
  count: number;
  blockUntil: number;
};

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export function useUserAcademic() {
  const { user, loading: authLoading } = useAuth();

  const [academic, setAcademic] = useState<UserAcademic>(DEFAULT_ACADEMIC);
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Use refs to prevent redundant fetches
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromCache = () => {
      if (!user) return;
      try {
        const cached = localStorage.getItem(USER_ACADEMIC_CACHE_KEY);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (parsed.userId !== user.id) return;
        if (!parsed.data) return;
        setAcademic(parsed.data);
      } catch {
        // ignore
      }
    };

    const onCustomUpdate = () => syncFromCache();
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_ACADEMIC_CACHE_KEY) syncFromCache();
    };

    window.addEventListener("masarx_user_academic_updated", onCustomUpdate as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("masarx_user_academic_updated", onCustomUpdate as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [user]);

  // 1. Initialize from cache as soon as user is available (Fixing the form flickering)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAcademic(DEFAULT_ACADEMIC);
      setLoading(false);
      return;
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      try {
        const cached = localStorage.getItem(USER_ACADEMIC_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.userId === user.id && Date.now() - parsed.timestamp < CACHE_TTL) {
            setAcademic(parsed.data);
            setLoading(false); // Valid cache found, don't show loading state

            // Stale-While-Revalidate: fetch softly in the background if cooldown passed
            const lastFetch = localStorage.getItem(ACADEMIC_FETCH_KEY);
            if (!lastFetch || Date.now() - Number(lastFetch) > FETCH_COOLDOWN) {
              fetchAcademicSoftly(user.id);
            }
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse academic cache", e);
      }

      // If no valid cache, we are still loading
      setLoading(true);
      fetchAcademicHard(user.id);
    }
  }, [user, authLoading]);


  const fetchOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);

      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const parsed: AcademicCache = JSON.parse(cachedData);
          const isExpired = Date.now() - parsed.lastFetched > CACHE_TTL;

          if (!isExpired && parsed.levels && parsed.levels.length > 0) {
            setLevels(parsed.levels);
            setDepartments(parsed.departments);
            setOptionsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to parse academic cache", e);
        }
      }

      await executeWithRetry(async () => {
        const [levelsRes, deptsRes] = await Promise.all([
          supabase.from("academic_levels").select("id, name, level_number").eq("is_active", true).order("sort_order"),
          supabase.from("departments").select("id, name, academic_level_id").eq("is_active", true).order("sort_order"),
        ]);

        if (levelsRes.error) throw levelsRes.error;
        if (deptsRes.error) throw deptsRes.error;

        const levelsData = levelsRes.data || [];
        const deptsData = deptsRes.data || [];

        setLevels(levelsData);
        setDepartments(deptsData);

        const cacheToSave: AcademicCache = {
          levels: levelsData,
          departments: deptsData,
          lastFetched: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheToSave));
      });

    } catch (error) {
      console.error("Error fetching academic options:", error);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const fetchProfileData = async (userId: string) => {
    try {
      const result = await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("level, semester, department_id")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        return data;
      });

      const academicData = {
        level: typeof result?.level === "number" ? result.level : null,
        semester: typeof result?.semester === "number" ? result.semester : null,
        department_id: result?.department_id || null,
      };

      setAcademic(academicData);

      localStorage.setItem(
        USER_ACADEMIC_CACHE_KEY,
        JSON.stringify({
          data: academicData,
          timestamp: Date.now(),
          userId: userId,
        }),
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("masarx_user_academic_updated"));
      }
      localStorage.setItem(ACADEMIC_FETCH_KEY, Date.now().toString());
    } catch (e) {
      console.error("Failed to fetch academic", e);
    }
  };

  const fetchAcademicHard = async (userId: string) => {
    setLoading(true);
    await fetchProfileData(userId);
    setLoading(false);
  };

  const fetchAcademicSoftly = async (userId: string) => {
    // Background fetch, don't set loading back to true
    await fetchProfileData(userId);
  };

  const fetchAcademic = useCallback(async () => {
    // Only used for manual refetching now
    if (!user) return;
    await fetchAcademicHard(user.id);
  }, [user]);

  const executeWithRetry = async <T,>(operation: () => Promise<T>): Promise<T> => {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        // If it's the last attempt or not a network/timeout error, throw
        if (attempt >= MAX_RETRIES || (error?.code !== '504' && error?.code !== '502' && !error?.message?.includes('fetch'))) {
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error("Max retries exceeded");
  };

  const setUserAcademic = useCallback(
    async (next: UserAcademic, options?: { isProfileUpdate?: boolean }): Promise<{ success: boolean; message?: string }> => {
      if (!user) return { success: false };

      const isProfile = options?.isProfileUpdate ?? false;

      if (isProfile) {
        const rlRaw = localStorage.getItem(RATE_LIMIT_KEY);
        let rlStats: RateLimitState = rlRaw ? JSON.parse(rlRaw) : { count: 0, blockUntil: 0 };

        const now = Date.now();
        if (rlStats.blockUntil > now) {
          const remaining = Math.ceil((rlStats.blockUntil - now) / 1000);
          return { success: false, message: `يرجى الانتظار ${remaining} ثانية قبل تحديث بياناتك مرة أخرى.` };
        }

        if (rlStats.blockUntil > 0 && rlStats.blockUntil <= now) {
          rlStats = { count: 0, blockUntil: 0 };
        }

        rlStats.count++;
        if (rlStats.count >= 5) {
          rlStats.blockUntil = now + 60000;
          rlStats.count = 0; // Reset for after block
          localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rlStats));
        } else {
          localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rlStats));
        }
      }

    try {
      // Optimistically update the state and cache
      setAcademic(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          USER_ACADEMIC_CACHE_KEY,
          JSON.stringify({
            data: next,
            timestamp: Date.now(),
            userId: user.id,
          }),
        );
        window.dispatchEvent(new Event("masarx_user_academic_updated"));
        queryCache.invalidatePrefix("subjects");
      }

      await executeWithRetry(async () => {
        const { error } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            level: next.level,
            semester: next.semester,
            department_id: next.department_id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (error) throw error;
      });

      setAcademic(next);

      // Invalidate subjects cache to ensure fresh data for the new level/semester
      if (typeof window !== 'undefined') {
        queryCache.invalidatePrefix("subjects");
      }

      return { success: true };
    } catch (e: any) {
      console.error("Error setting user academic:", e);
      return { success: false, message: "حدث خطأ أثناء حفظ المعلومات الأكاديمية. الرجاء المحاولة مرة أخرى." };
    } finally {
      // No-op
    }
    },
    [user],
  );

  useEffect(() => {
    if (levels.length === 0) {
      fetchOptions();
    }
  }, [fetchOptions, levels.length]);

  return {
    academic,
    userLevel: academic.level,
    userSemester: academic.semester,
    userDepartmentId: academic.department_id,
    levels,
    departments,
    loading,
    optionsLoading,
    fetchAcademic,
    setUserAcademic,
  };
}
