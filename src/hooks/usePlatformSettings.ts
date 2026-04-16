import { useOptionalPlatformSettingsContext } from "@/contexts/PlatformSettingsContext";
import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

export function usePlatformSettings() {
  const context = useOptionalPlatformSettingsContext();

  // Independent logic (identical to the old hook, used if Context fails or is missing)
  const getInitialSemester = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeSemester');
      return saved ? Number(saved) : 1;
    }
    return 1;
  };

  const [localLoading, setLocalLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState<{ active_semester: number }>({ active_semester: getInitialSemester() });

  const fetchSettings = useCallback(async (skipCache = false) => {
    try {
      setLocalLoading(true);
      const cacheKey = cacheKeys.settings();
      if (!skipCache) {
        const cached = queryCache.get<{ active_semester: number }>(cacheKey);
        if (cached) {
          setLocalSettings(cached);
          setLocalLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .eq("key", "active_semester")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116" && error.code !== "PGRST205") throw error;

      let newSemester = 1;
      if (data?.value && typeof data.value === 'object' && 'semester' in (data.value as any)) {
        newSemester = Number((data.value as any).semester ?? 1);
      }

      const updatedSettings = { active_semester: newSemester };
      setLocalSettings(updatedSettings);
      queryCache.set(cacheKey, updatedSettings, cacheTTL.settings);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeSemester', newSemester.toString());
      }
    } catch {
      // ignore
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const setActiveSemester = useCallback(async (semester: number) => {
    try {
      setLocalLoading(true);
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: "active_semester", value: { semester }, updated_at: new Date().toISOString() }, { onConflict: "key" });

      if (error) throw error;
      setLocalSettings({ active_semester: semester });
      queryCache.delete(cacheKeys.settings());
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeSemester', semester.toString());
        window.dispatchEvent(new CustomEvent('activeSemesterChanged', { detail: semester }));
      }
      return true;
    } catch {
      return false;
    } finally {
      setLocalLoading(false);
    }
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
      activeSemester: context.activeSemester,
      fetchSettings: context.fetchSettings,
      setActiveSemester: context.setActiveSemester,
      isFallback: false,
    };
  }

  return {
    loading: localLoading,
    settings: localSettings,
    activeSemester: localSettings.active_semester || 1,
    fetchSettings,
    setActiveSemester,
    isFallback: true,
  };
}
