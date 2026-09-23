import { useOptionalPlatformSettingsContext } from "@/contexts/PlatformSettingsContext";
import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

/**
 * Spec 013 — read-only access to the platform DEFAULT semester, with local
 * fallback logic if the Context fails or is missing. Writers go through the
 * admin_migrate_student_semesters RPC; this hook never writes.
 */
export function usePlatformSettings() {
  const context = useOptionalPlatformSettingsContext();

  // Independent logic (identical to the old hook, used if Context fails or is missing)
  const getInitialSemester = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('defaultSemester');
      return saved ? Number(saved) : 1;
    }
    return 1;
  };

  const [localLoading, setLocalLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState<{ default_semester: number }>({ default_semester: getInitialSemester() });

  const fetchSettings = useCallback(async (skipCache = false) => {
    try {
      setLocalLoading(true);
      const cacheKey = cacheKeys.settings();
      if (!skipCache) {
        const cached = queryCache.get<{ default_semester: number }>(cacheKey);
        if (cached) {
          setLocalSettings(cached);
          setLocalLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .eq("key", "default_semester")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116" && error.code !== "PGRST205") throw error;

      let newSemester = 1;
      if (data?.value && typeof data.value === 'object' && 'semester' in (data.value as any)) {
        newSemester = Number((data.value as any).semester ?? 1);
      }

      const updatedSettings = { default_semester: newSemester };
      setLocalSettings(updatedSettings);
      queryCache.set(cacheKey, updatedSettings, cacheTTL.settings);
      if (typeof window !== 'undefined') {
        localStorage.setItem('defaultSemester', newSemester.toString());
      }
    } catch {
      // ignore
    } finally {
      setLocalLoading(false);
    }
  }, []);

  useEffect(() => {
    const onLocalChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number" && detail >= 1 && detail <= 3) {
        setLocalSettings({ default_semester: detail });
        if (typeof window !== 'undefined') {
          localStorage.setItem('defaultSemester', detail.toString());
        }
      }
    };
    window.addEventListener("defaultSemesterChanged", onLocalChange);
    return () => window.removeEventListener("defaultSemesterChanged", onLocalChange);
  }, []);

  useEffect(() => {
    if (!context) {
      void fetchSettings();
    }
  }, [context, fetchSettings]);

  // If context is available, use it. Otherwise, use local fallback logic.
  if (context) {
    return {
      loading: context.loading,
      settings: context.settings,
      defaultSemester: context.defaultSemester,
      fetchSettings: context.fetchSettings,
      isFallback: false,
    };
  }

  return {
    loading: localLoading,
    settings: localSettings,
    defaultSemester: localSettings.default_semester || 1,
    fetchSettings,
    isFallback: true,
  };
}
