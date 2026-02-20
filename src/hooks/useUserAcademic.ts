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
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

type AcademicCache = {
  levels: AcademicLevel[];
  departments: Department[];
  lastFetched: number;
};

export function useUserAcademic() {
  const { user, loading: authLoading } = useAuth();
  const [academic, setAcademic] = useState<UserAcademic>(DEFAULT_ACADEMIC);
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("level, semester, department_id")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      setAcademic({
        level: typeof data?.level === "number" ? data.level : null,
        semester: typeof data?.semester === "number" ? data.semester : null,
        department_id: data?.department_id || null,
      });
    } catch {
      setAcademic(DEFAULT_ACADEMIC);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setUserAcademic = useCallback(
    async (next: UserAcademic): Promise<boolean> => {
      if (!user) return false;

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
        return true;
      } catch {
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    if (authLoading) return;
    fetchAcademic();
  }, [authLoading, fetchAcademic]);

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
