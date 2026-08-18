"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { queryCache } from "../lib/queryCache";
import { logger } from "../lib/logger";
import { toast } from "sonner";
import {
  AcademicLevel,
  Department,
  UserAcademic,
  DEFAULT_ACADEMIC,
  academicCache,
  ACADEMIC_FETCH_KEY,
  FETCH_COOLDOWN,
  RATE_LIMIT_KEY,
} from "../lib/academic-utils";

export function useUserAcademic() {
  const { user, loading: authLoading } = useAuth();

  const [academic, setAcademic] = useState<UserAcademic>(DEFAULT_ACADEMIC);
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromCache = () => {
      if (!user) return;
      const cached = academicCache.getUserAcademic(user.id);
      if (cached) setAcademic(cached);
    };

    const onCustomUpdate = () => syncFromCache();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "masarx_user_academic_cache") syncFromCache();
    };

    window.addEventListener(
      "masarx_user_academic_updated",
      onCustomUpdate as EventListener,
    );
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(
        "masarx_user_academic_updated",
        onCustomUpdate as EventListener,
      );
      window.removeEventListener("storage", onStorage);
    };
  }, [user]);

  const executeWithRetry = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      const MAX_RETRIES = 3;
      const BASE_DELAY = 1000;
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          return await operation();
        } catch (error: unknown) {
          attempt++;
          const err = error as {
            code?: string;
            message?: string;
            status?: number;
          };
          const isTransient =
            err?.code === "504" ||
            err?.code === "502" ||
            err?.message?.includes("fetch") ||
            err?.status === 504 ||
            err?.status === 502;
          if (attempt >= MAX_RETRIES || !isTransient) throw error;
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      throw new Error("Max retries exceeded");
    },
    [],
  );

  const fetchProfileData = useCallback(
    async (userId: string) => {
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
          semester:
            typeof result?.semester === "number" ? result.semester : null,
          department_id: result?.department_id || null,
        };

        setAcademic(academicData);
        academicCache.setUserAcademic(userId, academicData);
        localStorage.setItem(ACADEMIC_FETCH_KEY, Date.now().toString());
      } catch (e) {
        logger.error("Failed to fetch academic profile data", e, { userId });
      }
    },
    [executeWithRetry],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAcademic(DEFAULT_ACADEMIC);
      setLoading(false);
      return;
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const cached = academicCache.getUserAcademic(user.id);
      if (cached) {
        setAcademic(cached);
        setLoading(false);
        const lastFetch = localStorage.getItem(ACADEMIC_FETCH_KEY);
        if (!lastFetch || Date.now() - Number(lastFetch) > FETCH_COOLDOWN) {
          fetchProfileData(user.id);
        }
        return;
      }
      setLoading(true);
      fetchProfileData(user.id).finally(() => setLoading(false));
    }
  }, [user, authLoading, fetchProfileData]);

  const fetchOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);
      const cached = academicCache.getOptions();
      if (cached) {
        setLevels(cached.levels);
        setDepartments(cached.departments);
        setOptionsLoading(false);
        return;
      }

      await executeWithRetry(async () => {
        const [levelsRes, deptsRes] = await Promise.all([
          supabase
            .from("academic_levels")
            .select("id, name, level_number")
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("departments")
            .select("id, name, academic_level_id")
            .eq("is_active", true)
            .order("sort_order"),
        ]);
        if (levelsRes.error) throw levelsRes.error;
        if (deptsRes.error) throw deptsRes.error;

        const levelsData = levelsRes.data || [];
        const deptsData = deptsRes.data || [];
        setLevels(levelsData);
        setDepartments(deptsData);
        academicCache.setOptions(levelsData, deptsData);
      });
    } catch (error) {
      logger.error("Error fetching academic options", error);
    } finally {
      setOptionsLoading(false);
    }
  }, [executeWithRetry]);

  const setUserAcademic = useCallback(
    async (
      next: UserAcademic,
      options?: { isProfileUpdate?: boolean },
    ): Promise<{ success: boolean; message?: string }> => {
      if (!user) return { success: false };
      if (options?.isProfileUpdate) {
        const rlRaw = localStorage.getItem(RATE_LIMIT_KEY);
        const rlStats = rlRaw ? JSON.parse(rlRaw) : { count: 0, blockUntil: 0 };
        const now = Date.now();
        if (rlStats.blockUntil > now) {
          const remaining = Math.ceil((rlStats.blockUntil - now) / 1000);
          return {
            success: false,
            message: `يرجى الانتظار ${remaining} ثانية قبل تحديث بياناتك مرة أخرى.`,
          };
        }
        rlStats.count++;
        if (rlStats.count >= 5) rlStats.blockUntil = now + 60000;
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rlStats));
      }

      try {
        setAcademic(next);
        academicCache.setUserAcademic(user.id, next);
        queryCache.invalidatePrefix("subjects");

        await executeWithRetry(async () => {
          const { error } = await supabase
            .from("profiles")
            .upsert(
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
        return { success: true };
      } catch (e: unknown) {
        logger.error("Error setting user academic", e, {
          userId: user.id,
          next,
        });
        const msg =
          "حدث خطأ أثناء حفظ المعلومات الأكاديمية. الرجاء المحاولة مرة أخرى.";
        toast.error(msg);
        return { success: false, message: msg };
      }
    },
    [user, executeWithRetry],
  );

  useEffect(() => {
    if (levels.length === 0) fetchOptions();
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
    fetchAcademic: () => user && fetchProfileData(user.id),
    setUserAcademic,
  };
}
