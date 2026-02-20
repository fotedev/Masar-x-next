import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

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
const ACADEMIC_UPDATE_KEY = "masarx_academic_update_timestamp";
const USER_ACADEMIC_CACHE_KEY = "masarx_user_academic_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown for fetching profile data
const UPDATE_COOLDOWN = 60 * 1000; // 1 minute cooldown for updating profile

type AcademicCache = {
  levels: AcademicLevel[];
  departments: Department[];
  lastFetched: number;
};

export function useUserAcademic() {
  const { user, loading: authLoading } = useAuth();
  const [academic, setAcademic] = useState<UserAcademic>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(USER_ACADEMIC_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            return parsed.data;
          }
        } catch (e) {
          console.error("Failed to parse academic cache", e);
        }
      }
    }
    return DEFAULT_ACADEMIC;
  });
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(USER_ACADEMIC_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            return false;
          }
        } catch {}
      }
    }
    return true;
  });
  const [optionsLoading, setOptionsLoading] = useState(true);

  const fetchOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);

      // 1. Check persistent cache
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const parsed: AcademicCache = JSON.parse(cachedData);
          const isExpired = Date.now() - parsed.lastFetched > CACHE_TTL;

          if (!isExpired && parsed.levels.length > 0) {
            setLevels(parsed.levels);
            setDepartments(parsed.departments);
            setOptionsLoading(false);
            // Optionally revalidate in background, but for static-ish data like this, 
            // immediate return is fine to save queries.
            return;
          }
        } catch (e) {
          console.error("Failed to parse academic cache", e);
        }
      }

      // 2. Fetch from Supabase if no valid cache
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

      // 3. Update cache
      const cacheToSave: AcademicCache = {
        levels: levelsData,
        departments: deptsData,
        lastFetched: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheToSave));

    } catch (error) {
      console.error("Error fetching academic options:", error);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const fetchAcademic = useCallback(async () => {
    if (!user) {
      setAcademic(DEFAULT_ACADEMIC);
      setLoading(false);
      return;
    }

    try {
      // Rate limiting: check last fetch time
      const lastFetch = localStorage.getItem(ACADEMIC_FETCH_KEY);
      if (lastFetch && Date.now() - Number(lastFetch) < FETCH_COOLDOWN && academic.level !== null) {
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("level, semester, department_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      const academicData = {
        level: typeof data?.level === "number" ? data.level : null,
        semester: typeof data?.semester === "number" ? data.semester : null,
        department_id: data?.department_id || null,
      };

      setAcademic(academicData);

      // Update persistent cache for user academic data
      localStorage.setItem(
        USER_ACADEMIC_CACHE_KEY,
        JSON.stringify({
          data: academicData,
          timestamp: Date.now(),
        }),
      );

      // Update last fetch timestamp
      localStorage.setItem(ACADEMIC_FETCH_KEY, Date.now().toString());
    } catch {
      setAcademic(DEFAULT_ACADEMIC);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setUserAcademic = useCallback(
    async (next: UserAcademic): Promise<{ success: boolean; message?: string }> => {
      if (!user) return { success: false };

      // Rate limiting: prevent abuse by checking last update time
      const lastUpdate = localStorage.getItem(ACADEMIC_UPDATE_KEY);
      if (lastUpdate && Date.now() - Number(lastUpdate) < UPDATE_COOLDOWN) {
        const remainingTime = Math.ceil((UPDATE_COOLDOWN - (Date.now() - Number(lastUpdate))) / 1000);
        return { success: false, message: `يرجى الانتظار ${remainingTime} ثانية قبل تحديث بياناتك مرة أخرى.` };
      }

      try {
        setLoading(true);
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
        setAcademic(next);

        // Update persistent cache
        localStorage.setItem(
          USER_ACADEMIC_CACHE_KEY,
          JSON.stringify({
            data: next,
            timestamp: Date.now(),
          }),
        );
        
        // Update last update timestamp
        localStorage.setItem(ACADEMIC_UPDATE_KEY, Date.now().toString());
        return { success: true };
      } catch {
        return { success: false, message: "حدث خطأ أثناء حفظ المعلومات الأكاديمية" };
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    // Only fetch if we don't have levels yet to avoid repeated loading on focus
    if (levels.length === 0) {
      fetchOptions();
    }
  }, [fetchOptions, levels.length]);

  useEffect(() => {
    if (authLoading || !user) return;
    
    // Only fetch if we haven't loaded academic data yet
    // This prevents the "loading" state from flashing when returning to the tab
    if (academic.level === null && loading) {
      fetchAcademic();
    } else if (!loading) {
      // If we already have data, we can silently revalidate if needed, 
      // but let's keep it simple for now to solve the UI flickering.
    }
  }, [authLoading, fetchAcademic, user, academic.level, loading]);

  return {
    academic,
    userLevel: academic.level,
    userSemester: academic.semester,
    userDepartmentId: academic.department_id,
    levels,
    departments,
    loading: loading || optionsLoading,
    fetchAcademic,
    setUserAcademic,
  };
}
